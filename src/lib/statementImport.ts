import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { LedgerTransaction } from '../types.ts';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ImportedStatementRow {
  id: string;
  date: string;
  payee: string;
  amountCents: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  confidence: 'high' | 'medium' | 'low';
  duplicate: boolean;
  sourceText: string;
}

const EXPENSE_RULES: Array<[RegExp, string]> = [
  [/שופרסל|רמי לוי|יוחננוף|ויקטורי|מכולת|סופר|מזון|קרפור|מגה|יינות ביתן/i, 'מזון וסופרמרקט'],
  [/פז|סונול|דלק|דור אלון|טן |כביש 6|חניון|מוסך|רכב/i, 'תחבורה, דלק ורכב'],
  [/חשמל|חברת חשמל|מים|מי שמש|ארנונה|עיריית|גז|ועד בית/i, 'דיור וחשבונות (שכירות, ארנונה, חשמל)'],
  [/בזק|פרטנר|סלקום|פלאפון|הוט|יס |אינטרנט/i, 'תקשורת ואינטרנט'],
  [/כללית|מכבי|מאוחדת|לאומית|פארם|סופר-פארם|בית מרקחת|רופא/i, 'בריאות, רפואה וביטוחים'],
  [/גן|מעון|בית ספר|עירייה.*חינוך|צהרון|חוג/i, 'חינוך, חוגים וילדים'],
  [/קסטרו|פוקס|זארה|h&m|ביגוד|הנעלה/i, 'קניות, ביגוד והנעלה'],
  [/מסעדה|קפה|ארומה|קפה|בורגר|פיצה|וולט|תן ביס/i, 'מסעדות, בתי קפה ובילוי'],
];
const INCOME_RULES: Array<[RegExp, string]> = [
  [/משכורת|שכר|מעסיק|salary/i, 'משכורת חודשית'],
  [/ביטוח לאומי|קצבה|ילדים/i, 'קצבאות ביטוח לאומי'],
  [/החזר מס|רשות המסים/i, 'החזר מס / תגמולים'],
  [/שכירות|שכר דירה/i, 'שכר דירה / הכנסה פסיבית'],
];

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const normalizeHeader = (v: unknown) => clean(v).toLowerCase().replace(/[\s_״"'׳-]/g, '');

function parseDate(value: unknown): string | null {
  const toIso = (year: number, month: number, day: number): string | null => {
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) return null;
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIso(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const d = XLSX.SSF.parse_date_code(value);
    return d ? toIso(d.y, d.m, d.d) : null;
  }
  const s = clean(value);
  // Some bank exports store Excel serial dates as text rather than numeric cells.
  if (/^\d{5}(?:\.\d+)?$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s));
    if (d) return toIso(d.y, d.m, d.d);
  }
  // Ignore a time suffix while retaining the date portion.
  const datePart = s.match(/^(\d{1,4}[./-]\d{1,2}[./-]\d{1,4})(?:[ T].*)?$/)?.[1] || s;
  let m = datePart.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? Number(m[3]) + 2000 : Number(m[3]);
    return toIso(year, Number(m[2]), Number(m[1]));
  }
  m = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const scaled = value * 100;
    const cents = Math.round(scaled);
    return Number.isSafeInteger(cents) && Math.abs(scaled - cents) < 0.000001 ? cents : null;
  }

  let s = clean(value).replace(/[₪$€£\s]/g, '');
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || /^[-−]/.test(s);
  if (/^\(.*\)$/.test(s)) s = s.slice(1, -1);
  else if (/^[-−]/.test(s)) s = s.slice(1);

  // Accept standard thousands separators and decimal-comma exports, but
  // never turn malformed values such as "1,23" into 123.
  if (!s.includes('.')) s = s.replace(/,(\d{1,2})$/, '.$1');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s.replace(/,/g, '')) * 100);
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

function categorize(payee: string, type: 'INCOME' | 'EXPENSE') {
  const rules = type === 'INCOME' ? INCOME_RULES : EXPENSE_RULES;
  const match = rules.find(([pattern]) => pattern.test(payee));
  return match ? { category: match[1], confidence: 'high' as const } :
    { category: type === 'INCOME' ? 'הכנסה אחרת' : 'הוצאות שונות', confidence: 'low' as const };
}

function rowFromValues(values: unknown[], headers: string[], index: number): ImportedStatementRow | null {
  const find = (aliases: string[]) => {
    const exact = headers.findIndex(h => aliases.includes(h));
    const i = exact >= 0 ? exact : headers.findIndex(h => aliases.some(t => h.startsWith(t)));
    return i >= 0 ? values[i] : undefined;
  };
  const date = parseDate(find(['תאריךעסקה','תאריךתנועה','תאריך','date','transactiondate','valuedate','תאריךערך']));
  const payee = clean(find(['תיאורעסקה','תיאור','פרטים','שםביתעסק','ביתעסק','מוטב','שםפעולה','פעולה','description','details','payee','merchant','transactiondetails']));
  const debit = parseAmount(find(['חובה','סכוםלחיוב','חיוב','debit','withdrawal']));
  const credit = parseAmount(find(['זכות','סכוםלזכות','זיכוי','credit','deposit']));
  const amountCell = parseAmount(find(['סכום','amount','סכוםהתנועה','תנועה']));
  let amount: number | null = amountCell;
  if (debit !== null || credit !== null) {
    amount = credit !== null && Math.abs(credit) > 0 ? Math.abs(credit) :
      debit !== null && Math.abs(debit) > 0 ? -Math.abs(debit) : 0;
  }
  if (!date || !payee || amount === null || amount === 0) return null;
  const type = amount > 0 ? 'INCOME' : 'EXPENSE';
  const suggestion = categorize(payee, type);
  return { id: `row_${index}_${date}_${Math.abs(amount)}`, date, payee, amountCents: Math.abs(amount), type, category: suggestion.category, confidence: suggestion.confidence, duplicate: false, sourceText: values.map(clean).join(' | ') };
}

function parseTabularRows(rows: unknown[][]): ImportedStatementRow[] {
  if (rows.length < 2) return [];
  const headerIndex = rows.findIndex(row => row.some(cell => /תאריך|date/i.test(clean(cell))) && row.some(cell => /סכום|amount|חובה|זכות|debit|credit/i.test(clean(cell))));
  if (headerIndex < 0) throw new Error('לא זוהו כותרות עמודות מוכרות. נדרש קובץ עם עמודות תאריך, תיאור וסכום/חובה/זכות.');
  const headers = rows[headerIndex].map(normalizeHeader);
  const parsed = rows.slice(headerIndex + 1).map((row, i) => rowFromValues(row, headers, i)).filter((x): x is ImportedStatementRow => Boolean(x));
  if (!parsed.length) throw new Error('נמצאו כותרות, אך לא זוהו שורות תנועה תקינות. בדוק שקיימות עמודות תאריך, תיאור וסכום ושפורמט התאריך מוכר.');
  return parsed;
}

async function extractPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const items = (content.items as Array<{ str?: string; transform?: number[] }>)
      .map((item, order) => ({ text: clean(item.str), x: item.transform?.[4] ?? 0, y: item.transform?.[5] ?? 0, order }))
      .filter(item => item.text)
      .sort((a, b) => b.y - a.y || a.order - b.order);
    const lines: Array<{ y: number; items: typeof items }> = [];
    for (const item of items) {
      let line = lines.find(candidate => Math.abs(candidate.y - item.y) <= 2.5);
      if (!line) { line = { y: item.y, items: [] }; lines.push(line); }
      line.items.push(item);
    }
    pages.push(lines.sort((a, b) => b.y - a.y)
      .map(line => line.items.sort((a, b) => a.order - b.order).map(item => item.text).join(' '))
      .join('\n'));
  }
  return pages.join('\n');
}

function parsePdfLines(text: string): ImportedStatementRow[] {
  const rows: ImportedStatementRow[] = [];
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const datePattern = /(?:^|\s)(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})(?=\s|$)/;
  const amountPattern = /(?:₪\s*)?\(?-?\d[\d,]*(?:\.\d{1,2})?\)?(?:\s*₪)?/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;
    const date = parseDate(dateMatch[1]);
    if (!date) continue;
    const rest = line.replace(dateMatch[1], ' ');
    const candidates = [...rest.matchAll(amountPattern)]
      .map(match => ({ raw: match[0], index: match.index ?? 0, value: parseAmount(match[0]) }))
      .filter(item => item.value !== null && item.value !== 0);
    if (!candidates.length) continue;
    const marked = candidates.filter(item => /₪|\.\d{1,2}/.test(item.raw));
    const selected = (marked.length ? marked : candidates).at(-1)!;
    const rawAmount = selected.value!;
    const before = rest.slice(0, selected.index);
    const after = rest.slice(selected.index + selected.raw.length);
    const payee = clean([before, after].filter(Boolean).join(' ').replace(/(?:אסמכתא|מספר פעולה|יתרה|balance|reference)[:#]?\s*\d+/gi, '').replace(/[|:·-]+/g, ' '));
    if (payee.length < 2 || /^\d+$/.test(payee)) continue;
    const lower = line.toLowerCase();
    const isIncome = /זכות|זיכוי|הפקדה|משכורת|קצבה|העברה נכנסת|credit|deposit|salary|refund|reversal/.test(lower);
    const isExpense = /חובה|חיוב|משיכה|תשלום|הוראת קבע|כרטיס|עמלה|העברה יוצאת|debit|withdrawal|purchase|payment|fee/.test(lower);
    const type = rawAmount < 0 || (isExpense && !isIncome) ? 'EXPENSE' : isIncome && !isExpense ? 'INCOME' : rawAmount > 0 && !isExpense ? 'INCOME' : 'EXPENSE';
    const suggestion = categorize(payee, type);
    const confidence = isIncome || isExpense || rawAmount < 0 ? 'medium' : suggestion.confidence === 'high' ? 'medium' : 'low';
    rows.push({ id: `pdf_${i}_${date}_${Math.abs(rawAmount)}`, date, payee, amountCents: Math.abs(rawAmount), type, category: suggestion.category, confidence, duplicate: false, sourceText: line });
  }
  return rows;
}

export async function parseStatementFile(file: File, existing: LedgerTransaction[]): Promise<ImportedStatementRow[]> {
  const ext = file.name.toLowerCase().split('.').pop();
  let rows: ImportedStatementRow[] = [];
  if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true, raw: true });
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as unknown[][];
      try { rows.push(...parseTabularRows(sheetRows)); } catch { /* Ignore cover and summary sheets. */ }
    }
    if (!rows.length) throw new Error('לא נמצאו תנועות באף גיליון בקובץ Excel. ודא שהקובץ כולל טבלת תנועות עם תאריך, תיאור וסכום.');
  } else if (ext === 'csv') {
    const text = await file.text();
    const workbook = XLSX.read(text, { type: 'string', cellDates: true });
    rows = parseTabularRows(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: true, defval: '' }) as unknown[][]);
  } else if (ext === 'pdf') {
    const text = await extractPdfText(file);
    rows = parsePdfLines(text);
    if (!rows.length) throw new Error('לא נמצאו תנועות קריאות ב-PDF. ייתכן שזה PDF סרוק כתמונה או שהמבנה של הבנק שונה; במקרה כזה נדרש OCR או מיפוי מותאם.');
  } else {
    throw new Error('בשלב זה קליטת תנועות נתמכת ב-PDF, Excel ו-CSV.');
  }
  const seen = new Set(existing.map(tx => [tx.date, tx.type, tx.amountCents, tx.payee.trim().toLowerCase()].join('|')));
  const batch = new Set<string>();
  return rows.map(row => {
    const key = [row.date, row.type, row.amountCents, row.payee.trim().toLowerCase()].join('|');
    const duplicate = seen.has(key) || batch.has(key);
    batch.add(key);
    return { ...row, duplicate };
  });
}
