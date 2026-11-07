import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CheckCircle2, FileSpreadsheet, FileText, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { FinancialAccount, LedgerTransaction } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';
import { ImportedStatementRow, normalizeStatementPayee, parseStatementFileWithDiagnostics, StatementParseDiagnostics, StatementParseProgress } from '../lib/statementImport.ts';
import { formatCents } from '../lib/currency.ts';

interface Props {
  file: File;
  accounts: FinancialAccount[];
  transactions: LedgerTransaction[];
  activeTheme: ThemeConfig;
  onClose: () => void;
  onImport: (rows: ImportedStatementRow[], accountId: string) => Promise<void>;
}

const categoryOptions = ['מזון וסופרמרקט','דיור וחשבונות (שכירות, ארנונה, חשמל)','תחבורה, דלק ורכב','בריאות, רפואה וביטוחים','חינוך, חוגים וילדים','קניות, ביגוד והנעלה','מסעדות, בתי קפה ובילוי','תקשורת ואינטרנט','הוצאות שונות','משכורת חודשית','הכנסה מעסק / עצמאי','קצבאות ביטוח לאומי','החזר מס / תגמולים','שכר דירה / הכנסה פסיבית','מתנות ומענקים','הכנסה אחרת'];

export const StatementImportModal: React.FC<Props> = ({ file, accounts, transactions, activeTheme, onClose, onImport }) => {
  const [rows, setRows] = useState<ImportedStatementRow[]>([]);
  const [accountId, setAccountId] = useState(accounts.find(a => a.type === 'CHECKING' && a.status === 'ACTIVE')?.id || accounts.find(a => a.status === 'ACTIVE')?.id || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [includeDuplicateIds, setIncludeDuplicateIds] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<StatementParseDiagnostics | null>(null);
  const [parseProgress, setParseProgress] = useState<StatementParseProgress | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setDone(false);
    setRows([]);
    setDiagnostics(null);
    setParseProgress(null);
    setIncludeDuplicateIds([]);
    // Parse once per selected file. Duplicate checks are recalculated below from
    // the live transaction list, so a save/reload must not restart this file's OCR.
    parseStatementFileWithDiagnostics(file, transactions, progress => {
      if (active) setParseProgress(progress);
    }).then(result => {
      if (!active) return;
      setRows(result.rows);
      setDiagnostics(result.diagnostics);
    })
      .catch(err => { if (active) setError(err.message || 'לא ניתן לפענח את הקובץ'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [file]);

  // A matching transaction in another account is not a duplicate. Re-evaluate
  // duplicate status against the account currently selected for this import.
  const rowsForAccount = useMemo(() => {
    const existingKeys = new Set(transactions
      .filter(tx => tx.accountId === accountId)
      .map(tx => [tx.date, tx.type, tx.amountCents, normalizeStatementPayee(tx.payee)].join('|')));
    const batchKeys = new Set<string>();
    return rows.map(row => {
      const key = [row.date, row.type, row.amountCents, normalizeStatementPayee(row.payee)].join('|');
      const duplicate = !includeDuplicateIds.includes(row.id) && (existingKeys.has(key) || batchKeys.has(key));
      batchKeys.add(key);
      return { ...row, duplicate };
    });
  }, [rows, transactions, accountId, includeDuplicateIds]);
  const eligible = useMemo(() => rowsForAccount.filter(r => !r.duplicate && Boolean(r.date) && Boolean(r.payee.trim()) && Boolean(r.category.trim()) && Number.isSafeInteger(r.amountCents) && r.amountCents > 0), [rowsForAccount]);
  const invalidCount = rowsForAccount.filter(r => !r.duplicate && (!r.date || !r.payee.trim() || !r.category.trim() || !Number.isSafeInteger(r.amountCents) || r.amountCents <= 0)).length;
  const lowConfidenceCount = rowsForAccount.filter(row => !row.duplicate && row.confidence === 'low').length;
  const totalIncome = eligible.filter(r => r.type === 'INCOME').reduce((s, r) => s + r.amountCents, 0);
  const totalExpense = eligible.filter(r => r.type === 'EXPENSE').reduce((s, r) => s + r.amountCents, 0);
  const selectedCurrency = accounts.find(account => account.id === accountId)?.currency || 'ILS';
  const updateRow = (id: string, patch: Partial<ImportedStatementRow>) => setRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row));

  const submit = async () => {
    if (!accountId || !eligible.length) return;
    setSaving(true); setError('');
    try {
      await onImport(eligible, accountId);
      setDone(true);
    } catch (err: any) { setError(err.message || 'ייבוא העסקאות נכשל'); }
    finally { setSaving(false); }
  };

  const panel = { backgroundColor: activeTheme.bgCard, color: activeTheme.textPrimary, borderColor: activeTheme.borderSubtle };
  const muted = { color: activeTheme.textSecondary };
  return <div className="homeos-themed-modal homeos-statement-import-modal fixed inset-0 z-[120] flex items-center justify-center bg-[#101B16]/65 p-3 backdrop-blur-md" dir="rtl" role="dialog" aria-modal="true" aria-label="ייבוא דף חשבון">
    <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border shadow-2xl" style={panel}>
      <header className="relative overflow-hidden bg-gradient-to-l from-[#142A22] via-[#244638] to-[#527D68] px-6 py-6 text-white sm:px-8">
        <div className="absolute -left-10 -top-24 h-64 w-64 rounded-full border border-white/10" />
        <div className="relative flex items-start justify-between gap-4">
          <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.2em] text-emerald-100/70"><ShieldCheck className="h-4 w-4"/> SMART STATEMENT IMPORT</div>
            <h2 className="font-serif text-2xl font-bold sm:text-3xl">קליטת דף חשבון</h2>
            <p className="mt-2 text-xs text-emerald-50/75">{file.name} · המסמך מעובד בדפדפן ואינו נשלח לשרת</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-white/20 bg-white/10 p-2 hover:bg-white/20"><X className="h-5 w-5"/></button>
        </div>
      </header>
      {loading ? <div className="flex flex-1 flex-col items-center justify-center gap-3 p-16 text-sm" style={muted}><LoaderCircle className="h-5 w-5 animate-spin"/><strong>{parseProgress?.status || 'מפענח תנועות ומזהה עסקאות...'}</strong>{typeof parseProgress?.progress === 'number' && <div className="h-2 w-full max-w-xs overflow-hidden rounded-full" style={{backgroundColor:activeTheme.borderSubtle}}><div className="h-full rounded-full transition-all" style={{width:Math.max(0,Math.min(100,parseProgress.progress*100))+'%',backgroundColor:activeTheme.accent}} /></div>}<span className="max-w-md text-center text-[11px] leading-5">במסמך סרוק, מודל OCR בעברית נטען למחשב בפעם הראשונה. תוכן דף החשבון נשאר בדפדפן.</span></div> :
      done ? <div className="p-12 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600"/><h3 className="mt-4 text-xl font-bold">הייבוא הושלם</h3><p className="mt-2 text-sm" style={muted}>העסקאות נוספו לפנקס במצב ממתין לבדיקה. הן לא ייכללו ביתרות ובתחזיות עד לאישור.</p><button onClick={onClose} className="homeos-primary-action mt-6">סיום</button></div> :
      <div className="flex min-h-0 flex-1 flex-col">
        {error && <div className="mx-5 mt-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}
        {!error && accounts.filter(account => account.status === 'ACTIVE').length === 0 && <div className="mx-5 mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900">לא נמצא חשבון פעיל לשיוך דף החשבון. סגור את החלון, צור או הפעל חשבון במסך ״חשבונות ונכסים״, ולאחר מכן נסה שוב.</div>}
        {!error && <div className="grid gap-3 border-b p-5 sm:grid-cols-2 xl:grid-cols-4" style={{borderColor:activeTheme.borderSubtle}}>
          <label className="sm:col-span-1"><span className="mb-1.5 block text-[11px] font-bold" style={muted}>לאיזה חשבון לשייך?</span><select value={accountId} onChange={e=>setAccountId(e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-xs" style={panel}>{accounts.filter(a=>a.status==='ACTIVE').map(a=><option key={a.id} value={a.id}>{a.name} · {a.institution}</option>)}</select></label>
          <div className="rounded-xl border p-3" style={{borderColor:activeTheme.borderSubtle,backgroundColor:activeTheme.bgSurface}}><div className="text-[10px]" style={muted}>עסקאות חדשות לקליטה</div><div className="mt-1 text-xl font-bold tabular-nums">{eligible.length}</div><div className="text-[10px]" style={muted}>{rowsForAccount.filter(r=>r.duplicate).length} התאמות אפשריות לכפילות ידולגו</div><div className="mt-1 text-[10px] text-amber-700">{lowConfidenceCount} שורות עם זיהוי לא בטוח · מומלץ לבדוק</div></div>
          <div className="rounded-xl border p-3" style={{borderColor:activeTheme.borderSubtle,backgroundColor:activeTheme.bgSurface}}><div className="text-[10px]" style={muted}>סיכום תנועות לזיהוי</div><div className="mt-1 flex flex-wrap gap-3 text-xs font-bold"><span className="text-emerald-700">הכנסות {formatCents(totalIncome, selectedCurrency)}</span><span className="text-amber-700">הוצאות {formatCents(totalExpense, selectedCurrency)}</span></div></div>
          <div className="rounded-xl border p-3" style={{borderColor:activeTheme.borderSubtle,backgroundColor:activeTheme.bgSurface}}><div className="text-[10px]" style={muted}>שורות שדורשות תיקון</div><div className={'mt-1 text-xl font-bold tabular-nums ' + (invalidCount ? 'text-rose-700' : 'text-emerald-700')}>{invalidCount}</div><div className="text-[10px]" style={muted}>לא ייכללו בייבוא עד לתיקון</div></div>
        </div>}
        {!error && diagnostics && <div className="mx-5 mt-3 rounded-xl border px-4 py-3 text-[11px] leading-5" style={{borderColor:activeTheme.borderSubtle,backgroundColor:activeTheme.bgSurface,color:activeTheme.textSecondary}}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong style={{color:activeTheme.textPrimary}}>אבחון קליטה · {diagnostics.method === 'excel' ? 'Excel' : diagnostics.method === 'csv' ? 'CSV' : diagnostics.method === 'pdf-text' ? 'PDF עם שכבת טקסט' : diagnostics.method === 'pdf-ocr' ? 'PDF סרוק · OCR מקומי' : 'תמונה · OCR מקומי'}</strong>
            <span>{diagnostics.parsedRows} שורות זוהו{typeof diagnostics.pages === 'number' ? ' · ' + diagnostics.pages + ' עמודים' : ''} · {diagnostics.lowConfidenceRows} דורשות תשומת לב</span>
          </div>
          <p className="mt-1">{diagnostics.note}</p>
          {diagnostics.method === 'pdf-ocr' || diagnostics.method === 'image-ocr' ? <p className="mt-1 font-semibold text-amber-700">זיהוי OCR אינו תחליף לבדיקת המסמך המקורי. כל שורה חייבת לעבור אימות לפני שתשפיע על היתרות והגרפים.</p> : null}
        </div>}
        {error ? <div className="flex-1 p-8 text-center text-sm" style={muted}>לא בוצע שינוי בפנקס העסקאות. אפשר לסגור ולנסות קובץ אחר.</div> :
        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
          {rows.length===0 ? <div className="p-12 text-center text-sm" style={muted}>לא נמצאו תנועות בקובץ.</div> :
          <table className="w-full min-w-[760px] text-right text-xs">
            <thead className="sticky top-0 z-10" style={{backgroundColor:activeTheme.bgSurface,color:activeTheme.textSecondary}}><tr><th className="p-3">תאריך</th><th className="p-3">תיאור</th><th className="p-3">סוג</th><th className="p-3">סכום ({selectedCurrency})</th><th className="p-3">קטגוריה מוצעת (ניתנת לעריכה)</th><th className="p-3">זיהוי</th></tr></thead>
            <tbody>{rowsForAccount.map(row=><tr key={row.id} className="border-b" style={{borderColor:activeTheme.borderSubtle,opacity:row.duplicate ? 0.48 : 1}}>
              <td className="p-2"><input type="date" disabled={row.duplicate} value={row.date} onChange={e=>updateRow(row.id,{date:e.target.value})} className="w-[130px] rounded-lg border px-2 py-2 text-[11px]" style={panel}/></td>
              <td className="p-2"><input disabled={row.duplicate} value={row.payee} onChange={e=>updateRow(row.id,{payee:e.target.value})} className="w-[180px] rounded-lg border px-2 py-2 text-[11px] font-semibold" style={panel} title={row.sourceText}/></td>
              <td className="p-2"><select disabled={row.duplicate} value={row.type} onChange={e=>updateRow(row.id,{type:e.target.value as 'INCOME'|'EXPENSE',category:e.target.value==='INCOME'?'הכנסה אחרת':'הוצאות שונות',confidence:'low'})} className="rounded-lg border px-2 py-2 text-[11px]" style={panel}><option value="EXPENSE">הוצאה</option><option value="INCOME">הכנסה</option></select></td>
              <td className="p-2"><input type="number" min="0.01" step="0.01" disabled={row.duplicate} value={(row.amountCents/100).toFixed(2)} onChange={e=>updateRow(row.id,{amountCents:Math.round(Number(e.target.value)*100)||0})} className="w-[105px] rounded-lg border px-2 py-2 text-[11px] font-bold tabular-nums" style={panel}/></td>
              <td className="p-2"><select disabled={row.duplicate} value={row.category} onChange={e=>updateRow(row.id,{category:e.target.value,confidence:'high'})} className="max-w-[230px] rounded-lg border px-2 py-2 text-[11px]" style={panel}>{categoryOptions.filter(c=>row.type==='INCOME'?!['מזון וסופרמרקט','דיור וחשבונות (שכירות, ארנונה, חשמל)','תחבורה, דלק ורכב','בריאות, רפואה וביטוחים','חינוך, חוגים וילדים','קניות, ביגוד והנעלה','מסעדות, בתי קפה ובילוי','תקשורת ואינטרנט','הוצאות שונות'].includes(c):!['משכורת חודשית','הכנסה מעסק / עצמאי','קצבאות ביטוח לאומי','החזר מס / תגמולים','שכר דירה / הכנסה פסיבית','מתנות ומענקים','הכנסה אחרת'].includes(c)).map(c=><option key={c}>{c}</option>)}</select></td>
              <td className="p-3">{row.duplicate?<button type="button" onClick={()=>setIncludeDuplicateIds(prev=>prev.includes(row.id)?prev:[...prev,row.id])} className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-200">חשד לכפילות · ייבא בכל זאת</button>:(!row.date || !row.payee.trim() || !row.category.trim() || !Number.isSafeInteger(row.amountCents) || row.amountCents <= 0)?<span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-800">דורש תיקון</span>:<span className="text-[10px]" style={muted}>{row.confidence==='high'?'זיהוי טוב':row.confidence==='medium'?'נדרש אימות':'קטגוריה כללית'}</span>}</td>
            </tr>)}</tbody>
          </table>}
        </div>}
        {!error && <footer className="flex flex-col-reverse gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" style={{borderColor:activeTheme.borderSubtle,backgroundColor:activeTheme.bgSurface}}>
          <p className="text-[10px] leading-5" style={muted}>הייבוא יוצר עסקאות במצב ממתין לבדיקה. שורות כפולות מדולגות. {invalidCount > 0 ? 'יש לתקן את ' + invalidCount + ' השורות המסומנות לפני הייבוא.' : 'כל השורות התקינות מוכנות לייבוא.'}</p>
          <div className="flex gap-2"><button onClick={onClose} className="rounded-xl border px-4 py-2.5 text-xs font-bold" style={{borderColor:activeTheme.borderSubtle}}>ביטול</button><button disabled={saving||!accountId||eligible.length===0||invalidCount>0} onClick={submit} className="homeos-primary-action disabled:opacity-40">{saving?<LoaderCircle className="h-4 w-4 animate-spin"/>:<FileSpreadsheet className="h-4 w-4"/>}ייבא {eligible.length} עסקאות</button></div>
        </footer>}
      </div>}
    </div>
  </div>;
};
