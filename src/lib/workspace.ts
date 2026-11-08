export type WorkspaceViewMode = 'executive' | 'productivity' | 'analytics';

export const WORKSPACE_VIEW_MODES: Array<{
  id: WorkspaceViewMode;
  name: string;
  nameHe: string;
  description: string;
}> = [
  { id: 'executive', name: 'Executive', nameHe: 'מנהלים', description: 'תמונת מצב מהירה, מדדים והחלטות חשובות' },
  { id: 'productivity', name: 'Productivity', nameHe: 'עבודה שוטפת', description: 'פעילות אחרונה, משימות ומעקב יומיומי' },
  { id: 'analytics', name: 'Analytics', nameHe: 'אנליטיקה', description: 'מגמות, תחזיות, פילוחים ובקרת נתונים' },
];

export const DASHBOARD_WIDGETS = [
  { id: 'net-worth', title: 'תמונת ההון', description: 'שווי נקי, נכסים והתחייבויות' },
  { id: 'monthly-kpis', title: 'מדדי החודש', description: 'הכנסות, הוצאות, מאזן ושינוי בהוצאות' },
  { id: 'cashflow-analysis', title: 'ניתוח תזרים', description: 'תנועת הכסף ופילוח הוצאות' },
  { id: 'cashflow-forecast', title: 'תחזית תזרים', description: 'תרחיש מצטבר ל-12 חודשים' },
  { id: 'advanced-analysis', title: 'ניתוח מתקדם', description: 'מגמות, חריגות, הוצאות חוזרות ואיכות נתונים' },
  { id: 'foreign-currency', title: 'מטבע חוץ', description: 'פעילות בחשבונות במטבע זר' },
  { id: 'household-snapshot', title: 'תמונת מצב הבית', description: 'ארוחות, משימות ורשימת קניות' },
  { id: 'recent-activity', title: 'פעילות וחשבונות', description: 'עסקאות אחרונות ויתרות חשבונות' },
  { id: 'financial-insight', title: 'תובנה פיננסית', description: 'המלצה המבוססת על הפעילות שנרשמה' },
] as const;

export type DashboardWidgetId = typeof DASHBOARD_WIDGETS[number]['id'];
export const DEFAULT_DASHBOARD_WIDGET_ORDER: DashboardWidgetId[] = DASHBOARD_WIDGETS.map((widget) => widget.id);

export type DashboardWidgetSize = 'compact' | 'standard' | 'expanded';


export const BACKGROUND_PRESETS = [
  { id: 'warm_linen', nameHe: 'פשתן חם', description: 'נייר טבעי וגווני חול רכים', background: 'radial-gradient(ellipse at 12% 8%, rgba(210,180,140,.26) 0%, transparent 42%), radial-gradient(ellipse at 90% 88%, rgba(189,164,128,.18) 0%, transparent 36%), linear-gradient(135deg, #f7f2e9 0%, #e9e1d5 100%)' },
  { id: 'nordic_mist', nameHe: 'ערפל נורדי', description: 'אבן בהירה, אפור וכחול מעושן', background: 'radial-gradient(ellipse at 82% 12%, rgba(156,184,190,.25) 0%, transparent 40%), radial-gradient(ellipse at 8% 92%, rgba(190,201,198,.3) 0%, transparent 38%), linear-gradient(135deg, #eef2f0 0%, #dce5e4 100%)' },
  { id: 'sage_garden', nameHe: 'גן מרווה', description: 'ירוק מרווה עדין ואווירה טבעית', background: 'radial-gradient(ellipse at 16% 18%, rgba(117,145,112,.24) 0%, transparent 42%), radial-gradient(ellipse at 88% 86%, rgba(177,190,153,.28) 0%, transparent 38%), linear-gradient(135deg, #edf0e7 0%, #dce5d7 100%)' },
  { id: 'terracotta', nameHe: 'אדמת טרקוטה', description: 'חמרה, אבן בהירה וחום טבעי', background: 'radial-gradient(ellipse at 84% 15%, rgba(191,120,88,.22) 0%, transparent 40%), radial-gradient(ellipse at 12% 90%, rgba(216,174,141,.28) 0%, transparent 38%), linear-gradient(135deg, #f3e8dc 0%, #e6d4c4 100%)' },
  { id: 'midnight_ink', nameHe: 'דיו לילי', description: 'כחול עמוק ופחם אלגנטי', background: 'radial-gradient(ellipse at 12% 12%, rgba(76,105,151,.32) 0%, transparent 42%), radial-gradient(ellipse at 92% 88%, rgba(91,75,123,.24) 0%, transparent 38%), linear-gradient(135deg, #202a3b 0%, #111925 100%)' },
  { id: 'deep_forest', nameHe: 'יער עמוק', description: 'ירוק יער, אזוב ונגיעות זהב', background: 'radial-gradient(ellipse at 82% 12%, rgba(128,151,103,.26) 0%, transparent 40%), radial-gradient(ellipse at 12% 88%, rgba(57,104,79,.35) 0%, transparent 40%), linear-gradient(135deg, #1e332b 0%, #11231e 100%)' },
  { id: 'soft_stone', nameHe: 'אבן רכה', description: 'אפור אבן, לבן שבור ומרקם רגוע', background: 'radial-gradient(ellipse at 8% 10%,rgba(156,163,175,.25) 0%,transparent 40%),linear-gradient(135deg,#f3f2ee,#dfe2df)' },
  { id: 'blue_hour', nameHe: 'שעת כחול', description: 'כחול עמוק עם אור ערב קריר', background: 'radial-gradient(ellipse at 20% 8%,rgba(81,125,177,.35) 0%,transparent 42%),radial-gradient(ellipse at 90% 92%,rgba(94,92,156,.25) 0%,transparent 38%),linear-gradient(135deg,#243b58,#111b2c)' },
  { id: 'paper_grid', nameHe: 'נייר רשת', description: 'נייר בהיר עם רשת דקה ולא מסיחה', background: 'linear-gradient(rgba(100,116,139,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(100,116,139,.055) 1px,transparent 1px),linear-gradient(135deg,#fbfcfa,#edf1ef)' },
  { id: 'misty_sage', nameHe: 'ערפל מרווה', description: 'ירוק מעושן ואפור בהיר', background: 'radial-gradient(ellipse at 82% 16%,rgba(111,145,123,.23) 0%,transparent 42%),linear-gradient(135deg,#eef3ed,#dce7df)' },
  { id: 'clay_blush', nameHe: 'חרס ורדרד', description: 'גווני חרס, ורוד מעושן ושמנת', background: 'radial-gradient(ellipse at 85% 12%,rgba(193,130,118,.22) 0%,transparent 40%),linear-gradient(135deg,#f8efea,#ead9d1)' },
  { id: 'aurora_night', nameHe: 'זוהר צפוני', description: 'שכבות אור ירוק וכחול על פחם', background: 'radial-gradient(ellipse at 18% 12%,rgba(16,185,129,.25) 0%,transparent 42%),radial-gradient(ellipse at 88% 82%,rgba(59,130,246,.22) 0%,transparent 40%),linear-gradient(135deg,#111c2a,#0a111d)' },
  { id: 'graphite_mesh', nameHe: 'רשת גרפיט', description: 'רקע טכני כהה עם קווים עדינים', background: 'linear-gradient(rgba(148,163,184,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.055) 1px,transparent 1px),linear-gradient(135deg,#202a34,#111922)' },
  { id: 'linen_rose', nameHe: 'פשתן ורוד', description: 'פשתן חמים עם נגיעת ורוד מעושן', background: 'radial-gradient(ellipse at 12% 15%,rgba(210,155,143,.22) 0%,transparent 42%),linear-gradient(135deg,#f7f0eb,#e9dfd9)' },
] as const;

export type WorkspaceBackgroundPresetId = typeof BACKGROUND_PRESETS[number]['id'];


export type WorkspaceFontId = 'hebrew_sans' | 'humanist' | 'editorial' | 'mono';
export type WorkspaceCardStyle = 'executive' | 'flat' | 'outlined' | 'glass';
export interface WorkspaceAppearancePreferences {
  brightness: number;
  fontScale: number;
  font: WorkspaceFontId;
  cardStyle: WorkspaceCardStyle;
}
export const DEFAULT_WORKSPACE_APPEARANCE: WorkspaceAppearancePreferences = {
  brightness:100,fontScale:100,font:'hebrew_sans',cardStyle:'executive',
};
export const WORKSPACE_FONT_OPTIONS: Array<{id:WorkspaceFontId;label:string;css:string;description:string}> = [
  {id:'hebrew_sans',label:'עברית נקייה',css:'Arial, "Helvetica Neue", sans-serif',description:'קריאה, פשוטה ונוחה'},
  {id:'humanist',label:'הומניסטית',css:'"Trebuchet MS", Arial, sans-serif',description:'רכה וידידותית'},
  {id:'editorial',label:'סריפית עריכתית',css:'Georgia, "David", serif',description:'מראה מגזיני וקלאסי'},
  {id:'mono',label:'טכנית',css:'"Courier New", monospace',description:'מראה מסוף מדויק'},
];
export const WORKSPACE_CARD_STYLE_OPTIONS: Array<{id:WorkspaceCardStyle;label:string;description:string}> = [
  {id:'executive',label:'מנהלים',description:'משטחים מדויקים עם עומק עדין'},
  {id:'flat',label:'שטוח ונקי',description:'מינימום קווים והצללות'},
  {id:'outlined',label:'קווי מתאר',description:'הפרדה ברורה בין כל אזור'},
  {id:'glass',label:'זכוכית רכה',description:'משטחים שקופים ועדינים'},
];
export function normalizeWorkspaceAppearance(value: unknown): WorkspaceAppearancePreferences {
  if(!value||typeof value!=='object') return {...DEFAULT_WORKSPACE_APPEARANCE};
  const candidate=value as Partial<WorkspaceAppearancePreferences>;
  const font=WORKSPACE_FONT_OPTIONS.some(option=>option.id===candidate.font)?candidate.font!:DEFAULT_WORKSPACE_APPEARANCE.font;
  const cardStyle=WORKSPACE_CARD_STYLE_OPTIONS.some(option=>option.id===candidate.cardStyle)?candidate.cardStyle!:DEFAULT_WORKSPACE_APPEARANCE.cardStyle;
  const brightness=Number.isFinite(candidate.brightness)?Math.min(125,Math.max(75,Math.round(candidate.brightness!/5)*5)):100;
  const fontScale=Number.isFinite(candidate.fontScale)?Math.min(115,Math.max(90,Math.round(candidate.fontScale!/5)*5)):100;
  return {brightness,fontScale,font,cardStyle};
}
