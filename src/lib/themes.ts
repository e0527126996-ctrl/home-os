/**
 * HOME OS — Modern Editorial 12 Curated Themes
 */

export interface ThemeConfig {
  id: string;
  nameHe: string;
  nameEn: string;
  isDark: boolean;
  bgCanvas: string;
  bgSurface: string;
  bgCard: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentMuted: string;
  description: string;
}

export const MODERN_EDITORIAL_THEMES: ThemeConfig[] = [
  {
    id: 'warm_editorial',
    nameHe: 'שמנת עריכתית (Warm Editorial)',
    nameEn: 'Warm Editorial',
    isDark: false,
    bgCanvas: '#FAF8F5',
    bgSurface: '#F3EFEA',
    bgCard: '#FFFFFF',
    borderSubtle: '#E6E0D8',
    textPrimary: '#1E1B18',
    textSecondary: '#6B645C',
    accent: '#B45309', // Amber Terracotta
    accentMuted: '#FEF3C7',
    description: 'מראה מגזיני חם עם גווני אלבסטר, שקט ויזואלי ומרווחי נשימה',
  },
  {
    id: 'nordic_limestone',
    nameHe: 'אבן גיר נורדית (Nordic Limestone)',
    nameEn: 'Nordic Limestone',
    isDark: false,
    bgCanvas: '#F5F5F3',
    bgSurface: '#EBEBE6',
    bgCard: '#FFFFFF',
    borderSubtle: '#DCDCD5',
    textPrimary: '#1A1C1E',
    textSecondary: '#626569',
    accent: '#475569', // Slate
    accentMuted: '#E2E8F0',
    description: 'סגנון סקנדינבי מאופק בגווני חול ואפור בהיר עם טיפוגרפיה חדה',
  },
  {
    id: 'gallery_alabaster',
    nameHe: 'גלריה לבנה (Gallery Alabaster)',
    nameEn: 'Gallery Alabaster',
    isDark: false,
    bgCanvas: '#FFFFFF',
    bgSurface: '#F8F9FA',
    bgCard: '#FFFFFF',
    borderSubtle: '#E9ECEF',
    textPrimary: '#0A0A0A',
    textSecondary: '#6C757D',
    accent: '#0F172A', // Deep Ink
    accentMuted: '#F1F5F9',
    description: 'סגנון מוזיאוני מינימליסטי חד, ניגודיות גבוהה וסדר קפדני',
  },
  {
    id: 'atelier_slate',
    nameHe: 'אטליה צפחה (Atelier Slate)',
    nameEn: 'Atelier Slate',
    isDark: true,
    bgCanvas: '#0F172A',
    bgSurface: '#1E293B',
    bgCard: '#1E293B',
    borderSubtle: '#334155',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    accent: '#38BDF8', // Sky
    accentMuted: '#0C4A6E',
    description: 'סטודיו דיגיטלי כהה ואלגנטי עם קווי מתאר עדינים',
  },
  {
    id: 'lapis_ivory',
    nameHe: 'לפיס ושנהב (Lapis & Ivory)',
    nameEn: 'Lapis & Ivory',
    isDark: false,
    bgCanvas: '#F9F8F5',
    bgSurface: '#F0EFE9',
    bgCard: '#FFFFFF',
    borderSubtle: '#E2DFD6',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    accent: '#1E3A8A', // Deep Lapis Blue
    accentMuted: '#DBEAFE',
    description: 'שילוב מלכותי של כחול עמוק על רקע שמנת חמימה',
  },
  {
    id: 'terracotta_earth',
    nameHe: 'אדמת טרקוטה (Terracotta Earth)',
    nameEn: 'Terracotta Earth',
    isDark: false,
    bgCanvas: '#FBF7F4',
    bgSurface: '#F4ECE6',
    bgCard: '#FFFFFF',
    borderSubtle: '#E8DCD3',
    textPrimary: '#261D1A',
    textSecondary: '#786963',
    accent: '#C2410C', // Rich Terracotta
    accentMuted: '#FFEDD5',
    description: 'חום ים-תיכוני טבעי עם הדגשות אדמה עשירות',
  },
  {
    id: 'sage_botanical',
    nameHe: 'מרווה בוטנית (Sage Botanical)',
    nameEn: 'Sage Botanical',
    isDark: false,
    bgCanvas: '#F7F9F6',
    bgSurface: '#EDF2EB',
    bgCard: '#FFFFFF',
    borderSubtle: '#DCE4DA',
    textPrimary: '#19241B',
    textSecondary: '#5A695D',
    accent: '#15803D', // Forest Green
    accentMuted: '#DCFCE7',
    description: 'איזון אורגני עדין עם גווני זית, פשתן וירוק עלים',
  },
  {
    id: 'midnight_executive',
    nameHe: 'חצות יוקרתי (Midnight Executive)',
    nameEn: 'Midnight Executive',
    isDark: true,
    bgCanvas: '#090D16',
    bgSurface: '#121826',
    bgCard: '#151D2E',
    borderSubtle: '#1F293D',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    accent: '#F59E0B', // Warm Gold/Amber
    accentMuted: '#451A03',
    description: 'יוקרה מאופקת בלילה: שחור עמוק עם מגע מוזהב עדין',
  },
  {
    id: 'deep_forest',
    nameHe: 'יער עמוק (Deep Forest)',
    nameEn: 'Deep Forest',
    isDark: true,
    bgCanvas: '#0A130D',
    bgSurface: '#122017',
    bgCard: '#15261B',
    borderSubtle: '#1C3325',
    textPrimary: '#EDF4EE',
    textSecondary: '#8CA392',
    accent: '#22C55E', // Emerald
    accentMuted: '#052E16',
    description: 'אווירה מיוערת ועמוקה עם ירוק כהה וטקסט פפירוס בהיר',
  },
  {
    id: 'monochrome_ink',
    nameHe: 'דיו מונוכרום (Monochrome Ink)',
    nameEn: 'Monochrome Ink',
    isDark: false,
    bgCanvas: '#FAFAFA',
    bgSurface: '#F4F4F5',
    bgCard: '#FFFFFF',
    borderSubtle: '#E4E4E7',
    textPrimary: '#09090B',
    textSecondary: '#71717A',
    accent: '#18181B', // Pure Carbon
    accentMuted: '#F4F4F5',
    description: 'עריכה דפוסית שחור-לבן ללא צבעים מסיחים, מיקוד מוחלט בטקסט',
  },
  {
    id: 'cashmere_taupe',
    nameHe: 'קשמיר טואופ (Cashmere Taupe)',
    nameEn: 'Cashmere Taupe',
    isDark: false,
    bgCanvas: '#F8F6F4',
    bgSurface: '#EFECE8',
    bgCard: '#FFFFFF',
    borderSubtle: '#DDD7D0',
    textPrimary: '#221F1C',
    textSecondary: '#6F6862',
    accent: '#854D0E', // Bronze
    accentMuted: '#FEF9C3',
    description: 'אלגנטיות צמר רכה ומחמיאה בגווני חום-אפור וברונזה',
  },
  {
    id: 'high_contrast_editorial',
    nameHe: 'קונטרסט גבוה (High Contrast)',
    nameEn: 'High Contrast Editorial',
    isDark: true,
    bgCanvas: '#000000',
    bgSurface: '#121212',
    bgCard: '#181818',
    borderSubtle: '#333333',
    textPrimary: '#FFFFFF',
    textSecondary: '#BBBBBB',
    accent: '#38BDF8', // Electric Cyan
    accentMuted: '#1E293B',
    description: 'ניגודיות מרבית לקריאות מושלמת בכל תנאי תאורה',
  },
];
