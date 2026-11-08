/**
 * HOME OS — Financial Precision Engine
 * Uses STRICT integer cents representation (e.g. 10050 = ₪100.50).
 * Never relies on floating point math or Math.round(val * 100) / 100 for financial balances.
 */

/**
 * Converts a decimal string or number (e.g. "19.99", 19.99, "-50.00") into exact integer cents.
 * Prevents floating point artifacts like 19.99 * 100 = 1998.9999999999998.
 */
export function toCents(val: number | string | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;

  // Numeric callers are normalized to two decimal places. String callers
  // must already be a plain decimal value; malformed suffixes and extra
  // decimal places are rejected instead of being silently truncated.
  const isNumericInput = typeof val === 'number';
  const str = isNumericInput
    ? (Number.isFinite(val) ? val.toString() : '')
    : String(val).trim();
  const match = str.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return 0;

  const fraction = match[3] || '';
  // Text inputs stay strict; numeric callers use decimal half-up rounding
  // from their shortest decimal representation, avoiding 1.005 -> 1.00.
  if (!isNumericInput && fraction.length > 2) return 0;
  const wholePart = Number(match[2]);
  const fracPart = Number((fraction + '00').slice(0, 2));
  const roundUp = isNumericInput && fraction.length > 2 && fraction[2] >= '5' ? 1 : 0;
  const totalCents = wholePart * 100 + fracPart + roundUp;
  if (!Number.isSafeInteger(totalCents)) return 0;
  return match[1] ? -totalCents : totalCents;
}

/**
 * Converts integer cents back to a standard JavaScript decimal number for display.
 */
export function fromCents(cents: number): number {
  return Math.trunc(cents) / 100;
}

/**
 * Formats integer cents as a localized currency string with exact 2 decimal places.
 * e.g., 1845050 -> "₪18,450.50"
 */
export function formatCents(cents: number, currency: string = 'ILS'): string {
  const symbol = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, '0');
  const formattedWhole = whole.toLocaleString('he-IL');
  return `${isNegative ? '-' : ''}${symbol}${formattedWhole}.${frac}`;
}

/**
 * Parses user input in currency form to cents, returning { valid: boolean, cents: number, error?: string }
 */
export function parseCurrencyInput(input: string): { valid: boolean; cents: number; error?: string } {
  const raw = input.trim();
  if (!raw) {
    return { valid: false, cents: 0, error: 'יש להזין סכום' };
  }
  // Commas are accepted only as valid thousands separators (1,234.56).
  // This prevents an input such as "1,23" from silently becoming 123.
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) {
    return { valid: false, cents: 0, error: 'סכום אינו חוקי (יש להזין ספרות ועד 2 ספרות אחרי הנקודה)' };
  }
  const trimmed = raw.replace(/,/g, '');
  const match = trimmed.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    return { valid: false, cents: 0, error: 'סכום אינו חוקי (יש להזין ספרות ועד 2 ספרות אחרי הנקודה)' };
  }
  const wholePart = Number(match[2]);
  const fractionPart = Number((match[3] || '').padEnd(2, '0'));
  const absoluteCents = wholePart * 100 + fractionPart;
  if (!Number.isSafeInteger(absoluteCents)) {
    return { valid: false, cents: 0, error: 'הסכום חורג מהטווח הנתמך' };
  }
  const cents = match[1] ? -absoluteCents : absoluteCents;
  return { valid: true, cents };
}
