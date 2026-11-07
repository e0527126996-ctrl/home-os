export type ShoppingCategory =
  | 'ירקות ופירות'
  | 'בשר, דגים ועוף'
  | 'מוצרי חלב וביצים'
  | 'מאפייה'
  | 'מזווה ותבלינים'
  | 'ניקיון וטואלטיקה'
  | 'אחר';

const aliases: Record<string, string> = {
  'עגבניות': 'עגבנייה', 'עגבניה': 'עגבנייה',
  'מלפפונים': 'מלפפון', 'ביצים': 'ביצה', 'בצלים': 'בצל',
  'גזרים': 'גזר', 'פלפלים': 'פלפל', 'קישואים': 'קישוא',
  'חצילים': 'חציל', 'לימונים': 'לימון', 'תפוחים': 'תפוח',
  'בננות': 'בננה', 'תפוחי אדמה': 'תפוח אדמה', 'תפוא': 'תפוח אדמה',
};

const unitAliases: Record<string, string> = {
  'כפות': 'כף', 'כף': 'כף', 'כפיות': 'כפית', 'כפית': 'כפית',
  'כוסות': 'כוס', 'כוס': 'כוס', 'גרמים': 'גרם', 'גרם': 'גרם',
  'קילוגרם': 'ק״ג', 'קילוגרמים': 'ק״ג', 'קילו': 'ק״ג', 'ק״ג': 'ק״ג', 'קג': 'ק״ג',
  'מיליליטר': 'מ״ל', 'מיליליטרים': 'מ״ל', 'מל': 'מ״ל', 'מ״ל': 'מ״ל',
  'ליטר': 'ל׳', 'ליטרים': 'ל׳', 'ל׳': 'ל׳',
  'יחידה': 'יח׳', 'יחידות': 'יח׳', 'יח׳': 'יח׳', 'יח': 'יח׳',
  'חבילה': 'חבילה', 'חבילות': 'חבילה', 'קופסה': 'קופסה', 'קופסאות': 'קופסה',
  'שקית': 'שקית', 'שקיות': 'שקית', 'בקבוק': 'בקבוק', 'בקבוקים': 'בקבוק',
};

const normalizeText = (value: string) => value
  .normalize('NFKC')
  .replace(/[\u0591-\u05C7]/g, '')
  .replace(/[׳״"'’‘]/g, '')
  .replace(/[.,;:!?()[\]{}]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('he-IL');

export function normalizeShoppingName(value: string): string {
  const normalized = normalizeText(value);
  return aliases[normalized] || normalized;
}

export function classifyShoppingCategory(value: string): ShoppingCategory {
  const name = normalizeShoppingName(value);
  if (/עגבנ|מלפפ|חסה|גזר|בצל|פלפל|קישוא|חציל|תפוח|בננ|לימון|תפוז|אבוקדו|פטרוזיליה|כוסברה|שמיר|שום|ירק|פרי/.test(name)) return 'ירקות ופירות';
  if (/עוף|חזה עוף|כנפיים|בשר|בקר|הודו|דג|סלמון|טונה|קציצ|שניצל|נקניק|המבורגר/.test(name)) return 'בשר, דגים ועוף';
  if (/חלב|גבינה|קוטג|יוגורט|שמנת|חמאה|לבנה|ביצה|מעדן/.test(name)) return 'מוצרי חלב וביצים';
  if (/לחם|לחמנ|פיתה|חלה|בגט|פירור|מאפה/.test(name)) return 'מאפייה';
  if (/שמן|אורז|פסטה|קמח|סוכר|מלח|פלפל שחור|פפריקה|כורכום|קטניות|עדשים|שעועית|חומוס|שימורים|רסק|ריבה|דבש|קפה|תה|תבלין|אגוז|שקדים/.test(name)) return 'מזווה ותבלינים';
  if (/סבון|שמפו|מרכך|נייר|מגבונים|אבקת כביסה|אקונומיקה|נוזל כלים|מדיח|שקיות אשפה|ניקיון|משחת שיניים|טואלטיקה/.test(name)) return 'ניקיון וטואלטיקה';
  return 'אחר';
}

type ParsedQuantity = { value: number; unit: string; label: string };
const numberPattern = '(\\d+\\s*\\/\\s*\\d+|\\d+(?:[.,]\\d+)?)';

function parseNumber(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (normalized.includes('/')) {
    const [numerator, denominator] = normalized.split('/').map(Number);
    if (!denominator) return null;
    const result = numerator / denominator;
    return Number.isFinite(result) ? result : null;
  }
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function parseMeasure(value: string): ParsedQuantity | null {
  const match = value.trim().match(new RegExp('^' + numberPattern + '\\s*(.*?)$'));
  if (!match) return null;
  const amount = parseNumber(match[1]);
  if (amount === null) return null;
  const rawUnit = (match[2] || '').trim();
  const label = unitAliases[rawUnit] || rawUnit || 'יח׳';
  return { value: amount, unit: normalizeText(label), label };
}

function parseIngredientLine(value: string): { name: string; quantity: ParsedQuantity | null } {
  const text = value.trim();
  const separated = text.match(/^(.+?)\s*[-–—:]\s*(.+)$/);
  if (separated) {
    const quantity = parseMeasure(separated[2]);
    if (quantity) return { name: separated[1].trim(), quantity };
  }

  const prefix = text.match(new RegExp('^' + numberPattern + '\\s+(.+)$'));
  if (prefix) {
    const remainder = prefix[2].trim();
    const unitMatch = remainder.match(/^([^\s]+)\s+(.+)$/);
    const canonicalUnit = unitMatch ? unitAliases[unitMatch[1]] : undefined;
    const amount = parseNumber(prefix[1]);
    if (amount !== null && canonicalUnit && unitMatch) {
      return { name: unitMatch[2].trim(), quantity: { value: amount, unit: normalizeText(canonicalUnit), label: canonicalUnit } };
    }
    return { name: remainder, quantity: amount === null ? null : { value: amount, unit: normalizeText('יח׳'), label: 'יח׳' } };
  }

  const suffix = text.match(new RegExp('^(.+?)\\s+(' + numberPattern + ')\\s*(.*?)$'));
  if (suffix) {
    const quantity = parseMeasure(suffix[2] + ' ' + suffix[3]);
    if (quantity) return { name: suffix[1].trim(), quantity };
  }
  return { name: text, quantity: null };
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function mergeQuantityTexts(...values: string[]): string {
  const parts = values.map(value => value.trim()).filter(Boolean);
  if (!parts.length) return '';
  const tokens = parts.flatMap(value => value.split(/\s*\+\s*/).map(parseMeasure));
  if (tokens.every((part): part is ParsedQuantity => part !== null)) {
    const totals = new Map<string, ParsedQuantity>();
    for (const part of tokens) {
      const previous = totals.get(part.unit);
      totals.set(part.unit, { value: (previous?.value || 0) + part.value, unit: part.unit, label: previous?.label || part.label });
    }
    return [...totals.values()].map(part => [formatAmount(part.value), part.label].filter(Boolean).join(' ')).join(' + ');
  }
  return [...new Set(parts)].join(' + ');
}

export function formatIngredientQuantity(rawIngredients: string[], scaleFactor: number): string {
  const totals = new Map<string, ParsedQuantity>();
  for (const raw of rawIngredients) {
    const parsed = parseIngredientLine(raw).quantity;
    if (!parsed) continue;
    const previous = totals.get(parsed.unit);
    totals.set(parsed.unit, {
      value: (previous?.value || 0) + parsed.value * scaleFactor,
      unit: parsed.unit,
      label: previous?.label || parsed.label,
    });
  }
  return [...totals.values()].map(part => [formatAmount(part.value), part.label].filter(Boolean).join(' ')).join(' + ');
}

export function splitIngredientName(raw: string): string {
  return parseIngredientLine(raw).name;
}
