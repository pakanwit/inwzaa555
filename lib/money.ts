export function centsToBaht(cents: number): number {
  return Math.trunc(cents / 100);
}

export function formatBaht(cents: number): string {
  const whole = centsToBaht(Math.abs(cents));
  const formatted = whole.toLocaleString('en-US');
  return `${cents < 0 ? '-' : ''}฿${formatted}`;
}

export function parseBahtInput(input: string): number | null {
  const cleaned = input.replace(/[, ]/g, '').trim();
  if (cleaned === '') return null;
  if (!/^-?\d+$/.test(cleaned)) return null;
  return Number.parseInt(cleaned, 10) * 100;
}
