export function toCents(val: number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;

  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return 0;
    const rounded = Math.round(val * 100);
    return rounded === 0 ? 0 : rounded;
  }

  if (typeof val === 'string') {
    const cleaned = val.trim().replace(/[^0-9.-]/g, '');
    if (!cleaned || !/^-?\d*(\.\d*)?$/.test(cleaned) || !/\d/.test(cleaned)) {
      return 0;
    }

    const isNegative = cleaned.startsWith('-');
    const absVal = isNegative ? cleaned.slice(1) : cleaned;
    const parts = absVal.split('.');
    if (parts.length > 2) return 0;

    const whole = parseInt(parts[0] || '0', 10);
    if (!Number.isFinite(whole)) return 0;

    let fraction = 0;
    if (parts.length === 2 && parts[1].length > 0) {
      const padded = parts[1] + '000';
      const baseTwo = parseInt(padded.substring(0, 2), 10);
      const thirdDigit = parseInt(padded.charAt(2), 10);
      fraction = thirdDigit >= 5 ? baseTwo + 1 : baseTwo;
    }

    const total = whole * 100 + fraction;
    if (total === 0) return 0;
    return isNegative ? -total : total;
  }

  return 0;
}

export function fromCents(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.trunc(cents) / 100;
}

export function formatCents(cents: number, sym = '₪'): string {
  const safeCents = Number.isFinite(cents) ? Math.trunc(cents) : 0;
  const isNeg = safeCents < 0;
  const absCents = Math.abs(safeCents);
  const whole = Math.floor(absCents / 100);
  const fraction = String(absCents % 100).padStart(2, '0');
  const wholeFmt = whole.toLocaleString('he-IL');
  return `${isNeg ? '-' : ''}${sym}${wholeFmt}.${fraction}`;
}