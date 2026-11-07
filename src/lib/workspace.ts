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
] as const;

export type WorkspaceBackgroundPresetId = typeof BACKGROUND_PRESETS[number]['id'];
