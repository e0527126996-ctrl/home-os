export type ShoppingCategory =
  | 'ירקות ופירות'
  | 'בשר, דגים ועוף'
  | 'מוצרי חלב וביצים'
  | 'מאפייה'
  | 'מזווה ותבלינים'
  | 'ניקיון וטואלטיקה'
  | 'אחר';

const aliases: Record<string, string> = {
  'עגבניות': 'עגבנייה',
  'עגבניה': 'עגבנייה',
  'מלפפונים': 'מלפפון',
  'ביצים': 'ביצה',
  'בצלים': 'בצל',
  'גזרים': 'גזר',
  'פלפלים': 'פלפל',
  'קישואים': 'קישוא',
  'חצילים': 'חציל',
  'לימונים': 'לימון',
  'תפוחים': 'תפוח',
  'בננות': 'בננה',
  'תפוחי אדמה': 'תפוח אדמה',
  'תפו״א': 'תפוח אדמה',
  'תפוא': 'תפוח אדמה',
};

const unitAliases: Record<string, string> = {
  'כפות': 'כף', 'כף': 'כף',
  'כפיות': 'כפית', 'כפית': 'כפית',
  'כוסות': 'כוס', 'כוס': 'כוס',
  'גרמים': 'גרם', 'גרם': 'גרם',
  'קילוגרם': 'ק״ג', 'קילוגרמים': 'ק״ג', 'קילו': 'ק״ג', 'ק״ג': 'ק״ג', 'קג': 'ק״ג',
  'מיליליטר': 'מ״ל', 'מיליליטרים': 'מ״ל', 'מל': 'מ״ל', 'מ״ל': 'מ״ל',
  'ליטר': 'ל׳', 'ליטרים': 'ל׳', 'ל׳': 'ל׳',
  'יחידה': 'יח׳', 'יחידות': 'יח׳', 'יח׳': 'יח׳', 'יח': 'יח׳',
  'חבילה': 'חבילה', 'חבילות': 'חבילה',
  'קופסה': 'קופסה', 'קופסאות': 'קופסה',
  'שקית': 'שקית', 'שקיות': 'שקית',
  'בקבוק': 'בקבוק', 'בקבוקים': 'בקבוק',
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
  if (/עגבנ|מלפפ|חסה|גזר|בצל|פלפל|קישוא|חציל|תפוח|בננ|לימון|תפוז|אבוקדו|פטרוזיליה|כוסברה|שמיר|שום|ירק|פרי|תפוח אדמה/.test(name)) return 'ירקות ופירות';
  if (/עוף|חזה עוף|כנפיים|בשר|בקר|הודו|דג|סלמון|טונה|קציצ|שניצל|נקניק|המבורגר/.test(name)) return 'בשר, דגים ועוף';
  if (/חלב|גבינה|קוטג|יוגורט|שמנת|חמאה|לבנה|ביצה|גבינת|מעדן/.test(name)) return 'מוצרי חלב וביצים';
  if (/לחם|לחמנ|פיתה|חלה|בגט|פירור|קמח תופח|מאפה/.test(name)) return 'מאפייה';
  if (/שמן|אורז|פסטה|קמח|סוכר|מלח|פלפל שחור|פפריקה|כורכום|קטניות|עדשים|שעועית|חומוס|שימורים|רסק|ריבה|דבש|קפה|תה|תבלין|אגוז|שקדים/.test(name)) return 'מזווה ותבלינים';
  if (/סבון|שמפו|מרכך|נייר|מגבונים|אבקת כביסה|מרכך כביסה|אקונומיקה|נוזל כלים|מדיח|שקיות אשפה|ניקיון|משחת שיניים|טואלטיקה/.test(name)) return 'ניקיון וטואלטיקה';
  return 'אחר';
}

type ParsedQuantity = { value: number; unit: string; label: string };

const numberPattern = '(\\d+(?:[.,]\\d+)?|\\d+\\s*\\/\\s*\\d+)';

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

function parseQuantityPart(value: string): ParsedQuantity | null {
  const match = value.trim().match(new RegExp('^' + numberPattern + '\\s*(.*?)$'));
  if (!match) return null;
  const amount = parseNumber(match[1]);
  if (amount === null) return null;
  const rawUnit = (match[2] || '').trim();
  const label = unitAliases[rawUnit] || rawUnit;
  return { value: amount, unit: normalizeText(label), label };
}

function parseOneQuantity(value: string): ParsedQuantity | null {
  const text = value.trim();
  const qtyFirst = text.match(new RegExp('^' + numberPattern + '\\s+(.+)$'));
  if (qtyFirst) {
    const remainder = qtyFirst[2].trim();
    const unitMatch = remainder.match(/^([^\\s]+)\\s+(.+)$/);
    if (unitMatch && unitAliases[unitMatch[1]]) {
      const label = unitAliases[unitMatch[1]];
      const amount = parseNumber(qtyFirst[1]);
      return amount === null ? null : { value: amount, unit: normalizeText(label), label };
    }
    // A quantity followed by an item name is interpreted as a count.
    const amount = parseNumber(qtyFirst[1]);
    return amount === null ? null : { value: amount, unit: normalizeText('יח׳'), label: 'יח׳' };
  }
  const separator = text.match(/^(.+?)\\s*[-–—:]\\s*(.+)$/);
  if (separator) return parseQuantityPart(separator[2]);
  const suffix = text.match(/^(.+?)\\s+(\\d+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?)\\s*([^\\d].*)?$/);
  if (suffix) {
    const amount = parseNumber(suffix[2]);
    const rawUnit = (suffix[3] || '').trim();
    if (amount !== null) {
      const label = unitAliases[rawUnit] || rawUnit;
      return { value: amount, unit: normalizeText(label || 'יח׳'), label: label || 'יח׳' };
    }
  }
  return null;
}

export function mergeQuantityTexts(...values: string[]): string {
  const parts = values.map(value => value.trim()).filter(Boolean);
  if (!parts.length) return '';
  const parsed = parts.flatMap(value => value.split(/\\s*\\+\\s*/).map(parseOneQuantity));
  if (parsed.length === parts.join(' + ').split(/\\s*\\+\\s*/).length && parsed.every((part): part is ParsedQuantity => part !== null)) {
    const totals = new Map<string, ParsedQuantity>();
    for (const part of parsed) {
      const previous = totals.get(part.unit);
      totals.set(part.unit, {
        value: (previous?.value || 0) + part.value,
        unit: part.unit,
        label: previous?.label || part.label,
      });
    }
    return [...totals.values()].map(part => {
      const value = Number.isInteger(part.value) ? String(part.value) : String(Number(part.value.toFixed(2)));
      return [value, part.label].filter(Boolean).join(' ');
    }).join(' + ');
  }
  return [...new Set(parts)].join(' + ');
}

export function formatIngredientQuantity(rawIngredients: string[], scaleFactor: number): string {
  const amounts = new Map<string, ParsedQuantity>();
  for (const raw of rawIngredients) {
    const text = raw.trim();
    const parsed = parseOneQuantity(text);
    if (!parsed) continue;
    // Parse the quantity from either "name – amount unit" or "amount unit name".
    const separator = text.match(/^(.+?)\\s*[-–—:]\\s*(.+)$/);
    const prefix = text.match(new RegExp('^' + numberPattern + '\\s+(.+)$'));
    const suffix = text.match(/^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*([^\\d].*)?$/);
    const quantityText = separator?.[2] || (prefix ? prefix[1] + ' ' + prefix[2].split(/\\s+/).slice(0, 1).join(' ') : (suffix ? suffix[2] + ' ' + (suffix[3] || '') : ''));
    const valuePart = parseQuantityPart(quantityText) || parsed;
    const value = valuePart.value * scaleFactor;
    const previous = amounts.get(valuePart.unit);
    amounts.set(valuePart.unit, { value: (previous?.value || 0) + value, unit: valuePart.unit, label: valuePart.label });
  }
  return [...amounts.values()].map(part => {
    const value = Number.isInteger(part.value) ? String(part.value) : String(Number(part.value.toFixed(2)));
    return [value, part.label].filter(Boolean).join(' ');
  }).join(' + ');
}
