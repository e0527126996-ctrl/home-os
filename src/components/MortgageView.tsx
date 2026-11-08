import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, FileCheck2, FileText, Landmark, LoaderCircle, Plus, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react';
import type { FinancialAccount, Household, HouseholdDocument, MortgageSnapshot, MortgageTrack, MortgageTrackType, MortgageWorkspace, User } from '../types.ts';
import type { ThemeConfig } from '../lib/themes.ts';
import { db } from '../lib/db.ts';
import { formatCents } from '../lib/currency.ts';
import { parseStatementAmount, type StatementParseProgress } from '../lib/statementImport.ts';
import { analyzeMortgageDocument, type MortgageExtraction } from '../lib/mortgageAnalysis.ts';

type DraftTrack = {
  id: string; name: string; type: MortgageTrackType; balance: string; payment: string; original: string;
  rate: string; months: string; indexation: 'LINKED' | 'UNLINKED' | 'UNKNOWN';
};
type ReviewDraft = {
  file: File; reportDate: string; outstandingBalance: string; monthlyPayment: string;
  nextPaymentDate: string; tracks: DraftTrack[]; notes: string; extraction: MortgageExtraction;
};
interface Props {
  household: Household; currentUser: User | null; accounts: FinancialAccount[];
  activeTheme: ThemeConfig; canEdit: boolean; onOpenAccounts: () => void;
}
const typeOptions: Array<{value:MortgageTrackType;label:string}> = [
  {value:'PRIME',label:'פריים'}, {value:'FIXED_UNLINKED',label:'קבועה לא צמודה'},
  {value:'FIXED_LINKED',label:'קבועה צמודה'}, {value:'VARIABLE_UNLINKED',label:'משתנה לא צמודה'},
  {value:'VARIABLE_LINKED',label:'משתנה צמודה'}, {value:'ELIGIBLE',label:'זכאות'}, {value:'OTHER',label:'אחר'},
];
const inputMoney = (cents?: number) => cents === undefined ? '' : (cents / 100).toFixed(2);
const shortId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const localDate = () => {
  const d = new Date();
  return String(d.getFullYear()) + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
};
const confidenceLabel = (value: string) => value === 'high' ? 'זיהוי ראשוני טוב' : value === 'medium' ? 'זיהוי חלקי' : 'נדרש אימות ידני';
const typeLabel = (type: MortgageTrackType) => typeOptions.find(x => x.value === type)?.label || 'אחר';
const centsFromInput = (value: string, label: string): number | undefined => {
  if (!value.trim()) return undefined;
  const cents = parseStatementAmount(value);
  if (cents === null || cents < 0) throw new Error('הערך בשדה "' + label + '" אינו סכום תקין');
  return cents;
};
const toDraftTrack = (track: MortgageTrack): DraftTrack => ({
  id: track.id, name: track.name, type: track.type, balance: inputMoney(track.balanceCents),
  payment: inputMoney(track.monthlyPaymentCents), original: inputMoney(track.originalAmountCents),
  rate: track.annualInterestRate === undefined ? '' : String(track.annualInterestRate),
  months: track.remainingMonths === undefined ? '' : String(track.remainingMonths), indexation: track.indexation,
});
const formatMoney = (cents?: number) => cents === undefined ? '—' : formatCents(cents, 'ILS');
const updateTrack = (tracks: DraftTrack[], id: string, patch: Partial<DraftTrack>) => tracks.map(track => track.id === id ? {...track,...patch} : track);

export const MortgageView: React.FC<Props> = ({ household, currentUser, accounts, activeTheme, canEdit, onOpenAccounts }) => {
  const [workspaces,setWorkspaces]=useState<MortgageWorkspace[]>([]);
  const [documents,setDocuments]=useState<HouseholdDocument[]>([]);
  const [selectedAccountId,setSelectedAccountId]=useState('');
  const [draft,setDraft]=useState<ReviewDraft|null>(null);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState<StatementParseProgress|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const mortgageAccounts=useMemo(()=>accounts.filter(a=>a.type==='LOAN_MORTGAGE' && a.status!=='CLOSED'),[accounts]);
  const selectedAccount=mortgageAccounts.find(a=>a.id===selectedAccountId) || mortgageAccounts[0];
  const selectedWorkspace=workspaces.find(w=>w.accountId===selectedAccount?.id);
  const snapshots=[...(selectedWorkspace?.snapshots||[])].sort((a,b)=>b.reportDate.localeCompare(a.reportDate));
  const latest=snapshots[0];
  const previous=snapshots[1];
  const linkedDocs=documents.filter(doc=>snapshots.some(snapshot=>snapshot.sourceDocumentId===doc.id));

  const refresh=async()=>{
    if(!currentUser){setWorkspaces([]);setDocuments([]);return;}
    const [nextWorkspaces,nextDocuments]=await Promise.all([
      db.getMortgageWorkspacesByHousehold(household.id,currentUser.id),
      db.getMortgageDocumentsByHousehold(household.id,currentUser.id),
    ]);
    setWorkspaces(nextWorkspaces);setDocuments(nextDocuments);
  };
  useEffect(()=>{
    let active=true;
    if(!currentUser){setWorkspaces([]);setDocuments([]);return;}
    Promise.all([
      db.getMortgageWorkspacesByHousehold(household.id,currentUser.id),
      db.getMortgageDocumentsByHousehold(household.id,currentUser.id),
    ]).then(([nextWorkspaces,nextDocuments])=>{
      if(active){setWorkspaces(nextWorkspaces);setDocuments(nextDocuments);}
    }).catch(e=>{if(active)setError(e.message||'לא ניתן לטעון את נתוני המשכנתא');});
    return()=>{active=false;};
  },[household.id,currentUser?.id]);
  useEffect(()=>{
    if(!selectedAccountId && mortgageAccounts.length)setSelectedAccountId(mortgageAccounts[0].id);
    if(selectedAccountId && !mortgageAccounts.some(a=>a.id===selectedAccountId))setSelectedAccountId(mortgageAccounts[0]?.id||'');
  },[mortgageAccounts,selectedAccountId]);

  const startAnalysis=async(file:File)=>{
    if(!canEdit){setError('אין הרשאת כתיבה בתחום הכספים');return;}
    if(file.size>25*1024*1024){setError('גודל הקובץ המרבי הוא 25MB');return;}
    if(!/\.(pdf|png|jpe?g|webp|xlsx?|csv)$/i.test(file.name)){setError('אפשר לקלוט PDF, צילום, Excel או CSV');return;}
    setBusy(true);setError('');setNotice('');setDraft(null);setProgress({phase:'loading-model',status:'מתחיל לנתח את הדוח…'});
    try{
      const extraction=await analyzeMortgageDocument(file,setProgress);
      setDraft({
        file, reportDate:extraction.reportDate||localDate(),
        outstandingBalance:inputMoney(extraction.outstandingBalanceCents),
        monthlyPayment:inputMoney(extraction.monthlyPaymentCents),
        nextPaymentDate:extraction.nextPaymentDate||'',
        tracks:extraction.tracks.map(toDraftTrack),notes:'',
        extraction,
      });
    }catch(e:any){setError(e.message||'לא ניתן לפענח את מסמך המשכנתא');}
    finally{setBusy(false);setProgress(null);if(fileRef.current)fileRef.current.value='';}
  };
  const handleSave=async()=>{
    if(!draft||!selectedAccount||!currentUser)return;
    setBusy(true);setError('');
    let savedDocumentId='';
    try{
      if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.reportDate))throw new Error('יש לבחור תאריך דוח תקין');
      const balance=centsFromInput(draft.outstandingBalance,'יתרת משכנתא');
      const payment=centsFromInput(draft.monthlyPayment,'החזר חודשי');
      const tracks:MortgageTrack[]=draft.tracks.map((track,index)=>{
        const rate=track.rate.trim()?Number(track.rate.replace(',','.')):undefined;
        const months=track.months.trim()?Number(track.months):undefined;
        if(rate!==undefined&&(!Number.isFinite(rate)||rate<0||rate>100))throw new Error('הריבית במסלול ' +(index+1)+' אינה תקינה');
        if(months!==undefined&&(!Number.isInteger(months)||months<0||months>1200))throw new Error('מספר החודשים במסלול ' +(index+1)+' אינו תקין');
        return {
          id:track.id||('track_'+shortId()),name:track.name.trim()||typeLabel(track.type),type:track.type,
          balanceCents:centsFromInput(track.balance,'יתרת מסלול'),monthlyPaymentCents:centsFromInput(track.payment,'החזר מסלול'),
          originalAmountCents:centsFromInput(track.original,'סכום מקורי'),annualInterestRate:rate,remainingMonths:months,indexation:track.indexation,
        };
      });
      if(balance===undefined&&payment===undefined&&!tracks.length)throw new Error('יש להזין לפחות יתרה, החזר חודשי או מסלול אחד');
      const documentId='mortgage_doc_'+shortId();
      const document:HouseholdDocument={
        id:documentId,householdId:household.id,name:draft.file.name,mimeType:draft.file.type||'application/octet-stream',
        size:draft.file.size,category:'MORTGAGE',uploadedAt:new Date().toISOString(),uploadedBy:currentUser.id,blob:draft.file,
      };
      const snapshot:MortgageSnapshot={
        id:'mortgage_snapshot_'+shortId(),reportDate:draft.reportDate,outstandingBalanceCents:balance,
        monthlyPaymentCents:payment,nextPaymentDate:draft.nextPaymentDate||undefined,tracks,
        sourceDocumentId:documentId,sourceDocumentName:draft.file.name,
        extractionMethod:draft.extraction.method,confidence:draft.extraction.confidence,
        extractedAt:new Date().toISOString(),notes:draft.notes.trim()||undefined,
      };
      const existing=workspaces.find(w=>w.accountId===selectedAccount.id);
      const workspace:MortgageWorkspace={
        id:existing?.id||('mortgage_workspace_'+selectedAccount.id),householdId:household.id,accountId:selectedAccount.id,
        snapshots:[snapshot,...(existing?.snapshots||[])],createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),
      };
      await db.saveMortgageDocument(document,currentUser.id,currentUser.email);savedDocumentId=documentId;
      await db.saveMortgageWorkspace(workspace,currentUser.id,currentUser.email);
      await refresh();setDraft(null);setNotice('הדוח נשמר ונוסף להיסטוריית המשכנתא. הנתונים נשארים לבדיקה מול המקור.'); 
    }catch(e:any){
      if(savedDocumentId){try{await db.deleteMortgageDocument(savedDocumentId,household.id,currentUser.id,currentUser.email);}catch{/* Keep the original save error visible. */}}
      setError(e.message||'שמירת דוח המשכנתא נכשלה');
    }finally{setBusy(false);}
  };
  const downloadDocument=(doc:HouseholdDocument)=>{
    const url=URL.createObjectURL(doc.blob);const a=document.createElement('a');a.href=url;a.download=doc.name;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1500);
  };
  const openDocument=(doc:HouseholdDocument)=>{
    const url=URL.createObjectURL(doc.blob);const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),60000);
  };
  const style={backgroundColor:activeTheme.bgCard,color:activeTheme.textPrimary,borderColor:activeTheme.borderSubtle};
  const muted={color:activeTheme.textSecondary};
  const isDown=latest?.outstandingBalanceCents!==undefined&&previous?.outstandingBalanceCents!==undefined
    ?latest.outstandingBalanceCents-previous.outstandingBalanceCents:undefined;

  return <div className="homeos-mortgage-page homeos-dashboard homeos-workspace-page" dir="rtl">
    <section className="homeos-mortgage-hero">
      <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold tracking-[.2em] text-amber-100/75"><Landmark className="h-4 w-4"/> HOME OS / MORTGAGE INTELLIGENCE</div>
          <h1 className="font-serif text-3xl font-semibold sm:text-4xl">מרכז המשכנתאות</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-stone-200/75">תיק אחד לכל הלוואת דיור. קליטת דוחות, מיפוי מסלולים והשוואת יתרות לאורך זמן — עם אימות לפני שמירת כל נתון.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[11px] text-stone-100/80"><ShieldCheck className="ml-1 inline h-3.5 w-3.5"/> עיבוד מסמכים מקומי</span>
          {canEdit&&selectedAccount&&<button type="button" onClick={()=>fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#d8bd88] px-4 py-3 text-xs font-bold text-[#20282a] shadow-lg transition hover:brightness-105 disabled:opacity-50"><Upload className="h-4 w-4"/> קליטת דוח חדש</button>}
        </div>
      </div>
    </section>
    <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,application/pdf,image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void startAnalysis(f);}} />
    {error&&<div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div>}
    {notice&&<div className="flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>{notice}</div>}
    {mortgageAccounts.length===0?<section className="homeos-mortgage-panel p-8 text-center" style={style}>
      <Landmark className="mx-auto h-10 w-10" style={muted}/><h2 className="mt-4 text-xl font-semibold">עדיין לא הוגדר חשבון משכנתא</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6" style={muted}>תחילה יש ליצור חשבון מסוג ״הלוואה / משכנתא״ באזור החשבונות. לאחר מכן אפשר לפתוח לו תיק, לקלוט דוחות ולנהל מסלולים.</p>
      <button type="button" onClick={onOpenAccounts} className="homeos-primary-action mt-5">מעבר לחשבונות ונכסים</button>
    </section>:<>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-[10px] font-bold tracking-[.16em]" style={{color:activeTheme.accent}}>MORTGAGE PORTFOLIO</div><h2 className="mt-1 text-lg font-semibold">תיקי ההלוואות שלך</h2></div>
        <label className="flex min-w-[230px] items-center gap-3 text-xs font-semibold" style={muted}>בחירת משכנתא
          <select className="homeos-mortgage-field max-w-xs" style={style} value={selectedAccount?.id||''} onChange={e=>setSelectedAccountId(e.target.value)}>
            {mortgageAccounts.map(account=><option key={account.id} value={account.id}>{account.name} · {account.institution}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="homeos-mortgage-metric" style={style}><div className="text-xs" style={muted}>יתרת משכנתא לפי הדוח האחרון</div><strong className="mt-2 text-2xl">{formatMoney(latest?.outstandingBalanceCents)}</strong><div className="mt-2 text-[10px]" style={muted}>{latest?'נכון ל-'+latest.reportDate:'טרם נקלט דוח'}</div></div>
        <div className="homeos-mortgage-metric" style={style}><div className="text-xs" style={muted}>החזר חודשי אחרון</div><strong className="mt-2 text-2xl">{formatMoney(latest?.monthlyPaymentCents)}</strong><div className="mt-2 text-[10px]" style={muted}>{latest?.nextPaymentDate?'תשלום הבא: '+latest.nextPaymentDate:'נדרש דוח עדכני לזיהוי'}</div></div>
        <div className="homeos-mortgage-metric" style={style}><div className="text-xs" style={muted}>מסלולים שזוהו</div><strong className="mt-2 text-2xl">{latest?.tracks.length||0}</strong><div className="mt-2 text-[10px]" style={muted}>מתוך הדוח האחרון שנשמר</div></div>
        <div className="homeos-mortgage-metric" style={style}><div className="text-xs" style={muted}>היסטוריית דוחות</div><strong className="mt-2 text-2xl">{snapshots.length}</strong><div className="mt-2 text-[10px]" style={muted}>{documents.length} קבצים בכספת המשכנתא</div></div>
      </div>
      {latest&&<section className="homeos-mortgage-panel p-5 sm:p-6" style={style}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="text-[10px] font-bold tracking-[.15em]" style={{color:activeTheme.accent}}>LATEST STATEMENT / {latest.reportDate}</div><h2 className="mt-1 text-lg font-semibold">תמונת מצב לפי הדוח האחרון</h2><p className="mt-1 text-xs" style={muted}>הנתונים משקפים את המסמך שנקלט, ולא יתרה חיה מול הבנק.</p></div>
          <span className="homeos-mortgage-pill"><FileCheck2 className="h-3.5 w-3.5"/>{confidenceLabel(latest.confidence)}</span>
        </div>
        {isDown!==undefined&&<div className="mt-4 flex items-center gap-2 rounded-xl p-3 text-xs" style={{backgroundColor:activeTheme.bgSurface,color:activeTheme.textSecondary}}>
          {isDown<0?<ArrowDown className="h-4 w-4 text-emerald-600"/>:isDown>0?<ArrowUp className="h-4 w-4 text-amber-600"/>:<RefreshCw className="h-4 w-4"/>}
          {isDown<0?'היתרה ירדה ב-':isDown>0?'היתרה עלתה ב-':'היתרה לא השתנתה בין הדוחות'}{isDown!==0?' '+formatMoney(Math.abs(isDown))+' מאז הדוח הקודם':''}
        </div>}
        <div className="mt-5 overflow-x-auto"><table className="homeos-mortgage-table"><thead><tr><th>מסלול</th><th>יתרה</th><th>ריבית שנתית</th><th>החזר חודשי</th><th>תקופה שנותרה</th><th>הצמדה</th></tr></thead><tbody>
          {latest.tracks.length?latest.tracks.map(track=><tr key={track.id}><td className="font-semibold">{track.name}<div className="mt-1 text-[10px]" style={muted}>{typeLabel(track.type)}</div></td><td className="font-semibold tabular-nums">{formatMoney(track.balanceCents)}</td><td className="tabular-nums">{track.annualInterestRate===undefined?'—':track.annualInterestRate.toFixed(2)+'%'}</td><td className="tabular-nums">{formatMoney(track.monthlyPaymentCents)}</td><td>{track.remainingMonths===undefined?'—':track.remainingMonths+' חודשים'}</td><td>{track.indexation==='LINKED'?'צמוד':track.indexation==='UNLINKED'?'לא צמוד':'לא זוהה'}</td></tr>):<tr><td colSpan={6} className="py-8 text-center" style={muted}>הדוח לא כלל חלוקה שניתנת לזיהוי אוטומטי. אפשר להוסיף ולמלא מסלולים דרך קליטת דוח.</td></tr>}
        </tbody></table></div>
      </section>}
      {snapshots.length>0&&<section className="homeos-mortgage-panel p-5 sm:p-6" style={style}>
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">מגמת יתרת הקרן</h2><p className="mt-1 text-xs" style={muted}>השוואה בין דוחות שנשמרו — ללא תחזית ריבית או הצמדה.</p></div><span className="text-[10px]" style={muted}>{snapshots.length} נקודות זמן</span></div>
        {snapshots.filter(s=>s.outstandingBalanceCents!==undefined).slice().reverse().map((snapshot,index,array)=>{
          const max=Math.max(...array.map(s=>s.outstandingBalanceCents||0),1);
          const width=Math.max(2,((snapshot.outstandingBalanceCents||0)/max)*100);
          return <div key={snapshot.id} className="mb-3 grid grid-cols-[76px_1fr_112px] items-center gap-3 text-xs">
            <span style={muted}>{snapshot.reportDate}</span><div className="h-2.5 overflow-hidden rounded-full" style={{backgroundColor:activeTheme.bgSurface}}><div className="h-full rounded-full" style={{width:width+'%',backgroundColor:activeTheme.accent}}/></div><strong className="text-left tabular-nums">{formatMoney(snapshot.outstandingBalanceCents)}</strong>
          </div>;
        })}
      </section>}
      <section className="homeos-mortgage-panel p-5 sm:p-6" style={style}>
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">מסמכי המשכנתא</h2><p className="mt-1 text-xs" style={muted}>עותקי המקור נשמרים בכספת המקומית ונכללים בגיבוי המערכת.</p></div>{canEdit&&<button type="button" onClick={()=>fileRef.current?.click()} className="rounded-xl border px-3 py-2 text-xs font-bold" style={{borderColor:activeTheme.borderSubtle,color:activeTheme.accent}}><Upload className="ml-1 inline h-4 w-4"/>הוסף דוח</button>}</div>
        {linkedDocs.length?<div className="divide-y" style={{borderColor:activeTheme.borderSubtle}}>{linkedDocs.map(doc=><div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><FileText className="h-5 w-5 shrink-0" style={{color:activeTheme.accent}}/><div className="min-w-0"><div className="truncate text-sm font-semibold">{doc.name}</div><div className="text-[10px]" style={muted}>{new Date(doc.uploadedAt).toLocaleDateString('he-IL')} · {Math.max(1,Math.round(doc.size/1024))} KB</div></div></div><div className="flex gap-2"><button type="button" onClick={()=>openDocument(doc)} className="rounded-lg border px-3 py-2 text-xs" style={{borderColor:activeTheme.borderSubtle}}>פתח</button><button type="button" onClick={()=>downloadDocument(doc)} className="rounded-lg border px-3 py-2 text-xs" style={{borderColor:activeTheme.borderSubtle}}>הורד</button></div></div>)}</div>:<p className="py-6 text-center text-xs" style={muted}>הדוחות שתקלוט לתיק זה יופיעו כאן.</p>}
      </section>
    </>}
    {busy&&<div className="homeos-mortgage-panel flex items-center gap-3 p-4" style={style}><LoaderCircle className="h-5 w-5 animate-spin" style={{color:activeTheme.accent}}/><div><strong className="text-sm">{progress?.status||'שומר נתוני משכנתא…'}</strong><p className="mt-1 text-xs" style={muted}>המסמך מעובד מקומית בדפדפן.</p></div></div>}
    {draft&&<section className="homeos-mortgage-panel space-y-5 p-5 sm:p-6" style={style}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-bold tracking-[.16em]" style={{color:activeTheme.accent}}>STATEMENT REVIEW / REQUIRED</div><h2 className="mt-1 text-xl font-semibold">בדיקת הנתונים שחולצו</h2><p className="mt-1 text-xs" style={muted}>{draft.file.name} · {draft.extraction.method} · {confidenceLabel(draft.extraction.confidence)}</p></div><span className="homeos-mortgage-pill"><ShieldCheck className="h-3.5 w-3.5"/> נדרש אישור לפני שמירה</span></div>
      <div className="rounded-xl border p-3 text-xs leading-6" style={{borderColor:activeTheme.borderSubtle,backgroundColor:activeTheme.bgSurface}}>{draft.extraction.warnings.join(' ')}<div className="mt-1 font-semibold">שדות שזוהו: {draft.extraction.detectedFields.length?draft.extraction.detectedFields.join(' · '):'לא זוהו — אפשר להזין ידנית'}</div></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs font-semibold">תאריך הדוח<input className="homeos-mortgage-field mt-1.5" type="date" value={draft.reportDate} onChange={e=>setDraft({...draft,reportDate:e.target.value})}/></label>
        <label className="text-xs font-semibold">יתרת משכנתא (₪)<input className="homeos-mortgage-field mt-1.5" inputMode="decimal" placeholder="למשל 742350.50" value={draft.outstandingBalance} onChange={e=>setDraft({...draft,outstandingBalance:e.target.value})}/></label>
        <label className="text-xs font-semibold">החזר חודשי (₪)<input className="homeos-mortgage-field mt-1.5" inputMode="decimal" placeholder="למשל 4820" value={draft.monthlyPayment} onChange={e=>setDraft({...draft,monthlyPayment:e.target.value})}/></label>
        <label className="text-xs font-semibold">תאריך התשלום הבא<input className="homeos-mortgage-field mt-1.5" type="date" value={draft.nextPaymentDate} onChange={e=>setDraft({...draft,nextPaymentDate:e.target.value})}/></label>
        <label className="text-xs font-semibold md:col-span-2">הערה לדוח<input className="homeos-mortgage-field mt-1.5" placeholder="הערות לבדיקה, חריגות או פרטים חסרים" value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
      </div>
      <div><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">מסלולים שזוהו</h3><p className="mt-1 text-[11px]" style={muted}>בדוק את סוג המסלול, יתרת הקרן, הריבית וההחזר. אפשר לערוך או להוסיף שורות.</p></div><button type="button" onClick={()=>setDraft({...draft,tracks:[...draft.tracks,{id:'manual_'+shortId(),name:'מסלול חדש',type:'OTHER',balance:'',payment:'',original:'',rate:'',months:'',indexation:'UNKNOWN'}]})} className="rounded-xl border px-3 py-2 text-xs font-bold" style={{borderColor:activeTheme.borderSubtle,color:activeTheme.accent}}><Plus className="ml-1 inline h-4 w-4"/>הוסף מסלול</button></div>
        {draft.tracks.length===0?<p className="rounded-xl border border-dashed p-5 text-center text-xs" style={{borderColor:activeTheme.borderSubtle,...muted}}>לא זוהו מסלולים. אפשר להוסיף אותם ידנית.</p>:<div className="space-y-3">{draft.tracks.map((track,index)=><div key={track.id} className="rounded-xl border p-3" style={{borderColor:activeTheme.borderSubtle,backgroundColor:activeTheme.bgSurface}}>
          <div className="mb-3 flex items-center justify-between"><strong className="text-xs">מסלול {index+1}</strong><button type="button" onClick={()=>setDraft({...draft,tracks:draft.tracks.filter(t=>t.id!==track.id)})} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" aria-label="הסר מסלול"><Trash2 className="h-4 w-4"/></button></div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-[10px] font-semibold">שם המסלול<input className="homeos-mortgage-field mt-1" value={track.name} onChange={e=>setDraft({...draft,tracks:updateTrack(draft.tracks,track.id,{name:e.target.value})})}/></label>
            <label className="text-[10px] font-semibold">סוג<select className="homeos-mortgage-field mt-1" value={track.type} onChange={e=>setDraft({...draft,tracks:updateTrack(draft.tracks,track.id,{type:e.target.value as MortgageTrackType})})}>{typeOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="text-[10px] font-semibold">יתרת המסלול (₪)<input className="homeos-mortgage-field mt-1" inputMode="decimal" value={track.balance} onChange={e=>setDraft({...draft,tracks:updateTrack(draft.tracks,track.id,{balance:e.target.value})})}/></label>
            <label className="text-[10px] font-semibold">ריבית שנתית (%)<input className="homeos-mortgage-field mt-1" inputMode="decimal" value={track.rate} onChange={e=>setDraft({...draft,tracks:updateTrack(draft.tracks,track.id,{rate:e.target.value})})}/></label>
            <label className="text-[10px] font-semibold">החזר מסלול (₪)<input className="homeos-mortgage-field mt-1" inputMode="decimal" value={track.payment} onChange={e=>setDraft({...draft,tracks:updateTrack(draft.tracks,track.id,{payment:e.target.value})})}/></label>
            <label className="text-[10px] font-semibold">סכום מקורי (₪)<input className="homeos-mortgage-field mt-1" inputMode="decimal" value={track.original} onChange={e=>setDraft({...draft,tracks:updateTrack(draft.tracks,track.id,{original:e.target.value})})}/></label>
            <label className="text-[10px] font-semibold">חודשים שנותרו<input className="homeos-mortgage-field mt-1" inputMode="numeric" value={track.months} onChange={e=>setDraft({...draft,tracks:updateTrack(draft.tracks,track.id,{months:e.target.value})})}/></label>
            <label className="text-[10px] font-semibold">הצמדה<select className="homeos-mortgage-field mt-1" value={track.indexation} onChange={e=>setDraft({...draft,tracks:updateTrack(draft.tracks,track.id,{indexation:e.target.value as DraftTrack['indexation']})})}><option value="UNKNOWN">לא זוהה</option><option value="LINKED">צמוד</option><option value="UNLINKED">לא צמוד</option></select></label>
          </div>
        </div>)}</div>}</div>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{borderColor:activeTheme.borderSubtle}}><button type="button" disabled={busy} onClick={()=>setDraft(null)} className="rounded-xl border px-4 py-2.5 text-xs" style={{borderColor:activeTheme.borderSubtle}}>ביטול</button><button type="button" disabled={busy||!canEdit} onClick={()=>void handleSave()} className="homeos-primary-action disabled:opacity-50"><CheckCircle2 className="ml-1 inline h-4 w-4"/>אישור ושמירת דוח</button></div>
    </section>}
    {!draft&&snapshots.length===0&&mortgageAccounts.length>0&&<section className="homeos-mortgage-panel p-6 text-center" style={style}><FileText className="mx-auto h-8 w-8" style={muted}/><h3 className="mt-3 font-semibold">התיק עדיין ריק</h3><p className="mt-1 text-xs" style={muted}>קלוט דוח יתרות או פירוט מסלולים ראשון כדי להתחיל ליצור היסטוריה.</p>{canEdit&&<button type="button" onClick={()=>fileRef.current?.click()} className="homeos-primary-action mt-4"><Upload className="ml-1 inline h-4 w-4"/>קליטת דוח ראשון</button>}</section>}
  </div>;
};
