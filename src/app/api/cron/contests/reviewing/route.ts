import { getSupabaseAdmin } from '@/lib/supabase/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: toReview, error } = await admin
    .from('contests')
    .select('id, title, brand_id, reviewing_at')
    .eq('status', 'active')
    .lte('reviewing_at', nowIso)
    .limit(50);

  if (error) {
    console.error('[cron/reviewing] fetch error', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results = { moved: 0, failed: 0, ids: [] as string[] };

  for (const contest of toReview ?? []) {
    try {
      const endsAt = new Date(
        Date.now() + 2 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { error: updateError } = await admin
        .from('contests')
        .update({
          status: 'reviewing',
          ends_at: endsAt,
          updated_at: nowIso,
        })
        .eq('id', contest.id)
        .eq('status', 'active');

      if (updateError) throw updateError;

      await admin.from('status_history').insert({
        table_name: 'contests',
        row_id: contest.id,
        old_status: 'active',
        new_status: 'reviewing',
        changed_by: 'system',
        reason: 'Auto-transition to reviewing after 12 days active',
      });

      await admin.from('notifications').insert({
        user_id: contest.brand_id,
        type: 'contest_reviewing',
        title: '⏱ Phase de révision — 48h pour valider',
        body: `"${contest.title}" est en phase de révision finale. Validez les soumissions avant la distribution automatique.`,
        metadata: { contest_id: contest.id, ends_at: endsAt },
      });

      results.moved += 1;
      results.ids.push(contest.id);
    } catch (err) {
      console.error(`[cron/reviewing] failed for ${contest.id}`, err);
      results.failed += 1;
    }
  }

  console.log('[cron/reviewing]', results);
  return Response.json({ ok: true, ...results }, { status: 200 });
}

