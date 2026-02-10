import { computeAutomaticPrizes } from '@/lib/computeAutomaticPrizes';

export type PrizeSlice = {
  rank: number;
  amount_cents: number;
};

/**
 * Calcule une répartition "podium" simple (20%, 15%, 10%, reste lissé)
 * à partir d'un montant total en centimes.
 *
 * Cette fonction est volontairement déterministe et utilisable côté store
 * comme côté UI pour synchroniser l'affichage.
 */
export function calculatePrizeDistribution(totalAmountCents: number): PrizeSlice[] {
  if (totalAmountCents <= 0) {
    return [];
  }

  const totalEur = totalAmountCents / 100;

  // Si le budget est faible, on délègue à la logique existante
  if (totalEur < 100) {
    const auto = computeAutomaticPrizes(totalAmountCents);
    return auto.map((p) => ({
      rank: p.rank_start,
      amount_cents: p.amount_cents,
    }));
  }

  const p1 = Math.round(totalAmountCents * 0.2);
  const p2 = Math.round(totalAmountCents * 0.15);
  const p3 = Math.round(totalAmountCents * 0.1);
  let remaining = totalAmountCents - p1 - p2 - p3;

  const slices: PrizeSlice[] = [
    { rank: 1, amount_cents: p1 },
    { rank: 2, amount_cents: p2 },
    { rank: 3, amount_cents: p3 },
  ];

  // Distribuer le reste de façon décroissante mais lissée
  let rank = 4;
  while (remaining > 0 && rank <= 10) {
    const factor = Math.max(0.04, 0.12 - (rank - 4) * 0.01); // 12% -> 4%
    let slice = Math.round(totalAmountCents * factor);
    if (slice < 10 * 100) {
      slice = 10 * 100;
    }
    if (slice > remaining) {
      slice = remaining;
    }

    slices.push({ rank, amount_cents: slice });
    remaining -= slice;
    rank += 1;
  }

  // Si il reste encore quelques centimes, on les ajoute au premier
  if (remaining > 0) {
    slices[0].amount_cents += remaining;
  }

  return slices;
}

