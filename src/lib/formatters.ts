// Utilitaires de formatage (montants, dates, etc.)

export function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 0,
  }).format((amountCents ?? 0) / 100);
}

