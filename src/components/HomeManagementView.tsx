import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChefHat, ClipboardCheck, ShoppingBasket, Plus, Trash2, Check, RefreshCw, Pencil, X, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { db } from '../lib/db.ts';
import { FinancialAccount, Household, HouseholdHomeItem, HouseholdPerson, LedgerTransaction, User } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';
import { buildFinanceAnalytics } from '../lib/financeAnalytics.ts';
import { classifyShoppingCategory, formatIngredientQuantity, mergeQuantityTexts, normalizeShoppingName, splitIngredientName } from '../lib/shoppingIntelligence.ts';

type Props = { household: Household; currentUser: User | null; activeTheme: ThemeConfig; canRead: boolean; canWrite: boolean; accounts: FinancialAccount[]; transactions: LedgerTransaction[]; persons: HouseholdPerson[]; onOpenLedger: () => void; initialTab?: 'planner'|'recipes'|'shopping'|'tasks'|'finance'; onRequestUserSwitch: () => void; onItemsChange: (items: HouseholdHomeItem[]) => void };
type Recipe = { name: string; ingredients: string[]; instructions: string; category: string; servings?: number };
type Meal = { date: string; slot: string; recipeId: string; recipeName: string; servings?: number };
type GeneratedShoppingBatch = { quantity: string; sources: string[] };
type Shopping = { name: string; quantity: string; checked: boolean; source?: string; manualQuantity?: string; generatedBatches?: Record<string, GeneratedShoppingBatch> };
type Task = { title: string; dueDate: string; assignee: string; done: boolean };
const uid = (p: string) => p + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
const iso = (d: Date) => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
const validISODate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0,10) === value;
const monday = (d: Date) => { const x = new Date(d); x.setDate(x.getDate()-((x.getDay()+6)%7)); x.setHours(12,0,0,0); return x; };
const days = ['יום שני','יום שלישי','יום רביעי','יום חמישי','יום שישי','שבת','יום ראשון'];
const slots = ['בוקר','צהריים','ערב'];

export function HomeManagementView({ household, currentUser, activeTheme, canRead, canWrite, accounts, transactions, persons, onOpenLedger, initialTab = 'planner', onRequestUserSwitch, onItemsChange }: Props) {
  const householdPortions = Math.max(1, Math.ceil(persons.reduce((sum, person) => sum + (Number.isFinite(person.portionFactor) && person.portionFactor > 0 ? person.portionFactor : 1), 0)));
  const [items,setItems] = useState<HouseholdHomeItem[]>([]);
  const [tab,setTab] = useState<'planner'|'recipes'|'shopping'|'tasks'|'finance'>(initialTab);
  useEffect(()=>{setTab(initialTab);},[initialTab]);
  const [week,setWeek] = useState(()=>monday(new Date()));
  const [name,setName] = useState(''); const [ingredients,setIngredients] = useState(''); const [instructions,setInstructions] = useState(''); const [category,setCategory] = useState('ארוחה משפחתית'); const [recipeServings,setRecipeServings] = useState('4'); const [editingRecipeId,setEditingRecipeId] = useState<string|null>(null);
  const [mealDate,setMealDate] = useState(iso(new Date())); const [mealSlot,setMealSlot] = useState('צהריים'); const [recipeId,setRecipeId] = useState(''); const [mealServings,setMealServings] = useState(String(householdPortions)); const [editingMealId,setEditingMealId] = useState<string|null>(null);
  const [shopName,setShopName] = useState(''); const [quantity,setQuantity] = useState(''); const [editingShoppingId,setEditingShoppingId] = useState<string|null>(null);
  const [taskTitle,setTaskTitle] = useState(''); const [taskDate,setTaskDate] = useState(iso(new Date())); const [assignee,setAssignee] = useState(''); const [editingTaskId,setEditingTaskId] = useState<string|null>(null);
  const [error,setError] = useState(''); const [busy,setBusy] = useState(false); const [shoppingFeedback,setShoppingFeedback] = useState(''); const [shoppingSearch,setShoppingSearch] = useState(''); const [shoppingStatus,setShoppingStatus] = useState<'OPEN'|'CHECKED'|'ALL'>('OPEN'); const [selectedFinanceCategory,setSelectedFinanceCategory] = useState<string|null>(null);
  const mealEditorRef = useRef<HTMLElement | null>(null);
  const recipeEditorRef = useRef<HTMLElement | null>(null);
  const refresh = useCallback(async()=>{ if(!currentUser || !canRead) return; try { const nextItems = await db.getHomeItemsByHousehold(household.id,currentUser.id); setItems(nextItems); onItemsChange(nextItems); setError(''); } catch(e) { setError(e instanceof Error?e.message:'טעינת נתוני הבית נכשלה'); } },[household.id,currentUser,canRead,onItemsChange]);
  useEffect(()=>{ void refresh(); },[refresh]);
  const recipes=useMemo(()=>items.filter(x=>x.kind==='recipe').sort((a,b)=>String(a.data.name||'').localeCompare(String(b.data.name||''),'he')),[items]);
  const meals=useMemo(()=>items.filter(x=>x.kind==='meal').sort((a,b)=>String(a.data.date||'').localeCompare(String(b.data.date||''))),[items]);
  const shopping=useMemo(()=>items.filter(x=>x.kind==='shopping').sort((a,b)=>Number(Boolean((a.data as Shopping).checked))-Number(Boolean((b.data as Shopping).checked))),[items]);
  const tasks=useMemo(()=>items.filter(x=>x.kind==='task').sort((a,b)=>Number(Boolean((a.data as Task).done))-Number(Boolean((b.data as Task).done))||String(a.data.dueDate||'').localeCompare(String(b.data.dueDate||''))),[items]);
  const shoppingCounts=useMemo(()=>({open:shopping.filter(item=>!(item.data as Shopping).checked).length,checked:shopping.filter(item=>(item.data as Shopping).checked).length}),[shopping]);
  const visibleShopping=useMemo(()=>shopping.filter(item=>{
    const checked=Boolean((item.data as Shopping).checked);
    const name=String((item.data as Shopping).name||'');
    const query=shoppingSearch.trim().toLocaleLowerCase('he-IL');
    return (shoppingStatus==='ALL'||(shoppingStatus==='OPEN'?!checked:checked))&&(!query||name.toLocaleLowerCase('he-IL').includes(query)||String((item.data as Shopping).quantity||'').toLocaleLowerCase('he-IL').includes(query));
  }).sort((a,b)=>{
    const categoryA=classifyShoppingCategory(String(a.data.name||''));
    const categoryB=classifyShoppingCategory(String(b.data.name||''));
    return categoryA.localeCompare(categoryB,'he')||String(a.data.name||'').localeCompare(String(b.data.name||''),'he');
  }),[shopping,shoppingSearch,shoppingStatus]);
  const shoppingGroups=useMemo(()=>{
    const groups=new Map<string,HouseholdHomeItem[]>();
    for(const item of visibleShopping){
      const category=classifyShoppingCategory(String(item.data.name||''));
      groups.set(category,[...(groups.get(category)||[]),item]);
    }
    return [...groups.entries()];
  },[visibleShopping]);
  const weekDays=useMemo(()=>Array.from({length:7},(_,i)=>{const d=new Date(week);d.setDate(d.getDate()+i);return iso(d);}),[week]);
  const financeAnalytics = useMemo(() => buildFinanceAnalytics(accounts, transactions), [accounts, transactions]);
  const finance = useMemo(() => ({
    income: financeAnalytics.currentMonth.incomeCents,
    expenseTotal: financeAnalytics.currentMonth.expenseCents,
    pending: financeAnalytics.pendingTransactions.length,
    pendingAmount: financeAnalytics.pendingAmountIlsCents,
    foreignAccounts: accounts.filter(account => account.status === 'ACTIVE' && account.currency !== 'ILS').length,
    foreignCurrencies: financeAnalytics.foreignCurrencySummaries.map(item => ({
      currency: item.currency, income: item.incomeCents, expense: item.expenseCents,
    })),
    categories: financeAnalytics.categories,
    forecast: financeAnalytics.forecast,
    spendingAlerts: financeAnalytics.spendingAlerts,
  }), [financeAnalytics, accounts]);
  const money = (cents: number) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(cents / 100);
  const save=async(kind:HouseholdHomeItem['kind'],data:Record<string,unknown>,id=uid(kind)):Promise<boolean>=>{
     if(!currentUser||!canWrite){setError('אין הרשאה לשמור שינויים בניהול הבית.');return false;} setBusy(true);setError('');
     try { const old=items.find(x=>x.id===id),now=new Date().toISOString(); await db.saveHomeItem({id,householdId:household.id,kind,data,createdAt:old?.createdAt||now,updatedAt:now},currentUser.id); await refresh(); return true; }
     catch(e){setError(e instanceof Error?e.message:'שמירה נכשלה');return false;} finally{setBusy(false);}
   };
  const remove=async(id:string)=>{if(!currentUser||!canWrite||busy)return;setBusy(true);setError('');try{await db.deleteHomeItem(id,household.id,currentUser.id);await refresh();}catch(e){setError(e instanceof Error?e.message:'מחיקה נכשלה');}finally{setBusy(false);}};
  const resetRecipeForm=()=>{setEditingRecipeId(null);setName('');setIngredients('');setInstructions('');setCategory('ארוחה משפחתית');setRecipeServings('4');};
   const resetMealForm=()=>{setEditingMealId(null);setMealDate(iso(new Date()));setMealSlot('צהריים');setRecipeId('');setMealServings(String(householdPortions));};
   const addRecipe=async()=>{if(!name.trim())return;const savedId=editingRecipeId||uid('recipe');const recipeName=name.trim();const parsedServings=Number(recipeServings);if(!Number.isFinite(parsedServings)||parsedServings<=0||parsedServings>100){setError('יש להזין מספר מנות תקין למתכון (1–100)');return;}const ok=await save('recipe',{name:recipeName,servings:parsedServings,ingredients:ingredients.split(/[,،\n]/).map(x=>x.trim()).filter(Boolean),instructions:instructions.trim(),category},savedId);if(!ok)return;if(editingRecipeId){for(const meal of meals.filter(x=>(x.data as Meal).recipeId===savedId)){const data=meal.data as Meal;const updated=await save('meal',{...data,recipeName},meal.id);if(!updated)return;}}resetRecipeForm();};
   const editRecipe=(item:HouseholdHomeItem)=>{const recipe=item.data as Recipe;setEditingRecipeId(item.id);setName(recipe.name||'');setIngredients((recipe.ingredients||[]).join(', '));setInstructions(recipe.instructions||'');setCategory(recipe.category||'ארוחה משפחתית');setRecipeServings(String(recipe.servings||4));window.requestAnimationFrame(()=>recipeEditorRef.current?.scrollIntoView({behavior:'smooth',block:'center'}));};
  const addMeal=async()=>{if(!validISODate(mealDate)){setError('יש לבחור תאריך תקין לארוחה');return;}const r=recipes.find(x=>x.id===recipeId);if(!r){setError('יש לבחור מתכון קיים לפני שמירת הארוחה.');return;}const parsedMealServings=Number(mealServings);if(!Number.isFinite(parsedMealServings)||parsedMealServings<=0||parsedMealServings>100){setError('יש להזין מספר מנות מתוכנן תקין (1–100)');return;}const ok=await save('meal',{date:mealDate,slot:mealSlot,recipeId:r.id,recipeName:String(r.data.name||'מתכון'),servings:parsedMealServings},editingMealId||uid('meal'));if(ok)resetMealForm();};
   const editMeal=(item:HouseholdHomeItem)=>{const data=item.data as Meal;const recipeExists=recipes.some(recipe=>recipe.id===data.recipeId);setEditingMealId(item.id);setMealDate(data.date||iso(new Date()));setMealSlot(data.slot||'צהריים');setRecipeId(recipeExists?data.recipeId:'');setMealServings(String(data.servings||householdPortions));setError(recipeExists?'':'המתכון ששויך לארוחה כבר אינו קיים. בחר מתכון חלופי ושמור.');window.requestAnimationFrame(()=>mealEditorRef.current?.scrollIntoView({behavior:'smooth',block:'center'}));};
   const addShopping=async()=>{
    if(!shopName.trim())return;
    const old=editingShoppingId?shopping.find(x=>x.id===editingShoppingId):undefined;
    const oldData=old?.data as Shopping|undefined;
    const existingDuplicate=!editingShoppingId?shopping.find(item=>!(item.data as Shopping).checked&&normalizeShoppingName(String((item.data as Shopping).name||''))===normalizeShoppingName(shopName.trim())):undefined;
    const target=old||existingDuplicate;
    const targetData=target?.data as Shopping|undefined;
    const batches={...(targetData?.generatedBatches||{})};
    const manualQuantity=editingShoppingId?quantity.trim():mergeQuantityTexts(targetData?.manualQuantity??(targetData?.generatedBatches?'':targetData?.quantity||''),quantity.trim());
    const displayQuantity=mergeQuantityTexts(manualQuantity,...Object.values(batches).map(batch=>batch.quantity));
    const ok=await save('shopping',{...(targetData||{}),name:editingShoppingId?shopName.trim():(targetData?.name||shopName.trim()),quantity:displayQuantity,manualQuantity,generatedBatches:batches},target?.id||uid('shopping'));
    if(ok){
      setShopName('');setQuantity('');setEditingShoppingId(null);
      if(existingDuplicate)setShoppingFeedback('הפריט כבר היה ברשימה הפתוחה, ולכן אוחד עם השורה הקיימת במקום ליצור כפילות.');
    }
  };
   const editShopping=(item:HouseholdHomeItem)=>{const data=item.data as Shopping;setEditingShoppingId(item.id);setShopName(data.name||'');setQuantity(data.quantity||'');};
  const addIngredientsToShopping = async (
    sourceRecipes: Array<{recipe: Recipe; plannedServings: number}>,
    batchKey: string,
  ) => {
    if (!currentUser || !canWrite) { setError('אין הרשאת כתיבה לרשימת הקניות.'); return; }
    const grouped = new Map<string, { name: string; sources: Set<string>; quantities: string[] }>();
    for (const entry of sourceRecipes) {
      const baseServings = Number(entry.recipe.servings) > 0 ? Number(entry.recipe.servings) : 4;
      const scaleFactor = Math.max(0.01, entry.plannedServings / baseServings);
      for (const rawIngredient of entry.recipe.ingredients || []) {
        const raw = String(rawIngredient || '').trim();
        if (!raw) continue;
        const name = splitIngredientName(raw).trim();
        if (!name) continue;
        const key = normalizeShoppingName(name);
        if (!key) continue;
        let group = grouped.get(key);
        if (!group) { group = { name, sources: new Set<string>(), quantities: [] }; grouped.set(key, group); }
        group.sources.add(entry.recipe.name);
        const scaledQuantity = formatIngredientQuantity([raw], scaleFactor);
        if (scaledQuantity) group.quantities.push(scaledQuantity);
      }
    }

    const openShopping = shopping.filter(item => !(item.data as Shopping).checked);
    const existingOpen = new Map(openShopping.map(item => [normalizeShoppingName(String((item.data as Shopping).name || '')), item]));
    const now = new Date().toISOString();
    const writes: HouseholdHomeItem[] = [];
    const deleteIds: string[] = [];
    let added = 0;
    let updated = 0;
    let removedStale = 0;

    // A weekly/recipe batch is a replaceable source, not an additive event.
    // Re-running it updates that batch instead of doubling quantities.
    if (batchKey) {
      for (const item of openShopping) {
        const oldData = item.data as Shopping;
        if (!oldData.generatedBatches?.[batchKey] || grouped.has(normalizeShoppingName(oldData.name))) continue;
        const nextBatches = { ...oldData.generatedBatches };
        delete nextBatches[batchKey];
        const manualQuantity = oldData.manualQuantity ?? '';
        const quantityText = mergeQuantityTexts(manualQuantity, ...Object.values(nextBatches).map(batch => batch.quantity));
        if (!quantityText && !Object.keys(nextBatches).length && !manualQuantity) {
          deleteIds.push(item.id);
          removedStale++;
        } else {
          const sources = [...new Set(Object.values(nextBatches).flatMap(batch => batch.sources))];
          writes.push({ ...item, data: { ...oldData, quantity: quantityText, source: sources.join(' · '), generatedBatches: nextBatches }, updatedAt: now });
          updated++;
        }
      }
    }

    for (const [key, group] of grouped) {
      const quantity = mergeQuantityTexts(...group.quantities);
      const existing = existingOpen.get(key);
      const oldData = existing?.data as Shopping | undefined;
      const batches = { ...(oldData?.generatedBatches || {}) };
      const manualQuantity = oldData?.manualQuantity ?? (oldData?.generatedBatches ? '' : oldData?.quantity || '');
      batches[batchKey] = { quantity, sources: [...group.sources] };
      const allSources = [...new Set([...Object.values(batches).flatMap(batch => batch.sources), ...(oldData?.source || '').split(' · ').filter(Boolean)])];
      const displayQuantity = mergeQuantityTexts(manualQuantity, ...Object.values(batches).map(batch => batch.quantity));
      if (existing) {
        writes.push({
          ...existing,
          data: { ...oldData, name: oldData?.name || group.name, quantity: displayQuantity, checked: false, source: allSources.join(' · '), manualQuantity, generatedBatches: batches },
          updatedAt: now,
        });
        updated++;
      } else {
        writes.push({
          id: uid('shopping'), householdId: household.id, kind: 'shopping',
          data: { name: group.name, quantity: displayQuantity, checked: false, source: allSources.join(' · '), manualQuantity: '', generatedBatches: batches },
          createdAt: now, updatedAt: now,
        });
        added++;
      }
    }

    if (!writes.length && !deleteIds.length) {
      setShoppingFeedback('רשימת הקניות כבר מסונכרנת עם התכנון הזה. לא נוספו כמויות כפולות.');
      setTab('shopping');
      return;
    }
    setBusy(true); setError(''); setShoppingFeedback('');
    try {
      await db.syncShoppingItemsBatch(household.id, writes, deleteIds, currentUser.id);
      await refresh();
      setTab('shopping');
      setShoppingFeedback('הרשימה סונכרנה מחדש: ' + added + ' פריטים חדשים, ' + updated + ' פריטים שעודכנו' + (removedStale ? ', ' + removedStale + ' פריטים שכבר לא נדרשים הוסרו' : '') + '. הפקה חוזרת לא מכפילה כמויות, ומנות המתכון מותאמות למספר המנות שתוכנן.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'יצירת רשימת הקניות נכשלה');
    } finally {
      setBusy(false);
    }
  };
  const addRecipeIngredientsToShopping = async (recipe: Recipe, recipeId: string) => {
    await addIngredientsToShopping([{ recipe, plannedServings: Number(recipe.servings) > 0 ? Number(recipe.servings) : 4 }], 'recipe:' + recipeId);
  };
  const addWeeklyMenuToShopping = async () => {
    const plannedMeals = meals.filter(item => weekDays.includes(String((item.data as Meal).date || '')));
    const plannedByRecipe = new Map<string, {recipe: Recipe; plannedServings: number}>();
    for (const mealItem of plannedMeals) {
      const meal = mealItem.data as Meal;
      const recipeItem = recipes.find(recipe => recipe.id === meal.recipeId);
      if (!recipeItem) continue;
      const servings = Number(meal.servings) > 0 ? Number(meal.servings) : householdPortions;
      const previous = plannedByRecipe.get(recipeItem.id);
      if (previous) previous.plannedServings += servings;
      else plannedByRecipe.set(recipeItem.id, { recipe: recipeItem.data as Recipe, plannedServings: servings });
    }
    const sourceRecipes = [...plannedByRecipe.values()];
    if (!plannedMeals.length) { setError('אין ארוחות מתוכננות בשבוע הזה. הוסף ארוחות לתפריט לפני הפקת רשימת קניות.'); return; }
    if (!sourceRecipes.length) { setError('לא נמצאו מתכונים תקינים לארוחות השבוע. בדוק את שיוך המתכונים בתפריט.'); return; }
    await addIngredientsToShopping(sourceRecipes, 'week:' + weekDays[0]);
  };
  const addTask=async()=>{if(!taskTitle.trim())return;if(!validISODate(taskDate)){setError('יש לבחור תאריך יעד תקין למשימה');return;}const old=editingTaskId?tasks.find(x=>x.id===editingTaskId):undefined;const ok=await save('task',{...(old?.data as Task||{}),title:taskTitle.trim(),dueDate:taskDate,assignee:assignee.trim()},editingTaskId||uid('task'));if(ok){setTaskTitle('');setAssignee('');setEditingTaskId(null);}};
   const editTask=(item:HouseholdHomeItem)=>{const data=item.data as Task;setEditingTaskId(item.id);setTaskTitle(data.title||'');setTaskDate(data.dueDate||iso(new Date()));setAssignee(data.assignee||'');};
  const panel='homeos-home-panel'; const ps={background:activeTheme.bgCard,borderColor:activeTheme.borderSubtle};
  const field='homeos-home-field'; const fs={background:activeTheme.bgSurface,borderColor:activeTheme.borderSubtle,color:activeTheme.textPrimary};
  const primary='inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-40'; const prim={background:activeTheme.accent,color:activeTheme.isDark?activeTheme.textPrimary:activeTheme.bgCard};
  const tabs=[['planner','תפריט שבועי',CalendarDays],['recipes','ספר מתכונים',ChefHat],['shopping','רשימת קניות',ShoppingBasket],['tasks','משימות הבית',ClipboardCheck],['finance','תקציב והוצאות',TrendingDown]] as const;
  if(!canRead)return <div className={panel} style={ps}>אין הרשאת צפייה בניהול הבית.</div>;
  return <div dir="rtl" className="homeos-home-management space-y-6">
    <header className="homeos-home-hero" style={{background:activeTheme.bgCard,borderColor:activeTheme.borderSubtle,color:activeTheme.textPrimary}}>
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-2 text-[10px] font-bold tracking-[.18em]" style={{color:activeTheme.accent}}>תפעול הבית</div><h1 className="font-serif text-3xl font-bold">ניהול הבית</h1><p className="mt-2 max-w-xl text-sm leading-7" style={{color:activeTheme.textSecondary}}>מתכננים את השבוע, מרכזים מתכונים, יוצרים רשימת קניות ומנהלים משימות — במקום אחד.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['ארוחות',meals.length],['מתכונים',recipes.length],['לקנייה',shopping.filter(x=>!(x.data as Shopping).checked).length],['משימות פתוחות',tasks.filter(x=>!(x.data as Task).done).length]].map(([l,v])=><div key={String(l)} className="rounded-xl border px-4 py-3" style={{background:activeTheme.bgSurface,borderColor:activeTheme.borderSubtle}}><div className="text-[10px]" style={{color:activeTheme.textSecondary}}>{l}</div><div className="mt-1 text-xl font-bold">{v}</div></div>)}</div></div>
    </header>
    <nav className="homeos-home-tabs" style={ps}>{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>setTab(id)} className="inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold" style={{color:tab===id?(activeTheme.isDark?activeTheme.textPrimary:activeTheme.bgCard):activeTheme.textSecondary,background:tab===id?activeTheme.accent:'transparent'}}><Icon size={16}/>{label}</button>)}</nav>
    {error&&<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}{shoppingFeedback&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{shoppingFeedback}</div>}
    {!canWrite&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs" style={{borderColor:activeTheme.borderSubtle,background:activeTheme.bgSurface,color:activeTheme.textSecondary}}><span>מצב צפייה בלבד. המשתמש הפעיל אינו מורשה לערוך את נתוני הבית.</span><button type="button" onClick={onRequestUserSwitch} className="rounded-lg border px-3 py-2 font-bold" style={{borderColor:activeTheme.borderSubtle,color:activeTheme.textPrimary}}>החלף משתמש / בדוק הרשאות</button></div>}
    {tab==='planner'&&<div className="space-y-4">
      <section className={panel} style={ps}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-bold tracking-widest" style={{color:activeTheme.accent}}>תכנון שבועי</div><h2 className="mt-1 text-xl font-bold">תכנון ארוחות</h2></div><div className="flex flex-wrap items-center gap-2"><button disabled={!canWrite||busy||!meals.some(item=>weekDays.includes(String((item.data as Meal).date||'')))} className={primary} style={prim} onClick={()=>void addWeeklyMenuToShopping()}><ShoppingBasket size={14}/>הפק רשימת קניות מהתפריט</button><button className="rounded-lg border px-3 py-2 text-xs" style={fs} onClick={()=>setWeek(new Date(week.getTime()-604800000))}>שבוע קודם</button><button className="rounded-lg border px-3 py-2 text-xs" style={fs} onClick={()=>setWeek(monday(new Date()))}>השבוע</button><button className="rounded-lg border px-3 py-2 text-xs" style={fs} onClick={()=>setWeek(new Date(week.getTime()+604800000))}>שבוע הבא</button></div></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{weekDays.map((date,i)=><div key={date} className="rounded-xl border p-3" style={{borderColor:activeTheme.borderSubtle,background:activeTheme.bgSurface}}><div className="mb-3 flex justify-between"><strong className="text-sm">{days[i]}</strong><span className="text-[10px] opacity-60">{date.slice(8)}/{date.slice(5,7)}</span></div>{slots.map(slot=>{const slotMeals=meals.filter(x=>(x.data as Meal).date===date&&(x.data as Meal).slot===slot);return <div key={slot} className="mb-2 rounded-lg border border-dashed p-2" style={{borderColor:activeTheme.borderSubtle}}><div className="text-[10px] font-bold opacity-50">{slot}</div>{slotMeals.length?slotMeals.map(m=><div key={m.id} className="mt-1 flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate">{(m.data as Meal).recipeName}</span>{canWrite&&<div className="flex shrink-0 items-center gap-2"><button type="button" aria-label={`עריכת ארוחה ${String((m.data as Meal).recipeName||'')}`} title="עריכת ארוחה" onClick={()=>editMeal(m)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-40" style={{borderColor:activeTheme.borderSubtle}}><Pencil size={12}/>עריכה</button><button type="button" aria-label="הסרת ארוחה מהתפריט" title="הסרת ארוחה" onClick={()=>void remove(m.id)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40"><Trash2 size={12}/>הסרה</button></div>}</div>):<div className="mt-1 text-[10px] opacity-35">טרם תוכנן</div>}</div>})}</div>)}</div></section>
      <section ref={mealEditorRef} className={`${panel} ${editingMealId?'ring-2 ring-emerald-500/50':''}`} style={ps}><h3 className="mb-3 font-bold">{editingMealId?'עריכת ארוחה':'הוספת ארוחה לתפריט'}</h3><div className="grid gap-3 sm:grid-cols-5"><input type="date" className={field} style={fs} value={mealDate} onChange={e=>setMealDate(e.target.value)}/><select className={field} style={fs} value={mealSlot} onChange={e=>setMealSlot(e.target.value)}>{slots.map(x=><option key={x}>{x}</option>)}</select><select className={field} style={fs} value={recipeId} onChange={e=>setRecipeId(e.target.value)}><option value="">בחירת מתכון</option>{recipes.map(x=><option key={x.id} value={x.id}>{String(x.data.name)}</option>)}</select><input type="number" min="1" max="100" step="1" className={field} style={fs} aria-label="מספר מנות מתוכנן" placeholder={'מנות (ברירת מחדל '+householdPortions+')'} value={mealServings} onChange={e=>setMealServings(e.target.value)}/><div className="flex flex-wrap gap-2"><button disabled={!canWrite||busy||!recipeId} onClick={()=>void addMeal()} className={primary} style={prim}>{editingMealId?<Check size={15}/>:<Plus size={15} />}{editingMealId?'שמירת שינויים':'הוסף לתפריט'}</button>{editingMealId&&<button type="button" disabled={busy} onClick={resetMealForm} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold" style={fs}><X size={15}/>ביטול עריכה</button>}</div></div></section>
    </div>}
    {tab==='recipes'&&<div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]"><section ref={recipeEditorRef} className={`${panel} ${editingRecipeId?'ring-2 ring-emerald-500/50':''}`} style={ps}><h2 className="mb-4 text-lg font-bold">{editingRecipeId?'עריכת מתכון':'מתכון חדש'}</h2><div className="space-y-3"><input className={field} style={fs} placeholder="שם המתכון" value={name} onChange={e=>setName(e.target.value)}/><select className={field} style={fs} value={category} onChange={e=>setCategory(e.target.value)}>{['ארוחה משפחתית','בשרי','חלבי','פרווה','תוספת','סלט','קינוח','אחר'].map(x=><option key={x}>{x}</option>)}</select><textarea rows={4} className={field} style={fs} placeholder="מצרכים — כל שורה מצרך וכמות, למשל: שמן זית – 2 כפות" value={ingredients} onChange={e=>setIngredients(e.target.value)}/><input type="number" min="1" max="100" step="1" className={field} style={fs} aria-label="מספר מנות בסיס במתכון" placeholder="מנות בסיס במתכון" value={recipeServings} onChange={e=>setRecipeServings(e.target.value)}/><textarea rows={4} className={field} style={fs} placeholder="אופן ההכנה" value={instructions} onChange={e=>setInstructions(e.target.value)}/><div className="flex flex-wrap gap-2"><button disabled={!canWrite||busy||!name.trim()} onClick={()=>void addRecipe()} className={primary} style={prim}>{editingRecipeId?<Check size={15}/>:<Plus size={15} />}{editingRecipeId?'שמירת שינויים':'שמירת מתכון'}</button>{editingRecipeId&&<button disabled={busy} onClick={resetRecipeForm} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold" style={fs}><X size={15}/>ביטול עריכה</button>}</div></div></section><div className="space-y-3">{recipes.length===0&&<div className={panel} style={ps}><ChefHat size={28} className="mb-3 opacity-40"/><strong>ספר המתכונים מתחיל כאן</strong><p className="mt-1 text-xs opacity-60">שמור מתכונים ומצרכים, והוסף אותם לתפריט ולקניות.</p></div>}{recipes.map(r=>{const d=r.data as Recipe;return <article key={r.id} className={panel} style={ps}><div className="flex justify-between gap-3"><div><span className="text-[10px] font-bold" style={{color:activeTheme.accent}}>{d.category}</span><h3 className="mt-1 text-lg font-bold">{d.name}</h3></div>{canWrite&&<div className="flex items-center gap-3"><button type="button" title="עריכת מתכון" onClick={()=>editRecipe(r)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-40" style={{borderColor:activeTheme.borderSubtle}}><Pencil size={13}/>עריכת מתכון</button><button type="button" title="מחיקת מתכון" onClick={()=>void remove(r.id)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[10px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={13}/>מחיקה</button></div>}</div><div className="mt-3 text-xs leading-6"><b>מצרכים:</b> {(d.ingredients||[]).join(' · ')||'לא הוזנו'}</div><div className="mt-2 text-[10px] opacity-60">כמות בסיס: {d.servings||4} מנות</div>{d.instructions&&<p className="mt-2 whitespace-pre-wrap text-xs leading-6 opacity-70">{d.instructions}</p>}<button disabled={!canWrite||busy||!d.ingredients?.length} onClick={()=>void addRecipeIngredientsToShopping(d,r.id)} className="mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold" style={fs}><ShoppingBasket size={14}/>הוסף מצרכים לקניות</button></article>})}</div></div>}
    {tab==='shopping'&&<div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
      <section className={panel} style={ps}>
        <h2 className="mb-4 text-lg font-bold">{editingShoppingId?'עריכת פריט':'הוספה לרשימה'}</h2>
        <div className="space-y-3">
          <input className={field} style={fs} placeholder="מה צריך לקנות?" value={shopName} onChange={e=>setShopName(e.target.value)}/>
          <input className={field} style={fs} placeholder="כמות / הערה (לא חובה)" value={quantity} onChange={e=>setQuantity(e.target.value)}/>
          <div className="flex flex-wrap gap-2">
            <button disabled={!canWrite||busy||!shopName.trim()} onClick={()=>void addShopping()} className={primary} style={prim}>{editingShoppingId?<Check size={15}/>:<Plus size={15}/ >}{editingShoppingId?'שמירת שינויים':'הוסף לרשימה'}</button>
            {editingShoppingId&&<button disabled={busy} onClick={()=>{setEditingShoppingId(null);setShopName('');setQuantity('');}} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold" style={fs}><X size={15}/>ביטול</button>}
          </div>
          <p className="text-[10px] leading-5" style={{color:activeTheme.textSecondary}}>הוספה בשם שכבר מופיע ברשימה הפתוחה תאחד את השורה במקום ליצור כפילות.</p>
        </div>
      </section>
      <section className={panel} style={ps}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">רשימת הקניות</h2><p className="mt-1 text-[11px]" style={{color:activeTheme.textSecondary}}>{shoppingCounts.open} פתוחים · {shoppingCounts.checked} נאספו</p></div>
          <button type="button" disabled={!canWrite||busy||!shoppingCounts.open} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40" style={fs} onClick={()=>setShoppingStatus('OPEN')}>המשך קנייה</button>
        </div>
        <div className="mb-4 rounded-xl border p-3" style={{borderColor:activeTheme.borderSubtle,background:activeTheme.bgSurface}}>
          <div className="mb-2 flex items-center justify-between gap-3 text-[10px]"><span style={{color:activeTheme.textSecondary}}>התקדמות הקנייה</span><strong>{shopping.length?Math.round(shoppingCounts.checked/shopping.length*100):0}%</strong></div>
          <div className="h-2 overflow-hidden rounded-full" style={{background:activeTheme.borderSubtle}}><div className="h-full rounded-full transition-all" style={{width:(shopping.length?shoppingCounts.checked/shopping.length*100:0)+'%',background:activeTheme.accent}}/></div>
        </div>
        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input type="search" className={field} style={fs} placeholder="חיפוש מצרך או כמות..." value={shoppingSearch} onChange={e=>setShoppingSearch(e.target.value)}/>
          <div className="flex flex-wrap gap-1 rounded-xl border p-1" style={{borderColor:activeTheme.borderSubtle}}>
            {([{id:'OPEN',label:'לקנייה'},{id:'CHECKED',label:'נאספו'},{id:'ALL',label:'הכול'}] as const).map(option=><button key={option.id} type="button" aria-pressed={shoppingStatus===option.id} onClick={()=>setShoppingStatus(option.id)} className="rounded-lg px-3 py-2 text-[10px] font-bold transition" style={{background:shoppingStatus===option.id?activeTheme.accent:'transparent',color:shoppingStatus===option.id?(activeTheme.isDark?activeTheme.textPrimary:activeTheme.bgCard):activeTheme.textSecondary}}>{option.label}</button>)}
          </div>
        </div>
        {shoppingGroups.length===0?<div className="py-10 text-center text-sm" style={{color:activeTheme.textSecondary}}>{shopping.length?'לא נמצאו פריטים התואמים לחיפוש ולסינון.':'הרשימה עדיין ריקה. אפשר להתחיל בהוספה ידנית או להפיק אותה מתכנון הארוחות.'}</div>:
          <div className="space-y-5">
            {shoppingGroups.map(([category,groupItems])=><section key={category}>
              <header className="mb-2 flex items-center justify-between border-b pb-2" style={{borderColor:activeTheme.borderSubtle}}><h3 className="text-xs font-extrabold">{category}</h3><span className="text-[10px]" style={{color:activeTheme.textSecondary}}>{groupItems.length} פריטים</span></header>
              {groupItems.map(item=>{const d=item.data as Shopping;return <div key={item.id} className="mb-2 flex items-center gap-3 rounded-xl border px-3 py-3 transition" style={{borderColor:activeTheme.borderSubtle,background:d.checked?activeTheme.bgSurface:'transparent',opacity:d.checked?.68:1}}>
                <button type="button" aria-label={d.checked?'סמן כלא נאסף':'סמן כנאסף'} aria-pressed={Boolean(d.checked)} disabled={!canWrite||busy} onClick={()=>void save('shopping',{...d,checked:!d.checked},item.id)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition" style={{borderColor:activeTheme.borderSubtle,background:d.checked?activeTheme.accent:'transparent',color:activeTheme.isDark?activeTheme.textPrimary:activeTheme.bgCard}}>{d.checked&&<Check size={14}/>}</button>
                <div className="min-w-0 flex-1"><div className={d.checked?'text-sm line-through opacity-40':'text-sm font-semibold'}>{d.name}</div><div className="text-[10px] opacity-60">{[d.quantity,d.source&&'מתוך: '+d.source].filter(Boolean).join(' · ')}</div></div>
                {canWrite&&<div className="flex shrink-0 items-center gap-3"><button type="button" title="עריכת פריט" aria-label="עריכת פריט" onClick={()=>editShopping(item)} disabled={busy} className="text-stone-500 transition hover:text-emerald-700"><Pencil size={15}/></button><button type="button" title="מחיקת פריט" aria-label="מחיקת פריט" onClick={()=>void remove(item.id)} disabled={busy} className="text-rose-500 disabled:opacity-40"><Trash2 size={15}/></button></div>}
              </div>;})}
            </section>)}
          </div>
        }
      </section>
    </div>}
    {tab==='finance'&&<section className="homeos-finance-overview">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="homeos-section-kicker">חיבור נתונים פיננסיים</div><h2 className="mt-1 text-xl font-bold">הוצאות הבית מתוך פנקס העסקאות</h2><p className="mt-1 text-xs" style={{color:activeTheme.textSecondary}}>הנתונים מתעדכנים אוטומטית לאחר רישום או אימות עסקה</p></div>
        <button onClick={onOpenLedger} className="homeos-text-link">פתיחת פנקס העסקאות <ArrowUpRight size={15}/></button>
      </header>
      <div className="homeos-finance-summary">
        <div><span><ArrowDownRight size={14}/> הכנסות מאומתות החודש</span><strong>{money(finance.income)}</strong></div>
        <div><span><ArrowUpRight size={14}/> הוצאות מאומתות החודש</span><strong>{money(finance.expenseTotal)}</strong></div>
        <div><span>עסקאות שממתינות לאימות</span><strong>{finance.pending}</strong><small className="mt-1 block text-xs" style={{color:activeTheme.textSecondary}}>{money(finance.pendingAmount)} בשקלים · טרם נכלל בסיכום</small></div>
      </div>
      <section className="homeos-home-forecast">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="homeos-section-kicker">תכנון קדימה</div><h3 className="mt-1 text-lg font-bold">תחזית תזרים ל־12 חודשים</h3><p className="mt-1 text-xs" style={{color:activeTheme.textSecondary}}>אותו מנוע חישוב שמזין את לוח הבקרה, על בסיס שלושה חודשים מלאים של נתונים מאומתים.</p></div>
          <span className="homeos-forecast-tag">תרחיש בסיס</span>
        </div>
        {finance.forecast.available ? <>
          <div className="homeos-home-forecast-kpis">
            {finance.forecast.horizons.map(item=><div key={item.months}><span>תזרים מצטבר · {item.months} חודשים</span><strong className={item.netCents>=0?'positive':'negative'}>{money(item.netCents)}</strong><small>הכנסות {money(item.incomeCents)} · הוצאות {money(item.expenseCents)}</small></div>)}
          </div>
          <div className="homeos-forecast-bars" aria-label="תחזית תזרים מצטברת לשנים עשר חודשים">
            {finance.forecast.monthly.map(point=>{const max=Math.max(1,...finance.forecast.monthly.map(x=>Math.abs(x.cumulativeNetCents)));return <div key={point.key} title={point.label+': '+money(point.cumulativeNetCents)}><div className="homeos-forecast-bar-track"><span className={point.cumulativeNetCents>=0?'positive':'negative'} style={{height:Math.max(4,Math.abs(point.cumulativeNetCents)/max*100)+'%'}}/></div><small>{point.label}</small></div>;})}
          </div>
          <p className="mt-3 text-[10px] leading-5" style={{color:activeTheme.textSecondary}}>רמת ביטחון: {finance.forecast.confidence==='good'?'טובה':'בינונית'} · {finance.forecast.historyTransactions} עסקאות מאומתות. זהו תרחיש קבוע שאינו כולל עדיין התחייבויות עתידיות, שינויים בשכר או עונתיות.</p>
        </> : <div className="homeos-finance-empty">עדיין אין מספיק היסטוריה רציפה לתחזית אמינה. נדרשות לפחות 9 עסקאות מאומתות בשלושת החודשים המלאים האחרונים. המערכת לא תציג מספרים מומצאים.</div>}
      </section>
      {finance.pending>0&&<div className="homeos-data-notice">יש {finance.pending} עסקאות שיובאו מדפי חשבון וממתינות לאימות. הן מוצגות כאן כממתינות, ולא נכללות בסיכומי ההוצאות, בגרפים או ביתרות עד לאימות.</div>}
      {finance.foreignAccounts>0&&<div className="homeos-data-notice muted">קיימים {finance.foreignAccounts} חשבונות במטבע זר. הסיכומים הכספיים כאן מוצגים בשקלים בלבד, ללא המרת מטבע לא מאומתת.</div>}
      {finance.spendingAlerts.length>0&&<section className="homeos-spending-alerts">
        <div className="flex items-start gap-3"><span className="homeos-spending-alert-icon"><TrendingDown size={18}/></span><div><div className="homeos-section-kicker">בקרת הוצאות חכמה</div><h3 className="mt-1 text-base font-bold">סעיפים שדורשים בדיקה</h3><p className="mt-1 text-xs" style={{color:activeTheme.textSecondary}}>המערכת מזהה קצב הוצאה גבוה מהממוצע ההיסטורי באותה קטגוריה.</p></div></div>
        <div className="homeos-spending-alert-grid">
          {finance.spendingAlerts.map(item=><article key={item.category}><div className="text-xs font-bold">{item.category}</div><strong>{money(item.projected)}</strong><div className="text-[10px]" style={{color:activeTheme.textSecondary}}>תחזית חודשית · לעומת ממוצע {money(item.historicalAverage)}</div><span>פער משוער: +{money(item.increase)}</span></article>)}
        </div>
        <p className="mt-3 text-[10px]" style={{color:activeTheme.textSecondary}}>התרעות לבדיקה בלבד, לא קביעה שמדובר בחריגה שגויה. מבוססות על עסקאות מאומתות וקצב ההוצאה עד היום.</p>
      </section>}
            {finance.foreignCurrencies.length>0&&<div className="homeos-finance-foreign">
        <h3 className="text-sm font-bold">פעילות בחשבונות במטבע זר</h3>
        <p className="mt-1 text-xs" style={{color:activeTheme.textSecondary}}>הנתונים מוצגים לכל מטבע בנפרד, ללא המרה משוערת</p>
        {finance.foreignCurrencies.map(item=><div key={item.currency} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm" style={{borderColor:activeTheme.borderSubtle}}>
          <strong>{item.currency}</strong><span>הכנסות: {new Intl.NumberFormat('he-IL',{style:'currency',currency:item.currency,maximumFractionDigits:0}).format(item.income/100)}</span><span>הוצאות: {new Intl.NumberFormat('he-IL',{style:'currency',currency:item.currency,maximumFractionDigits:0}).format(item.expense/100)}</span>
        </div>)}
      </div>}
            <div className="homeos-finance-categories">
        <div><div className="homeos-section-kicker">חלוקה חודשית לפי קטגוריה</div><h3 className="mt-1 text-lg font-bold">חלוקת הוצאות לפי קטגוריה</h3></div>
        {finance.categories.length?finance.categories.map(([label,value],index)=>{
          const pct=finance.expenseTotal>0?Math.min(100,value/finance.expenseTotal*100):0;
          return <button type="button" aria-pressed={selectedFinanceCategory===label} className={"homeos-finance-category homeos-finance-category-button " + (selectedFinanceCategory===label?'is-selected':'')} key={label} onClick={()=>setSelectedFinanceCategory(selectedFinanceCategory===label?null:label)}>
            <div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold">{label}</span><strong className="shrink-0 text-sm tabular-nums">{money(value)}</strong></div>
            <div className="homeos-finance-track"><span style={{width:pct+'%',background:[activeTheme.accent,activeTheme.isDark?'#A3B7C8':activeTheme.accentMuted,'#8295A7','#A97972','#9C9A7D','#547D70','#8A9B85','#C49A69'][index%8]}}/></div>
            <div className="flex items-center justify-between gap-2 text-[10px]" style={{color:activeTheme.textSecondary}}><span>{pct.toFixed(1)}% מסך ההוצאות המאומתות</span><span>{selectedFinanceCategory===label?'לחץ לסגירה':'לחץ לפירוט עסקאות'}</span></div>
          </button>;
        }):<div className="homeos-finance-empty">עדיין אין הוצאות מאומתות לחודש הנוכחי. לאחר אימות עסקאות הן יופיעו כאן אוטומטית.</div>}
        {selectedFinanceCategory&&(()=>{
          const monthKey=iso(new Date()).slice(0,7);
          const matching=transactions.filter(tx=>tx.type==='EXPENSE'&&tx.verificationStatus!=='PENDING'&&tx.date?.slice(0,7)===monthKey&&(tx.category?.trim()||'ללא קטגוריה')===selectedFinanceCategory).sort((a,b)=>b.date.localeCompare(a.date));
          return <section className="homeos-finance-category-detail">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="homeos-section-kicker">פירוט קטגוריה</div><h3 className="mt-1 text-base font-bold">{selectedFinanceCategory}</h3><p className="mt-1 text-xs" style={{color:activeTheme.textSecondary}}>{matching.length} עסקאות מאומתות בחודש הנוכחי</p></div><button type="button" className="homeos-text-link" onClick={()=>setSelectedFinanceCategory(null)}>סגור פירוט ✕</button></div>
            {matching.length?<div className="mt-3 space-y-2">{matching.map(tx=><button type="button" key={tx.id} onClick={onOpenLedger} className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-right transition hover:bg-black/5" style={{borderColor:activeTheme.borderSubtle,background:activeTheme.bgSurface}}><span className="min-w-0"><strong className="block truncate text-sm">{tx.payee||tx.category||'עסקה'}</strong><small className="mt-1 block text-[10px]" style={{color:activeTheme.textSecondary}}>{tx.date} · {accounts.find(account=>account.id===tx.accountId)?.name||'חשבון'}</small></span><strong className="shrink-0 text-sm tabular-nums">{new Intl.NumberFormat('he-IL',{style:'currency',currency:accounts.find(account=>account.id===tx.accountId)?.currency||'ILS',maximumFractionDigits:0}).format(tx.amountCents/100)}</strong></button>)}</div>:<div className="mt-3 text-xs" style={{color:activeTheme.textSecondary}}>לא נמצאו עסקאות מפורטות בקטגוריה זו לתקופה הנוכחית.</div>}
          </section>;
        })()}
      </div>
    </section>}
    {tab==='tasks'&&<div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]"><section className={panel} style={ps}><h2 className="mb-4 text-lg font-bold">{editingTaskId?'עריכת משימה':'משימה חדשה'}</h2><div className="space-y-3"><input className={field} style={fs} placeholder="מה צריך לעשות?" value={taskTitle} onChange={e=>setTaskTitle(e.target.value)}/><input type="date" className={field} style={fs} value={taskDate} onChange={e=>setTaskDate(e.target.value)}/><input className={field} style={fs} placeholder="אחראי/ת (לא חובה)" value={assignee} onChange={e=>setAssignee(e.target.value)}/><div className="flex flex-wrap gap-2"><button disabled={!canWrite||busy||!taskTitle.trim()} onClick={()=>void addTask()} className={primary} style={prim}>{editingTaskId?<Check size={15}/>:<Plus size={15} />}{editingTaskId?'שמירת שינויים':'הוסף משימה'}</button>{editingTaskId&&<button disabled={busy} onClick={()=>{setEditingTaskId(null);setTaskTitle('');setTaskDate(iso(new Date()));setAssignee('');}} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold" style={fs}><X size={15}/>ביטול</button>}</div></div></section><section className={panel} style={ps}><h2 className="mb-4 text-lg font-bold">משימות הבית</h2>{tasks.length===0?<div className="py-10 text-center text-sm opacity-50">אין עדיין משימות</div>:tasks.map(x=>{const d=x.data as Task;return <div key={x.id} className="mb-2 flex items-center gap-3 rounded-xl border px-3 py-3" style={{borderColor:activeTheme.borderSubtle}}><button disabled={!canWrite} onClick={()=>void save('task',{...d,done:!d.done},x.id)} className="flex h-6 w-6 items-center justify-center rounded-md border" style={{borderColor:activeTheme.borderSubtle,background:d.done?activeTheme.accent:'transparent',color:activeTheme.isDark?activeTheme.textPrimary:activeTheme.bgCard}}>{d.done&&<Check size={14}/>}</button><div className="min-w-0 flex-1"><div className={d.done?'text-sm line-through opacity-40':'text-sm font-semibold'}>{d.title}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] opacity-60"><span>{d.dueDate||'ללא תאריך'}</span>{!d.done&&d.dueDate&&d.dueDate<iso(new Date())&&<strong className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">באיחור</strong>}{d.assignee&&<span>· {d.assignee}</span>}</div></div>{canWrite&&<div className="flex items-center gap-3"><button title="עריכת משימה" onClick={()=>editTask(x)} className="text-stone-500 hover:text-emerald-700"><Pencil size={15}/></button><button title="מחיקת משימה" onClick={()=>void remove(x.id)} disabled={busy} className="text-rose-500 disabled:opacity-40"><Trash2 size={15}/></button></div>}</div>})}</section></div>}
    <footer className="flex items-center justify-between text-[10px]" style={{color:activeTheme.textSecondary}}><span>הנתונים נשמרים מקומית ונכללים בגיבוי HOME OS</span><button onClick={()=>void refresh()} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2" style={fs}><RefreshCw size={12}/>רענון</button></footer>
  </div>;
}
