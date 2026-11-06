import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, CloudOff, Download, File, FileImage, FileSpreadsheet, FileText, FolderOpen, Search, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { Household, HouseholdDocument, User } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';
import { db } from '../lib/db.ts';

interface DocumentCenterViewProps {
  household: Household;
  currentUser: User | null;
  activeTheme: ThemeConfig;
  canRead: boolean;
  canWrite: boolean;
}

const categories: Array<{ value: HouseholdDocument['category']; label: string }> = [
  { value: 'BANK', label: 'דוחות בנק' },
  { value: 'CREDIT_CARD', label: 'כרטיסי אשראי' },
  { value: 'INVOICE', label: 'חשבוניות' },
  { value: 'RECEIPT', label: 'קבלות' },
  { value: 'INSURANCE', label: 'ביטוחים' },
  { value: 'TAX', label: 'מסים ורשויות' },
  { value: 'OTHER', label: 'אחר' },
];

const formatSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const formatDate = (value: string) => new Date(value).toLocaleDateString('he-IL', {
  year: 'numeric', month: 'short', day: 'numeric',
});

const fileIcon = (mime: string) => {
  if (mime.startsWith('image/')) return FileImage;
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return FileSpreadsheet;
  if (mime.includes('pdf') || mime.includes('word')) return FileText;
  return File;
};

export const DocumentCenterView: React.FC<DocumentCenterViewProps> = ({
  household, currentUser, activeTheme, canRead, canWrite,
}) => {
  const [documents, setDocuments] = useState<HouseholdDocument[]>([]);
  const [category, setCategory] = useState<HouseholdDocument['category']>('OTHER');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => setDocuments(await db.getDocumentsByHousehold(household.id));
  useEffect(() => { refresh().catch((e) => setError(e.message)); }, [household.id]);

  const visibleDocuments = useMemo(() => documents.filter((doc) => {
    const matchesText = !query || doc.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = filter === 'ALL' || doc.category === filter;
    return matchesText && matchesCategory;
  }), [documents, query, filter]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setBusy(true); setError(''); setMessage('');
    let saved = 0;
    try {
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) throw new Error(`הקובץ "${file.name}" גדול מ-25MB`);
        const allowed = /^(application\/(pdf|vnd\.|msword)|image\/|text\/|application\/vnd\.openxmlformats)/i.test(file.type)
          || /\.(pdf|png|jpe?g|webp|csv|xlsx?|docx?)$/i.test(file.name);
        if (!allowed) throw new Error(`סוג הקובץ "${file.name}" אינו נתמך`);
        const doc: HouseholdDocument = {
          id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          householdId: household.id,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          category,
          uploadedAt: new Date().toISOString(),
          uploadedBy: currentUser?.id || 'unknown',
          blob: file,
        };
        await db.saveDocument(doc);
        saved++;
      }
      await refresh();
      setMessage(`${saved} מסמכים נשמרו בכספת המקומית`);
    } catch (e: any) {
      setError(e.message || 'שגיאה בהעלאת המסמכים');
      if (saved) await refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDownload = (doc: HouseholdDocument) => {
    const url = URL.createObjectURL(doc.blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = doc.name; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handlePreview = (doc: HouseholdDocument) => {
    const url = URL.createObjectURL(doc.blob);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) handleDownload(doc);
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleDelete = async (doc: HouseholdDocument) => {
    if (!window.confirm(`למחוק את המסמך "${doc.name}"?`)) return;
    try {
      await db.deleteDocument(doc.id, household.id);
      await refresh();
    } catch (e: any) { setError(e.message || 'לא ניתן למחוק את המסמך'); }
  };

  if (!canRead) return <div className="homeos-lux-panel p-8 text-center">אין לך הרשאת צפייה במסמכי משק הבית.</div>;

  const panel = { backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle, color: activeTheme.textPrimary };
  const muted = { color: activeTheme.textSecondary };

  return (
    <div className="homeos-dashboard space-y-6 pb-10" dir="rtl">
      <section className="homeos-wealth-hero">
        <div className="homeos-hero-orbit homeos-orbit-one" />
        <div className="relative z-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[.16em] text-emerald-100/75"><FolderOpen className="h-4 w-4" /> HOUSEHOLD VAULT</div>
            <h1 className="text-3xl font-bold sm:text-4xl">מרכז המסמכים</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/75">כל המסמכים הפיננסיים של הבית במקום אחד, עם חיפוש, סיווג ושמירה מקומית מאובטחת בדפדפן.</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] text-white"><CloudOff className="h-3.5 w-3.5" /> אחסון מקומי · סנכרון ענן יוגדר בשלב הבא</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] text-white"><ShieldCheck className="h-3.5 w-3.5" /> הפרדה לפי משק בית</span>
            </div>
          </div>
          <div className="grid min-w-[220px] grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[.08] p-4"><div className="text-[11px] text-emerald-100/70">מסמכים שמורים</div><div className="mt-2 text-3xl font-bold tabular-nums text-white">{documents.length}</div></div>
            <div className="rounded-2xl border border-white/10 bg-white/[.08] p-4"><div className="text-[11px] text-emerald-100/70">נפח אחסון</div><div className="mt-2 text-3xl font-bold tabular-nums text-white">{formatSize(documents.reduce((sum, doc) => sum + doc.size, 0))}</div></div>
          </div>
        </div>
      </section>

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      {canWrite && <section className="homeos-lux-panel space-y-4 border p-5 sm:p-6" style={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">הוספת מסמכים</h2><p className="mt-1 text-xs" style={muted}>PDF, תמונות, Excel, CSV ו-Word · עד 25MB לקובץ</p></div>
          <select value={category} onChange={(e) => setCategory(e.target.value as HouseholdDocument['category'])} className="rounded-xl border px-3 py-2 text-xs" style={panel}>
            {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <input ref={inputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xls,.xlsx,.doc,.docx,application/pdf,image/*" onChange={handleUpload} className="hidden" />
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#7D9B8D]/50 bg-[#7D9B8D]/[.06] p-6 text-center transition hover:bg-[#7D9B8D]/[.12] disabled:opacity-50">
          <span className="rounded-2xl bg-[#315C4B] p-3 text-white"><Upload className="h-6 w-6" /></span>
          <strong className="text-sm">{busy ? 'שומר מסמכים...' : 'לחץ לבחירת מסמכים מהמחשב'}</strong>
          <span className="text-xs" style={muted}>ניתן לבחור כמה קבצים בפעולה אחת</span>
        </button>
      </section>}

      <section className="homeos-lux-panel space-y-4 border p-5 sm:p-6" style={panel}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div><h2 className="text-lg font-bold">ארכיון המסמכים</h2><p className="mt-1 text-xs" style={muted}>המסמכים נשמרים בדפדפן במחשב הזה. הם עדיין אינם מסתנכרנים למכשירים אחרים.</p></div>
          <div className="relative min-w-[220px]"><Search className="absolute right-3 top-2.5 h-4 w-4 opacity-40" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי שם מסמך..." className="w-full rounded-xl border py-2 pr-9 pl-3 text-xs" style={panel} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter('ALL')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === 'ALL' ? 'bg-[#315C4B] text-white' : 'bg-black/5 dark:bg-white/10'}`}>הכול</button>
          {categories.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === item.value ? 'bg-[#315C4B] text-white' : 'bg-black/5 dark:bg-white/10'}`}>{item.label}</button>)}
        </div>
        {visibleDocuments.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: activeTheme.borderSubtle }}><Archive className="mx-auto mb-3 h-8 w-8 opacity-30" /><p className="text-sm font-semibold">עדיין אין מסמכים להצגה</p><p className="mt-1 text-xs" style={muted}>העלה דוחות בנק, חשבוניות וקבלות כדי להתחיל לבנות את הארכיון.</p></div> :
          <div className="divide-y" style={{ borderColor: activeTheme.borderSubtle }}>
            {visibleDocuments.map((doc) => {
              const Icon = fileIcon(doc.mimeType);
              return <div key={doc.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3"><span className="rounded-xl bg-[#7D9B8D]/10 p-3 text-[#527A68]"><Icon className="h-5 w-5" /></span><div className="min-w-0"><div className="truncate text-sm font-bold">{doc.name}</div><div className="mt-1 text-[11px]" style={muted}>{categories.find((item) => item.value === doc.category)?.label} · {formatSize(doc.size)} · {formatDate(doc.uploadedAt)}</div></div></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePreview(doc)} className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: activeTheme.borderSubtle }}>פתח</button>
                  <button onClick={() => handleDownload(doc)} title="הורדה" className="rounded-lg border p-2 hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: activeTheme.borderSubtle }}><Download className="h-4 w-4" /></button>
                  {canWrite && <button onClick={() => handleDelete(doc)} title="מחיקה" className="rounded-lg border p-2 text-rose-600 hover:bg-rose-50" style={{ borderColor: activeTheme.borderSubtle }}><Trash2 className="h-4 w-4" /></button>}
                </div>
              </div>;
            })}
          </div>}
      </section>
    </div>
  );
};
