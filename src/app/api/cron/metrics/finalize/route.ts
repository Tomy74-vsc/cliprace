import { getSupabaseAdmin } from '@/lib/supabase/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const { data, error } = await admin
      .from('metrics_daily')
      .select(
        'submission:submissions!inner(contest_id, status), contest:contests!inner(status), weighted_views',
      )
      .eq('metric_date', today)
      .eq('submission.status', 'approved')
      .eq('contest.status', 'active');

    if (error) {
      throw error;
    }

    const rows =
      (data as Array<{
        submission?: { contest_id?: string | null; status?: string | null } | null;
        contest?: { status?: string | null } | null;
        weighted_views?: number | null;
      }> | null) ?? [];

    const contestIds = new Set<string>();
    for (const row of rows) {
      const contestId = row.submission?.contest_id;
      if (contestId) {
        contestIds.add(contestId);
      }
    }

    // Placeholder: pour l’instant, on ne met pas à jour contest_prizes.
    // Le calcul précis des payouts estimés sera implémenté plus tard.

    return Response.json(
      { ok: true, processed: contestIds.size },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erreur interne lors de la finalisation des métriques';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

