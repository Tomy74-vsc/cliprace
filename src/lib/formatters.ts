// Utilitaires de formatage (montants, dates, etc.)

export function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 0,
  }).format((amountCents ?? 0) / 100);
}

export type DateInput = string | number | Date | null | undefined;

export function formatDate(date: DateInput, options?: Intl.DateTimeFormatOptions, locale = "fr-FR"): string {
  if (!date) return "-";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat(locale, options ?? { year: "numeric", month: "short", day: "2-digit" }).format(d);
}

export function formatDateTime(
  date: DateInput,
  options?: Intl.DateTimeFormatOptions,
  locale = "fr-FR",
): string {
  if (!date) return "-";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat(
    locale,
    options ?? { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" },
  ).format(d);
}
