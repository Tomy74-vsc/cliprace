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

  const { data: toActivate, error } = await admin
    .from('contests')
    .select('id, title, brand_id, live_at')
    .eq('status', 'pending_live')
    .lte('live_at', nowIso)
    .limit(50);

  if (error) {
    console.error('[cron/activate] fetch error', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results = { activated: 0, failed: 0, ids: [] as string[] };

  for (const contest of toActivate ?? []) {
    try {
      const reviewingAt = new Date(
        Date.now() + 12 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { error: updateError } = await admin
        .from('contests')
        .update({
          status: 'active',
          start_at: nowIso,
          reviewing_at: reviewingAt,
          updated_at: nowIso,
        })
        .eq('id', contest.id)
        .eq('status', 'pending_live');

      if (updateError) throw updateError;

      await admin.from('status_history').insert({
        table_name: 'contests',
        row_id: contest.id,
        old_status: 'pending_live',
        new_status: 'active',
        changed_by: 'system',
        reason: 'Auto-activation after 24h pending period',
      });

      await admin.from('notifications').insert({
        user_id: contest.brand_id,
        type: 'contest_activated',
        title: '🚀 Ton concours est maintenant actif !',
        body: `"${contest.title}" est live. Les créateurs peuvent maintenant participer.`,
        metadata: { contest_id: contest.id },
      });

      results.activated += 1;
      results.ids.push(contest.id);
    } catch (err) {
      console.error(`[cron/activate] failed for ${contest.id}`, err);
      results.failed += 1;
    }
  }

  console.log('[cron/activate]', results);
  return Response.json({ ok: true, ...results }, { status: 200 });
}

