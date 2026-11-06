import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { LedgerTransaction, TransactionType } from '../types.ts';

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
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = clean(value);
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? Number(m[3]) + 2000 : Number(m[3]);
    const day = Number(m[1]), month = Number(m[2]);
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`;
  return null;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
  let s = clean(value).replace(/[₪$€£\s]/g, '').replace(/,/g, '');
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()−-]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return negative ? -cents : cents;
}

function categorize(payee: string, type: 'INCOME' | 'EXPENSE') {
  const rules = type === 'INCOME' ? INCOME_RULES : EXPENSE_RULES;
  const match = rules.find(([pattern]) => pattern.test(payee));
  return match ? { category: match[1], confidence: 'high' as const } :
    { category: type === 'INCOME' ? 'הכנסה אחרת' : 'הוצאות שונות', confidence: 'low' as const };
}

function rowFromValues(values: unknown[], headers: string[], index: number): ImportedStatementRow | null {
  const find = (terms: string[]) => {
    const i = headers.findIndex(h => terms.some(t => h.includes(t)));
    return i >= 0 ? values[i] : undefined;
  };
  const date = parseDate(find(['תאריךעסקה','תאריך','date','valuedate','תאריךערך']));
  const payee = clean(find(['תיאור','פרטים','ביתעסק','מוטב','פעולה','אסמכתא','description','details','payee','merchant','שםפעולה']));
  let amount = parseAmount(find(['סכום','amount','חיובזכות','תנועה']));
  const debit = parseAmount(find(['חובה','debit','חיוב']));
  const credit = parseAmount(find(['זכות','credit','זיכוי']));
  if (debit !== null || credit !== null) {
    amount = (credit && Math.abs(credit)) || (debit && -Math.abs(debit)) || 0;
  }
  if (!date || !payee || amount === null || amount === 0) return null;
  const type = amount > 0 ? 'INCOME' : 'EXPENSE';
  const suggestion = categorize(payee, type);
  return { id: `row_${index}_${date}_${Math.abs(amount)}`, date, payee, amountCents: Math.abs(amount), type, category: suggestion.category, confidence: suggestion.confidence, duplicate: false, sourceText: values.map(clean).join(' | ') };
}

function parseTabularRows(rows: unknown[][]): ImportedStatementRow[] {
  if (rows.length < 2) return [];
  const headerIndex = rows.findIndex(row => row.some(cell => /תאריך|date/i.test(clean(cell))) && row.some(cell => /סכום|amount|חובה|זכות|debit|credit/i.test(clean(cell))));
  if (headerIndex < 0) throw new Error('לא זוהו כותרות עמודות מוכרות. נדרש קובץ עם עמודות תאריך, תיאור וסכום.');
  const headers = rows[headerIndex].map(normalizeHeader);
  return rows.slice(headerIndex + 1).map((row, i) => rowFromValues(row, headers, i)).filter((x): x is ImportedStatementRow => Boolean(x));
}

async function extractPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str?: string; transform?: number[] }>;
    const byY = new Map<number, string[]>();
    for (const item of items) {
      const str = clean(item.str);
      if (!str) continue;
      const y = Math.round(item.transform?.[5] ?? 0);
      byY.set(y, [...(byY.get(y) || []), str]);
    }
    pages.push([...byY.entries()].sort((a, b) => b[0] - a[0]).map(([, parts]) => parts.join(' ')).join('\n'));
  }
  return pages.join('\n');
}

function parsePdfLines(text: string): ImportedStatementRow[] {
  const rows: ImportedStatementRow[] = [];
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(/(?:^|\s)(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})(?:\s|$)/);
    if (!dateMatch) continue;
    const date = parseDate(dateMatch[1]);
    if (!date) continue;
    const rest = line.replace(dateMatch[1], ' ');
    const amounts = [...rest.matchAll(/(?:₪\s*)?(-?\d[\d,]*\.\d{2}|-?\d[\d,]+)(?:\s*₪)?/g)];
    if (!amounts.length) continue;
    const last = amounts[amounts.length - 1];
    const rawAmount = parseAmount(last[0]);
    if (!rawAmount || rawAmount === 0) continue;
    const payee = clean(rest.slice(0, last.index).replace(/[|:·-]+$/g, ''));
    if (payee.length < 2) continue;
    const type = rawAmount > 0 ? 'INCOME' : 'EXPENSE';
    const suggestion = categorize(payee, type);
    rows.push({ id: `pdf_${i}_${date}_${Math.abs(rawAmount)}`, date, payee, amountCents: Math.abs(rawAmount), type, category: suggestion.category, confidence: 'medium', duplicate: false, sourceText: line });
  }
  return rows;
}

export async function parseStatementFile(file: File, existing: LedgerTransaction[]): Promise<ImportedStatementRow[]> {
  const ext = file.name.toLowerCase().split('.').pop();
  let rows: ImportedStatementRow[] = [];
  if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true, raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = parseTabularRows(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as unknown[][]);
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
