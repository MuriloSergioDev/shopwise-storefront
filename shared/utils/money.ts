/** Formats an amount in minor units (cents for USD) for display, using the currency's own number of decimals. */
export function formatMoney(amount: number, currency: string, locale = 'en-US'): string {
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency })
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2

  return format.format(amount / 10 ** digits)
}
