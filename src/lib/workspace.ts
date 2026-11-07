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
