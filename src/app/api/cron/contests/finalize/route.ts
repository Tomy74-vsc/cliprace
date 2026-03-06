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
  const nowIso = new Date().toISOString();

  const { data: toFinalize, error } = await admin
    .from('contests')
    .select('id, title, brand_id, prize_pool_cents, currency, ends_at')
    .eq('status', 'reviewing')
    .lte('ends_at', nowIso)
    .limit(20);

  if (error) {
    console.error('[cron/finalize] fetch error', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results = {
    finalized: 0,
    failed: 0,
    ids: [] as string[],
    payments_queued: 0,
  };

  for (const contest of toFinalize ?? []) {
    try {
      // 1. Passer ended
      const { error: updateError } = await admin
        .from('contests')
        .update({
          status: 'ended',
          end_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', contest.id)
        .eq('status', 'reviewing');

      if (updateError) throw updateError;

      await admin.from('status_history').insert({
        table_name: 'contests',
        row_id: contest.id,
        old_status: 'reviewing',
        new_status: 'ended',
        changed_by: 'system',
        reason: 'Auto-finalization after 2-day reviewing period',
      });

      // 2. Récupérer le leaderboard final + prizes
      const [leaderboardResult, prizesResult] = await Promise.all([
        admin.rpc('get_contest_leaderboard', {
          p_contest_id: contest.id,
          p_limit: 30,
        }),
        admin
          .from('contest_prizes')
          .select('position, amount_cents, percentage')
          .eq('contest_id', contest.id)
          .order('position', { ascending: true }),
      ]);

      const leaderboard = leaderboardResult.data ?? [];
      const prizes = prizesResult.data ?? [];

      // 3. Créer les paiements pour chaque gagnant
      let paymentsCreated = 0;
      for (const entry of leaderboard) {
        const prize = prizes.find((p) => p.position === entry.rank);
        if (!prize) continue;

        const amountCents =
          prize.amount_cents ??
          Math.round((contest.prize_pool_cents * (prize.percentage ?? 0)) / 100);

        if (amountCents <= 0) continue;

        const { error: paymentError } = await admin
          .from('payments_creator')
          .insert({
            creator_id: entry.creator_id,
            contest_id: contest.id,
            amount_cents: amountCents,
            currency: contest.currency ?? 'EUR',
            status: 'pending',
            rank: entry.rank,
          });

        if (paymentError) {
          console.error(
            `[cron/finalize] payment insert failed rank ${entry.rank}`,
            paymentError,
          );
        } else {
          paymentsCreated += 1;

          await admin.from('notifications').insert({
            user_id: entry.creator_id,
            type: 'payment_incoming',
            title: '💸 Tu as gagné !',
            body: `Tu as terminé #${entry.rank} dans "${contest.title}". Ton paiement est en cours de traitement.`,
            metadata: {
              contest_id: contest.id,
              amount_cents: amountCents,
              rank: entry.rank,
            },
          });
        }
      }

      results.payments_queued += paymentsCreated;

      // 4. Notification brand
      await admin.from('notifications').insert({
        user_id: contest.brand_id,
        type: 'contest_ended',
        title: '✅ Concours terminé — paiements lancés',
        body: `"${contest.title}" est terminé. ${paymentsCreated} paiement(s) sont en cours de traitement.`,
        metadata: {
          contest_id: contest.id,
          payments_count: paymentsCreated,
        },
      });

      results.finalized += 1;
      results.ids.push(contest.id);
    } catch (err) {
      console.error(`[cron/finalize] failed for ${contest.id}`, err);
      results.failed += 1;
    }
  }

  console.log('[cron/finalize]', results);
  return Response.json({ ok: true, ...results }, { status: 200 });
}

