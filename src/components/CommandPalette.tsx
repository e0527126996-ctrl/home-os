import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ClipboardList, FileText, House, Landmark, LayoutDashboard, Search, Settings, UsersRound, WalletCards } from 'lucide-react';

export type WorkspaceCommand = 'dashboard'|'accounts'|'mortgage'|'ledger'|'documents'|'home'|'members'|'households'|'audit'|'settings'|'create-expense'|'create-income'|'create-transfer';
interface Props {
  isOpen:boolean; onClose:()=>void; onRun:(command:WorkspaceCommand)=>void;
  canReadFinance:boolean; canWriteFinance:boolean; canReadDocuments:boolean; canReadFood:boolean; canReadAdmin:boolean;
}
type Item={id:WorkspaceCommand;label:string;detail:string;terms:string;icon:React.ComponentType<{className?:string}>;group:'פעולות מהירות'|'מעבר לאזור'};
export const CommandPalette:React.FC<Props>=({isOpen,onClose,onRun,canReadFinance,canWriteFinance,canReadDocuments,canReadFood,canReadAdmin})=>{
  const [query,setQuery]=useState('');
  const [activeIndex,setActiveIndex]=useState(0);
  const commands=useMemo<Item[]>(()=>[
    {id:'dashboard',label:'לוח הבקרה',detail:'תמונת מצב והמלצות לבית',terms:'ראשי דשבורד dashboard מצב',icon:LayoutDashboard,group:'מעבר לאזור'},
    ...(canReadFinance?[
      {id:'accounts' as const,label:'חשבונות ונכסים',detail:'יתרות, חסכונות, התחייבויות וכרטיסים',terms:'בנק עוש אשראי משכנתא',icon:WalletCards,group:'מעבר לאזור' as const},
      {id:'mortgage' as const,label:'מרכז משכנתאות',detail:'מסלולים, ריביות, דוחות ויתרות',terms:'משכנתא משכנתה הלוואה דיור מסלול פריים קלצ החזר חודשי סילוקין',icon:Landmark,group:'מעבר לאזור' as const},
      {id:'ledger' as const,label:'פנקס עסקאות',detail:'הכנסות, הוצאות, העברות ואימות',terms:'תנועות קבלה חיוב זיכוי',icon:Activity,group:'מעבר לאזור' as const},
    ]:[]),
    ...(canReadDocuments?[{id:'documents' as const,label:'מרכז מסמכים',detail:'קבלות, חשבוניות ודוחות',terms:'קובץ מסמך תלוש חשבונית',icon:FileText,group:'מעבר לאזור' as const}]:[]),
    ...(canReadFood?[{id:'home' as const,label:'ניהול הבית',detail:'תכנון, קניות, מתכונים ומשימות',terms:'אוכל מטבח תפריט מלאי משימה',icon:House,group:'מעבר לאזור' as const}]:[]),
    ...(canReadAdmin?[
      {id:'members' as const,label:'משפחה והרשאות',detail:'משתמשים, בני בית ותפקידים',terms:'ילדים משתמשים גישה הרשאה',icon:UsersRound,group:'מעבר לאזור' as const},
      {id:'audit' as const,label:'יומן ביקורת',detail:'היסטוריית פעולות ושינויים',terms:'היסטוריה לוג פעולות',icon:ClipboardList,group:'מעבר לאזור' as const},
    ]:[]),
    {id:'households',label:'משקי בית',detail:'מעבר בין סביבות הבית',terms:'בחירת בית סביבה',icon:House,group:'מעבר לאזור'},
    {id:'settings',label:'הגדרות אישיות',detail:'עיצוב, רקעים, גופנים ותצוגה',terms:'התאמה אישית ערכות נושא בהירות קוביות',icon:Settings,group:'מעבר לאזור'},
    ...(canReadFinance&&canWriteFinance?[
      {id:'create-expense' as const,label:'רישום הוצאה חדשה',detail:'טופס הוצאה מוכן למילוי',terms:'הוסף קנייה תשלום חיוב הוצאה',icon:ArrowUpRight,group:'פעולות מהירות' as const},
      {id:'create-income' as const,label:'רישום הכנסה חדשה',detail:'טופס הכנסה מוכן למילוי',terms:'משכורת תקבול זיכוי הכנסה',icon:ArrowDownLeft,group:'פעולות מהירות' as const},
      {id:'create-transfer' as const,label:'העברה בין חשבונות',detail:'טופס העברה עם מקור ויעד',terms:'העברה פנימית הפקדה משיכה',icon:ArrowLeftRight,group:'פעולות מהירות' as const},
    ]:[]),
  ],[canReadFinance,canWriteFinance,canReadDocuments,canReadFood,canReadAdmin]);
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase('he-IL');
    return q?commands.filter(item=>(item.label+' '+item.detail+' '+item.terms).toLocaleLowerCase('he-IL').includes(q)):commands;
  },[commands,query]);
  useEffect(()=>{if(!isOpen){setQuery('');setActiveIndex(0);}else setActiveIndex(0);},[isOpen]);
  useEffect(()=>{if(activeIndex>=filtered.length)setActiveIndex(Math.max(0,filtered.length-1));},[activeIndex,filtered.length]);
  if(!isOpen)return null;
  return <div className="homeos-command-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="homeos-command-palette" role="dialog" aria-modal="true" aria-labelledby="homeos-command-title" dir="rtl">
      <header className="homeos-command-palette-head">
        <div><span className="homeos-command-eyebrow">HOME OS / COMMAND</span><h2 id="homeos-command-title">מה תרצה לעשות?</h2><p>חפש אזור או בחר פעולה לביצוע מהיר.</p></div>
        <button type="button" className="homeos-command-close" onClick={onClose} aria-label="סגירת חלונית הפקודות">Esc</button>
      </header>
      <label className="homeos-command-search"><Search className="h-5 w-5" aria-hidden="true"/>
        <input autoFocus type="search" value={query} onChange={event=>{setQuery(event.target.value);setActiveIndex(0);}}
          onKeyDown={event=>{
            if(event.key==='ArrowDown'){event.preventDefault();setActiveIndex(i=>Math.min(filtered.length-1,i+1));}
            if(event.key==='ArrowUp'){event.preventDefault();setActiveIndex(i=>Math.max(0,i-1));}
            if(event.key==='Enter'&&filtered[activeIndex]){event.preventDefault();onRun(filtered[activeIndex].id);}
          }}
          placeholder="לדוגמה: הוצאה, חשבונות, קניות, מסמכים…" aria-label="חיפוש פעולות ואזורים במערכת"/>
        <kbd>Ctrl K</kbd>
      </label>
      <div className="homeos-command-results">
        {(['פעולות מהירות','מעבר לאזור'] as const).map(group=>{
          const items=filtered.filter(item=>item.group===group);if(!items.length)return null;
          return <div className="homeos-command-group" key={group}><div className="homeos-command-group-title">{group}</div>
            {items.map(item=>{
              const index=filtered.findIndex(candidate=>candidate.id===item.id),Icon=item.icon;
              return <button key={item.id} type="button" className={`homeos-command-item ${index===activeIndex?'is-active':''}`}
                onMouseEnter={()=>setActiveIndex(index)} onClick={()=>onRun(item.id)} aria-current={index===activeIndex?'true':undefined}>
                <span className="homeos-command-item-icon"><Icon className="h-4 w-4"/></span>
                <span className="homeos-command-item-copy"><strong>{item.label}</strong><small>{item.detail}</small></span><span className="homeos-command-item-enter">↵</span>
              </button>;
            })}
          </div>;
        })}
        {!filtered.length&&<div className="homeos-command-empty"><Search className="h-5 w-5"/><strong>לא נמצאו תוצאות</strong><span>נסה מילה אחרת או חיפוש קצר יותר.</span></div>}
      </div>
      <footer className="homeos-command-foot"><span>↑ ↓ לניווט</span><span>Enter לבחירה</span><span>Esc לסגירה</span></footer>
    </section>
  </div>;
};
