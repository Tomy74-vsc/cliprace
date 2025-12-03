/**
 * Calcul automatique de la répartition des gains pour un concours
 * 
 * Cette fonction calcule automatiquement le nombre de gagnants et la répartition
 * des gains en fonction du budget total, selon des templates prédéfinis.
 * 
 * Hypothèses :
 * - Le budget est en centimes (ex: 30000 = 300€)
 * - Minimum de 10€ par gagnant
 * - Distribution progressive favorisant le top 3
 * 
 * @param prizePoolCents - Budget total en centimes
 * @returns Tableau de prix avec rank_start, rank_end et amount_cents
 */
export type AutomaticPrize = {
  rank_start: number;
  rank_end: number;
  amount_cents: number;
};

const MIN_PRIZE_EUR = 10;

/**
 * Templates de pourcentages par nombre de gagnants
 * Les pourcentages sont ajustés pour que la somme fasse exactement 100%
 */
const PRIZE_TEMPLATES: Record<number, number[]> = {
  3: [60, 25, 15],
  5: [35, 22, 17, 13, 13],
  8: [26, 18, 14, 10, 8, 7, 7, 10],
  10: [24, 16, 12, 9, 8, 7, 7, 6, 6, 5],
  12: [22, 15, 11, 9, 8, 7, 6, 5, 5, 4, 4, 4],
};

/**
 * Détermine le nombre cible de gagnants selon le budget
 */
function getTargetWinnersCount(budgetEur: number): number {
  if (budgetEur < 100) return 3;
  if (budgetEur < 300) return 5;
  if (budgetEur < 500) return 8;
  if (budgetEur < 1000) return 10;
  return 12;
}

/**
 * Obtient le template de pourcentages le plus proche et ajuste pour que la somme fasse 100%
 */
function getClosestTemplate(winnersCount: number): number[] {
  // Si on a un template exact, on l'utilise et on normalise
  if (PRIZE_TEMPLATES[winnersCount]) {
    const template = [...PRIZE_TEMPLATES[winnersCount]];
    const sum = template.reduce((s, p) => s + p, 0);
    // Normaliser pour que la somme fasse exactement 100%
    return template.map((p) => (p / sum) * 100);
  }

  // Sinon, on prend le template inférieur le plus proche
  const availableCounts = Object.keys(PRIZE_TEMPLATES).map(Number).sort((a, b) => a - b);
  
  // Cherche le template inférieur le plus proche
  for (let i = availableCounts.length - 1; i >= 0; i--) {
    if (availableCounts[i] <= winnersCount) {
      const template = [...PRIZE_TEMPLATES[availableCounts[i]]];
      // Si on a besoin de plus de gagnants, on ajoute des pourcentages égaux pour les derniers
      if (availableCounts[i] < winnersCount) {
        const additional = winnersCount - availableCounts[i];
        const currentSum = template.reduce((sum, p) => sum + p, 0);
        const remainingPercent = 100 - currentSum;
        const additionalPercent = remainingPercent / additional;
        return [...template, ...Array(additional).fill(additionalPercent)];
      }
      // Normaliser le template existant
      const sum = template.reduce((s, p) => s + p, 0);
      return template.map((p) => (p / sum) * 100);
    }
  }

  // Fallback sur le template le plus petit
  const fallback = [...PRIZE_TEMPLATES[3]];
  const sum = fallback.reduce((s, p) => s + p, 0);
  return fallback.map((p) => (p / sum) * 100);
}

/**
 * Calcule automatiquement la répartition des gains
 */
export function computeAutomaticPrizes(prizePoolCents: number): AutomaticPrize[] {
  // Conversion en euros pour les calculs
  const B = prizePoolCents / 100;

  // Vérification du minimum
  if (B < MIN_PRIZE_EUR) {
    // Budget trop faible, on retourne un seul gagnant avec le budget total
    return [
      {
        rank_start: 1,
        rank_end: 1,
        amount_cents: prizePoolCents,
      },
    ];
  }

  // Calcul du nombre max théorique de gagnants
  const maxWinnersTheoretical = Math.floor(B / MIN_PRIZE_EUR);

  // Détermination du nombre cible de gagnants
  const targetWinners = getTargetWinnersCount(B);
  const winnersCount = Math.max(1, Math.min(targetWinners, maxWinnersTheoretical));

  // Obtention du template de pourcentages
  const percentages = getClosestTemplate(winnersCount);

  // Calcul des montants en centimes
  const prizes: AutomaticPrize[] = [];
  let totalCents = 0;

  for (let i = 0; i < winnersCount; i++) {
    const prizeEur = (B * percentages[i]) / 100;
    let prizeCents = Math.round(prizeEur * 100);

    // Garantir un minimum de 10€ par gagnant
    if (prizeEur < MIN_PRIZE_EUR) {
      prizeCents = MIN_PRIZE_EUR * 100;
    }

    prizes.push({
      rank_start: i + 1,
      rank_end: i + 1,
      amount_cents: prizeCents,
    });

    totalCents += prizeCents;
  }

  // Ajustement final pour que la somme corresponde exactement au budget
  const difference = prizePoolCents - totalCents;
  if (difference !== 0 && prizes.length > 0) {
    // On ajuste le premier gagnant (top 1)
    prizes[0].amount_cents += difference;
    // Vérifier qu'on ne tombe pas en dessous du minimum
    if (prizes[0].amount_cents < MIN_PRIZE_EUR * 100) {
      prizes[0].amount_cents = MIN_PRIZE_EUR * 100;
    }
  }

  return prizes;
}

