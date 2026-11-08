type SpreadsheetEngine = typeof import('xlsx');
type PdfEngine = typeof import('pdfjs-dist');

async function loadPdfEngine(): Promise<PdfEngine> {
  const [pdfjsLib, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjsLib;
}
import { LedgerTransaction } from '../types.ts';

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
  sourceFileName?: string;
}

export type StatementParseMethod = 'excel' | 'csv' | 'pdf-text' | 'pdf-ocr' | 'image-ocr';

export interface StatementParseDiagnostics {
  method: StatementParseMethod;
  pages?: number;
  parsedRows: number;
  duplicateRows: number;
  lowConfidenceRows: number;
  note: string;
}

export interface StatementParseProgress {
  phase: 'loading-model' | 'ocr';
  status: string;
  progress?: number;
  page?: number;
  pages?: number;
}

export interface StatementParseResult {
  rows: ImportedStatementRow[];
  diagnostics: StatementParseDiagnostics;
}

const EXPENSE_RULES: Array<[RegExp, string]> = [
  [/שופרסל|רמי לוי|יוחננוף|ויקטורי|מכולת|סופר|מזון|קרפור|מגה|יינות ביתן|אושר עד|מחסני השוק/i, 'מזון וסופרמרקט'],
  [/פז|סונול|דלק|דור אלון|טן |כביש 6|חניון|מוסך|רכב|רב קו|רכבת ישראל|אגד|דן /i, 'תחבורה, דלק ורכב'],
  [/חשמל|חברת חשמל|מים|מי שמש|ארנונה|עיריית|גז|ועד בית|שכירות|משכנתא|עמידר/i, 'דיור וחשבונות (שכירות, ארנונה, חשמל)'],
  [/בזק|פרטנר|סלקום|פלאפון|הוט|יס |אינטרנט|נטפרי/i, 'תקשורת ואינטרנט'],
  [/כללית|מכבי|מאוחדת|לאומית|פארם|סופר-פארם|בית מרקחת|רופא|מרפאה|בית חולים/i, 'בריאות, רפואה וביטוחים'],
  [/גן|מעון|בית ספר|עירייה.*חינוך|צהרון|חוג|אוניברסיטה|מכללה|שכר לימוד/i, 'חינוך, חוגים וילדים'],
  [/קסטרו|פוקס|זארה|h&m|ביגוד|הנעלה|נעליים|בגדים/i, 'קניות, ביגוד והנעלה'],
  [/מסעדה|קפה|ארומה|בורגר|פיצה|וולט|תן ביס|משלוחה|בית קפה/i, 'מסעדות, בתי קפה ובילוי'],
  [/ביטוח|הראל|מגדל|מנורה|הפניקס|כלל ביטוח|איילון/i, 'בריאות, רפואה וביטוחים'],
  [/עמלה|דמי ניהול|ריבית חובה|עמלת|שירות בנקאי/i, 'עמלות ושירותים פיננסיים'],
];
const INCOME_RULES: Array<[RegExp, string]> = [
  [/משכורת|שכר עבודה|מעסיק|salary|payroll/i, 'משכורת חודשית'],
  [/ביטוח לאומי|קצבת ילדים|קצבה|קצבת זקנה|נכות|אבטלה/i, 'קצבאות ביטוח לאומי'],
  [/החזר מס|רשות המסים|החזר|זיכוי|refund/i, 'החזר מס / תגמולים'],
  [/שכירות|שכר דירה|דמי שכירות/i, 'שכר דירה / הכנסה פסיבית'],
  [/פנסיה|תגמול|משרד הביטחון|מלגה|תמיכה/i, 'הכנסה אחרת'],
  [/מכירת|הכנסה מעסק|חשבונית|לקוח|עצמאי/i, 'הכנסה מעסק / עצמאי'],
];

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
export const normalizeStatementPayee = (value: string) => value.normalize('NFKC').toLocaleLowerCase('he-IL').replace(/[\u0591-\u05C7]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
const normalizeHeader = (v: unknown) => clean(v).replace(/^\uFEFF/, '').toLowerCase().replace(/[\s_״"'׳-]/g, '');

function parseDate(value: unknown, xlsx?: SpreadsheetEngine): string | null {
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
    const d = xlsx?.SSF.parse_date_code(value);
    return d ? toIso(d.y, d.m, d.d) : null;
  }
  const s = clean(value);
  // Some bank exports store Excel serial dates as text rather than numeric cells.
  if (/^\d{5}(?:\.\d+)?$/.test(s)) {
    const d = xlsx?.SSF.parse_date_code(Number(s));
    if (d) return toIso(d.y, d.m, d.d);
  }
  // Ignore a time suffix while retaining the date portion.
  const datePart = s.match(/^(\d{1,4}[./-]\d{1,2}[./-]\d{1,4})(?:[ T].*)?$/)?.[1] || s;
  // Check year-first forms before day-first forms; otherwise YYYY-MM-DD
  // can be misread as an impossible day/month/date tuple.
  let m = datePart.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = datePart.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? Number(m[3]) + 2000 : Number(m[3]);
    return toIso(year, Number(m[2]), Number(m[1]));
  }
  return null;
}

export function parseStatementAmount(value: unknown): number | null {
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

  // Accept both Israeli/US (1,234.56) and European (1.234,56)
  // exports. A lone comma followed by 1–2 digits is a decimal separator.
  if (s.includes('.') && s.includes(',')) {
    if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(s)) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (!/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(s)) {
      return null;
    }
  } else if (!s.includes('.')) {
    s = s.replace(/,(\d{1,2})$/, '.$1');
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) {
    // European thousands separator without a decimal fraction, e.g. 1.234.
    s = s.replace(/\./g, '');
  }
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

function rowFromValues(values: unknown[], headers: string[], index: number, xlsx: SpreadsheetEngine): ImportedStatementRow | null {
  const find = (aliases: string[]) => {
    const exact = headers.findIndex(h => aliases.includes(h));
    const starts = headers.findIndex(h => aliases.some(t => h.startsWith(t)));
    const contains = headers.findIndex(h => !h.includes('יתרה') && !h.includes('balance') && aliases.some(t => h.includes(t)));
    const i = exact >= 0 ? exact : starts >= 0 ? starts : contains;
    return i >= 0 ? values[i] : undefined;
  };
  const date = parseDate(find(['תאריךעסקה','תאריךתנועה','תאריך','date','transactiondate','valuedate','תאריךערך']), xlsx);
  const payee = clean(find(['תיאורעסקה','תיאור','פרטי','פרטים','שםביתעסק','ביתעסק','שםמוטב','מוטב','שםפעולה','פעולה','description','details','payee','merchant','transactiondetails']));
  const direction = clean(find(['סוגתנועה','סוגפעולה','חובהזכות','סוג','type','transactiontype','debitcredit'])).toLowerCase();
  const debit = parseStatementAmount(find(['חובה','סכוםלחיוב','סכוםחובה','בחובה','חיוב','debit','withdrawal']));
  const credit = parseStatementAmount(find(['זכות','סכוםלזכות','סכוםזכות','בזכות','זיכוי','credit','deposit']));
  const amountCell = parseStatementAmount(find(['סכום','amount','סכוםהתנועה','תנועה']));
  let amount: number | null = amountCell;
  let amountColumnType: 'INCOME' | 'EXPENSE' | null = null;
  const hasDebitAmount = debit !== null && Math.abs(debit) > 0;
  const hasCreditAmount = credit !== null && Math.abs(credit) > 0;
  // Some exports put zero in both debit/credit columns while the actual value
  // is stored in a separate Amount column. Only use debit/credit when one side
  // contains a non-zero amount; ambiguous rows fall back to Amount for review.
  if (hasCreditAmount && !hasDebitAmount) {
    amount = Math.abs(credit!);
    amountColumnType = 'INCOME';
  } else if (hasDebitAmount && !hasCreditAmount) {
    amount = -Math.abs(debit!);
    amountColumnType = 'EXPENSE';
  } else if (hasCreditAmount && hasDebitAmount) {
    amount = amountCell;
  }
  if (!date || !payee || amount === null || amount === 0) return null;
  const directionIsIncome = /זכות|זיכוי|הפקדה|קבלה|credit|deposit|income|כניסה/.test(direction);
  const directionIsExpense = /חובה|חיוב|משיכה|תשלום|debit|withdrawal|expense|יציאה/.test(direction);
  const payeeSuggestsIncome = INCOME_RULES.some(([pattern]) => pattern.test(payee));
  const payeeSuggestsExpense = EXPENSE_RULES.some(([pattern]) => pattern.test(payee));
  // Explicit debit/credit columns are stronger evidence than merchant-name heuristics.
  const type = amountColumnType || (amount < 0 || (directionIsExpense && !directionIsIncome)
    ? 'EXPENSE'
    : directionIsIncome || (payeeSuggestsIncome && !payeeSuggestsExpense) ? 'INCOME' : 'EXPENSE');
  const suggestion = categorize(payee, type);
  const confidence = amountColumnType || directionIsIncome || directionIsExpense || payeeSuggestsIncome || payeeSuggestsExpense
    ? 'high' as const
    : 'low' as const;
  return { id: `row_${index}_${date}_${Math.abs(amount)}`, date, payee, amountCents: Math.abs(amount), type, category: suggestion.category, confidence, duplicate: false, sourceText: values.map(clean).join(' | ') };
}

function parseTabularRows(rows: unknown[][], xlsx: SpreadsheetEngine): ImportedStatementRow[] {
  if (rows.length < 2) return [];
  const headerIndex = rows.findIndex(row => row.some(cell => /תאריך|date/i.test(clean(cell))) && row.some(cell => /סכום|amount|חובה|זכות|debit|credit/i.test(clean(cell))));
  if (headerIndex < 0) throw new Error('לא זוהו כותרות עמודות מוכרות. נדרש קובץ עם עמודות תאריך, תיאור וסכום/חובה/זכות.');
  const headers = rows[headerIndex].map(normalizeHeader);
  const parsed = rows.slice(headerIndex + 1).map((row, i) => rowFromValues(row, headers, i, xlsx)).filter((x): x is ImportedStatementRow => Boolean(x));
  if (!parsed.length) throw new Error('נמצאו כותרות, אך לא זוהו שורות תנועה תקינות. בדוק שקיימות עמודות תאריך, תיאור וסכום ושפורמט התאריך מוכר.');
  return parsed;
}

async function extractPdfText(pdf: any): Promise<string> {
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

export function parsePdfLines(text: string): ImportedStatementRow[] {
  const rows: ImportedStatementRow[] = [];
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const hasBalanceColumn = lines.some(line =>
    /(?:יתרה|balance)/i.test(line) && /(?:תאריך|date|חובה|זכות|debit|credit)/i.test(line)
  );
  const datePattern = /(?:^|\s)(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})(?=\s|$)/;
  const amountPattern = /(?:₪\s*)?\(?[-−]?(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?\)?(?:\s*₪)?/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;
    const date = parseDate(dateMatch[1]);
    if (!date) continue;
    const rest = line.replace(dateMatch[1], ' ');
    const candidates = [...rest.matchAll(amountPattern)]
      .map(match => ({ raw: match[0], index: match.index ?? 0, value: parseStatementAmount(match[0]) }))
      .filter(item => item.value !== null && item.value !== 0);
    if (!candidates.length) continue;
    const marked = candidates.filter(item => /₪|[.,]\d{1,2}/.test(item.raw));
    // In bank PDFs the final numeric column is often a running balance.
    // When two currency/decimal values exist, use the one immediately before it.
    let selected = candidates.at(-1)!;
    if (marked.length >= 2) {
      selected = marked[marked.length - 2];
    } else if (hasBalanceColumn && candidates.length >= 2) {
      // When the statement header explicitly declares a balance column,
      // the last numeric field is the running balance even if both values
      // are whole numbers without decimal/currency markers.
      selected = candidates[candidates.length - 2];
    } else if (marked.length === 1) {
      const markedIndex = candidates.indexOf(marked[0]);
      selected = markedIndex === candidates.length - 1 && candidates.length > 1
        ? candidates[markedIndex - 1]
        : marked[0];
    }
    const rawAmount = selected.value!;
    const before = rest.slice(0, selected.index);
    const after = rest.slice(selected.index + selected.raw.length);
    const payee = clean([before, after].filter(Boolean).join(' ')
      .replace(new RegExp(amountPattern.source, 'g'), ' ')
      .replace(/(?:אסמכתא|מספר פעולה|יתרה|balance|reference|אסמכתה)[:#]?\s*\d+/gi, ' ')
      .replace(/[|:·-]+/g, ' ')
      .replace(/\b\d{4,}\b/g, ' '));
    if (payee.length < 2 || /^\d+$/.test(payee)) continue;
    const lower = line.toLowerCase();
    const isIncome = /זכות|זיכוי|הפקדה|משכורת|מעסיק|קצבה|ביטוח לאומי|החזר|העברה נכנסת|credit|deposit|salary|payroll|refund|reversal/.test(lower);
    const isExpense = /חובה|חיוב|משיכה|תשלום|הוראת קבע|כרטיס|עמלה|העברה יוצאת|debit|withdrawal|purchase|payment|fee/.test(lower);
    const type = rawAmount < 0 || (isExpense && !isIncome) ? 'EXPENSE' : isIncome && !isExpense ? 'INCOME' : 'EXPENSE';
    const suggestion = categorize(payee, type);
    const confidence = isIncome || isExpense || rawAmount < 0 ? 'medium' : 'low';
    rows.push({
      id: 'pdf_' + i + '_' + date + '_' + Math.abs(rawAmount),
      date,
      payee,
      amountCents: Math.abs(rawAmount),
      type,
      category: suggestion.category,
      confidence: candidates.length > 1 ? 'low' : confidence,
      duplicate: false,
      sourceText: line,
    });
  }
  return rows;
}

const OCR_LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0';
const MAX_OCR_PDF_PAGES = 20;

async function createLocalOcrWorker(onProgress?: (progress: StatementParseProgress) => void): Promise<any> {
  onProgress?.({ phase: 'loading-model', status: 'טוען מנוע OCR ומודל עברית למחשב...' });
  const { createWorker } = await import('tesseract.js');
  return createWorker(['heb', 'eng'], 1, {
    langPath: OCR_LANG_PATH,
    cacheMethod: 'write',
    logger: (message: { status?: string; progress?: number }) => {
      const progress = typeof message.progress === 'number' ? message.progress : undefined;
      onProgress?.({
        phase: 'loading-model',
        status: message.status || 'טוען מנוע זיהוי...',
        progress,
      });
    },
  });
}

async function recognizePdfLocally(
  pdf: any,
  onProgress?: (progress: StatementParseProgress) => void,
): Promise<string> {
  if (pdf.numPages > MAX_OCR_PDF_PAGES) {
    throw new Error('ה-PDF כולל ' + pdf.numPages + ' עמודים. כדי למנוע עומס על המחשב, OCR מקומי מוגבל ל-' + MAX_OCR_PDF_PAGES + ' עמודים בכל קובץ. פצל את המסמך ונסה שוב.');
  }
  const worker = await createLocalOcrWorker(onProgress);
  const pageTexts: string[] = [];
  try {
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      onProgress?.({
        phase: 'ocr',
        status: 'מזהה טקסט בעמוד ' + pageNo + ' מתוך ' + pdf.numPages + '...',
        progress: (pageNo - 1) / pdf.numPages,
        page: pageNo,
        pages: pdf.numPages,
      });
      const page = await pdf.getPage(pageNo);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('הדפדפן לא הצליח ליצור משטח תמונה לעיבוד ה-PDF.');
      await page.render({ canvasContext: context, viewport } as any).promise;
      const result = await worker.recognize(canvas);
      pageTexts.push(String(result.data.text || ''));
      canvas.width = 0;
      canvas.height = 0;
      onProgress?.({
        phase: 'ocr',
        status: 'הסתיים זיהוי עמוד ' + pageNo + ' מתוך ' + pdf.numPages,
        progress: pageNo / pdf.numPages,
        page: pageNo,
        pages: pdf.numPages,
      });
    }
  } finally {
    await worker.terminate();
  }
  return pageTexts.join('\n');
}

async function recognizeImageLocally(
  file: File,
  onProgress?: (progress: StatementParseProgress) => void,
): Promise<string> {
  const worker = await createLocalOcrWorker(onProgress);
  try {
    onProgress?.({ phase: 'ocr', status: 'מזהה טקסט בתמונה במחשב...', progress: 0 });
    const result = await worker.recognize(file);
    onProgress?.({ phase: 'ocr', status: 'זיהוי התמונה הושלם', progress: 1 });
    return String(result.data.text || '');
  } finally {
    await worker.terminate();
  }
}

function attachDuplicateFlags(
  rows: ImportedStatementRow[],
  fileName: string,
  existing: LedgerTransaction[],
): ImportedStatementRow[] {
  const seen = new Set(existing.map(tx => [tx.date, tx.type, tx.amountCents, normalizeStatementPayee(tx.payee)].join('|')));
  const batch = new Set<string>();
  return rows.map(row => {
    const key = [row.date, row.type, row.amountCents, normalizeStatementPayee(row.payee)].join('|');
    const duplicate = seen.has(key) || batch.has(key);
    batch.add(key);
    return { ...row, sourceFileName: fileName, duplicate };
  });
}

const MAX_TABULAR_FILE_BYTES = 15 * 1024 * 1024;

export async function parseStatementFileWithDiagnostics(
  file: File,
  existing: LedgerTransaction[],
  onProgress?: (progress: StatementParseProgress) => void,
): Promise<StatementParseResult> {
  const ext = file.name.toLowerCase().split('.').pop();
  if ((ext === 'xlsx' || ext === 'xls' || ext === 'csv') && file.size > MAX_TABULAR_FILE_BYTES) {
    throw new Error('קובץ Excel או CSV גדול מדי. ניתן לייבא קבצים עד 15MB כדי לצמצם עומס וסיכון בעת פענוח קבצים חיצוניים.');
  }
  let rows: ImportedStatementRow[] = [];
  let method: StatementParseMethod;
  let pages: number | undefined;
  let note = '';

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true, raw: true, cellFormula: false, cellHTML: false });
    const sheetErrors: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as unknown[][];
      try {
        const sheetTransactions = parseTabularRows(sheetRows, XLSX);
        rows.push(...sheetTransactions.map(row => ({ ...row, id: sheetName + '_' + row.id })));
      } catch (error) {
        sheetErrors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (!rows.length) {
      const detail = sheetErrors.find(message => message.includes('לא זוהו כותרות')) || sheetErrors[0];
      throw new Error(detail || 'לא נמצאו תנועות באף גיליון בקובץ Excel. ודא שהקובץ כולל טבלת תנועות עם תאריך, תיאור וסכום.');
    }
    method = 'excel';
    note = 'זוהו ' + rows.length + ' שורות מקובצי Excel. גיליונות סיכום ללא טבלת תנועות דולגו.';
  } else if (ext === 'csv') {
    const XLSX = await import('xlsx');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const utf8 = new TextDecoder('utf-8').decode(bytes);
    const csvText = utf8.includes('\uFFFD') ? new TextDecoder('windows-1255').decode(bytes) : utf8;
    const workbook = XLSX.read(csvText, { type: 'string', cellDates: true, cellFormula: false, cellHTML: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('קובץ ה-CSV ריק או שלא ניתן לזהות בו טבלה.');
    const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as unknown[][];
    rows = parseTabularRows(sheetRows, XLSX);
    method = 'csv';
    note = 'נקראו ' + rows.length + ' שורות תנועה מקובץ CSV.';
  } else if (ext === 'pdf') {
    const pdfjsLib = await loadPdfEngine();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
    pages = pdf.numPages;
    const extractedText = await extractPdfText(pdf);
    rows = parsePdfLines(extractedText);
    if (rows.length) {
      method = 'pdf-text';
      note = 'הטקסט חולץ מתוך שכבת הטקסט של ה-PDF. מבנה עמודות של בנקים שונים אינו אחיד ולכן חובה לבדוק את השורות לפני אישור.';
    } else {
      onProgress?.({ phase: 'loading-model', status: 'לא נמצאה שכבת טקסט. מפעיל OCR מקומי למסמך הסרוק...' });
      const ocrText = await recognizePdfLocally(pdf, onProgress);
      rows = parsePdfLines(ocrText).map(row => ({ ...row, confidence: 'low' }));
      if (!rows.length) {
        throw new Error('ה-OCR המקומי לא הצליח לזהות שורות תנועה. ייתכן שהסריקה מטושטשת, שהמסמך מוגן או שמבנה הטבלה דורש מיפוי ייעודי לבנק.');
      }
      method = 'pdf-ocr';
      note = 'המסמך הסרוק פוענח באמצעות OCR בדפדפן. ה-PDF עצמו לא נשלח לשרת; כל השורות סומנו לבדיקה ידנית בגלל אי-ודאות של זיהוי תמונה.';
    }
  } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
    const ocrText = await recognizeImageLocally(file, onProgress);
    rows = parsePdfLines(ocrText).map(row => ({ ...row, confidence: 'low' }));
    if (!rows.length) {
      throw new Error('לא זוהו תנועות בתמונה. ודא שהתמונה חדה, כוללת תאריכים וסכומים, ונסה צילום ישר ומואר יותר.');
    }
    method = 'image-ocr';
    note = 'התמונה פוענחה באמצעות OCR בדפדפן. התמונה לא נשלחה לשרת; יש לבדוק כל שורה לפני אישור.';
  } else {
    throw new Error('בשלב זה קליטת תנועות נתמכת ב-PDF, Excel, CSV ותמונות PNG/JPG/WebP.');
  }

  const attachedRows = attachDuplicateFlags(rows, file.name, existing);
  const diagnostics: StatementParseDiagnostics = {
    method,
    pages,
    parsedRows: attachedRows.length,
    duplicateRows: attachedRows.filter(row => row.duplicate).length,
    lowConfidenceRows: attachedRows.filter(row => row.confidence === 'low').length,
    note,
  };
  return { rows: attachedRows, diagnostics };
}

export async function parseStatementFile(
  file: File,
  existing: LedgerTransaction[],
): Promise<ImportedStatementRow[]> {
  const result = await parseStatementFileWithDiagnostics(file, existing);
  return result.rows;
}
