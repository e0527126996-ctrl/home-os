import type { MortgageTrack, MortgageTrackType } from '../types.ts';
import { extractStatementDocumentText, parseStatementAmount, type StatementParseProgress, type StatementParseMethod } from './statementImport.ts';
export interface MortgageExtraction {
  reportDate?: string; outstandingBalanceCents?: number; monthlyPaymentCents?: number; nextPaymentDate?: string;
  tracks: MortgageTrack[]; confidence: 'high' | 'medium' | 'low'; method: StatementParseMethod; pages?: number;
  detectedFields: string[]; warnings: string[];
}
const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
function parseIsoDate(value: string): string | undefined {
  const match = value.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})|(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (!match) return undefined;
  let year: number, month: number, day: number;
  if (match[4]) { year = Number(match[4]); month = Number(match[5]); day = Number(match[6]); }
  else { day = Number(match[1]); month = Number(match[2]); year = Number(match[3]); if (year < 100) year += 2000; }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (year < 2000 || year > 2100 || d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return undefined;
  return String(year) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}
function amountCandidates(line: string): number[] {
  const s = line.replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, ' ').replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, ' ');
  return [...s.matchAll(/(?:₪\s*)?[-−]?\d[\d,.]*(?:\s*₪)?/g)]
    .map(m => ({ raw: m[0], value: parseStatementAmount(m[0]) }))
    .filter((x): x is {raw:string;value:number} => x.value !== null && x.value > 0 && /\d{4}/.test(x.raw.replace(/[^\d]/g, '')))
    .map(x => x.value);
}
function valueForLabels(lines: string[], label: RegExp): number | undefined {
  for (let i = 0; i < lines.length; i++) if (label.test(lines[i])) {
    const values = amountCandidates(lines[i]);
    if (values.length) return values[values.length - 1];
    const next = amountCandidates(lines[i + 1] || '');
    if (next.length === 1) return next[0];
  }
  return undefined;
}
function trackType(s: string): MortgageTrackType {
  if (/פריים|prime/i.test(s)) return 'PRIME';
  if (/קבועה.{0,12}לא.?צמודה|קל.?צ|fixed.{0,12}unlinked/i.test(s)) return 'FIXED_UNLINKED';
  if (/קבועה.{0,12}צמודה|ק.?צ|fixed.{0,12}linked/i.test(s)) return 'FIXED_LINKED';
  if (/משתנה.{0,12}לא.?צמודה|variable.{0,12}unlinked/i.test(s)) return 'VARIABLE_UNLINKED';
  if (/משתנה.{0,12}צמודה|variable.{0,12}linked/i.test(s)) return 'VARIABLE_LINKED';
  if (/זכאות|eligible/i.test(s)) return 'ELIGIBLE';
  return 'OTHER';
}
const trackLabels: Record<MortgageTrackType,string> = {
  PRIME:'פריים', FIXED_UNLINKED:'קבועה לא צמודה', FIXED_LINKED:'קבועה צמודה',
  VARIABLE_UNLINKED:'משתנה לא צמודה', VARIABLE_LINKED:'משתנה צמודה', ELIGIBLE:'זכאות', OTHER:'מסלול נוסף',
};
export function parseMortgageText(text: string, method: StatementParseMethod = 'pdf-text', pages?: number): MortgageExtraction {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const all = lines.join(' ');
  const dateLine = lines.find(line => /נכון ל|לתאריך|תאריך הדוח|מועד הפקה|הופק בתאריך|as of|statement date/i.test(line));
  const dateMatch = dateLine?.match(/\d{1,4}[./-]\d{1,2}[./-]\d{1,4}/) || all.match(/\d{1,4}[./-]\d{1,2}[./-]\d{1,4}/);
  const reportDate = dateMatch ? parseIsoDate(dateMatch[0]) : undefined;
  const outstandingBalanceCents = valueForLabels(lines, /יתרת?\s*(?:הקרן|הלוואה|המשכנתא|לסילוק)|יתרה\s*לסילוק|סך\s*יתרת\s*ההלוואה|יתרה\s*נוכחית|outstanding\s*balance|loan\s*balance/i);
  const monthlyPaymentCents = valueForLabels(lines, /החזר\s*חודשי|תשלום\s*חודשי|סכום\s*ההחזר|לתשלום\s*בחודש|monthly\s*payment|repayment\s*amount/i);
  const nextLine = lines.find(line => /תשלום\s*הבא|מועד\s*חיוב\s*הבא|next\s*payment/i.test(line));
  const nextMatch = nextLine?.match(/\d{1,4}[./-]\d{1,2}[./-]\d{1,4}/);
  const nextPaymentDate = nextMatch ? parseIsoDate(nextMatch[0]) : undefined;
  const tracks: MortgageTrack[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/(פריים|prime|קל.?צ|קבועה|משתנה|variable|זכאות)/i.test(line) || (/סה.?כ|סך הכל|total/i.test(line) && !/מסלול/i.test(line))) continue;
    const type = trackType(line), adjacent = [line, lines[i + 1] || '', lines[i - 1] || ''];
    const rateLine = adjacent.find(x => /%/.test(x)) || '';
    const rateMatch = rateLine.match(/(\d{1,2}(?:[.,]\d{1,3})?)\s*%/);
    const balanceLine = adjacent.find(x => /יתרה|קרן\s*נותרת|balance/i.test(x));
    const paymentLine = adjacent.find(x => /החזר|תשלום\s*חודשי|חיוב\s*חודשי|monthly\s*payment/i.test(x));
    const originalLine = adjacent.find(x => /סכום\s*מקורי|סכום\s*הלוואה|קרן\s*מקורית|original\s*amount/i.test(x));
    const monthsLine = adjacent.find(x => /חודשים|חודש|שנים|months|years/i.test(x)) || '';
    const months = monthsLine.match(/(\d{1,3})\s*(?:חודשים|חודש|months)/i);
    const years = monthsLine.match(/(\d{1,2})\s*(?:שנים|שנה|years)/i);
    if (tracks.some(track => track.type === type)) continue;
    tracks.push({
      id: 'track_' + i + '_' + type.toLowerCase(), name: trackLabels[type], type,
      balanceCents: balanceLine ? amountCandidates(balanceLine).at(-1) : undefined,
      monthlyPaymentCents: paymentLine ? amountCandidates(paymentLine).at(-1) : undefined,
      originalAmountCents: originalLine ? amountCandidates(originalLine).at(-1) : undefined,
      annualInterestRate: rateMatch ? Number(rateMatch[1].replace(',', '.')) : undefined,
      remainingMonths: months ? Number(months[1]) : years ? Number(years[1]) * 12 : undefined,
      indexation: /לא.?צמודה|לא צמוד|unlinked/i.test(line) ? 'UNLINKED' : /צמודה|linked/i.test(line) ? 'LINKED' : type === 'PRIME' ? 'UNLINKED' : 'UNKNOWN',
    });
  }
  const detectedFields = [
    ...(reportDate ? ['תאריך דוח'] : []), ...(outstandingBalanceCents !== undefined ? ['יתרת משכנתא'] : []),
    ...(monthlyPaymentCents !== undefined ? ['החזר חודשי'] : []), ...(tracks.length ? ['מסלולים (' + tracks.length + ')'] : []),
    ...(nextPaymentDate ? ['מועד תשלום הבא'] : []),
  ];
  const score = Number(Boolean(reportDate)) + Number(outstandingBalanceCents !== undefined) + Number(monthlyPaymentCents !== undefined) + Number(tracks.length > 0);
  return { reportDate, outstandingBalanceCents, monthlyPaymentCents, nextPaymentDate, tracks,
    confidence: score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low', method, pages, detectedFields,
    warnings: [score ? 'החילוץ האוטומטי הוא הצעה בלבד. יש להשוות כל נתון לדוח המקורי לפני שמירה.' : 'לא זוהו שדות ברורים. אפשר להזין נתונים ידנית לאחר בדיקת הדוח.'] };
}
export async function analyzeMortgageDocument(file: File, onProgress?: (progress: StatementParseProgress) => void): Promise<MortgageExtraction> {
  const result = await extractStatementDocumentText(file, onProgress);
  if (!result.text.trim()) throw new Error('לא זוהה טקסט במסמך. נסה PDF חד יותר או צילום באיכות גבוהה.');
  return parseMortgageText(result.text, result.method, result.pages);
}