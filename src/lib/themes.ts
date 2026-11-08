/**
 * HOME OS — Executive Terminal + Curated Editorial Themes
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
    id: 'maison_noir', nameHe: 'מזון נואר — שחור שמפניה', nameEn: 'Maison Noir',
    isDark: true, bgCanvas: '#0B0B0C', bgSurface: '#121314', bgCard: '#191A1B',
    borderSubtle: '#34302A', textPrimary: '#F3F0E8', textSecondary: '#AAA49A',
    accent: '#C6A66B', accentMuted: '#352B1B',
    description: 'שחור אדריכלי, שנהב וזהב שמפניה — יוקרה שקטה ומדויקת',
  },
  {
    id: 'ivory_atelier', nameHe: 'אטלייה שנהב', nameEn: 'Ivory Atelier',
    isDark: false, bgCanvas: '#F5F2EB', bgSurface: '#ECE7DD', bgCard: '#FFFEFA',
    borderSubtle: '#DED6C8', textPrimary: '#25231F', textSecondary: '#777065',
    accent: '#A88956', accentMuted: '#EFE5D3',
    description: 'שנהב טבעי, אבן בהירה וזהב מט — מראה ביתי-יוקרתי',
  },
  {
    id: 'executive_terminal',
    nameHe: 'מסוף מנהלים (Executive Terminal)',
    nameEn: 'Executive Terminal',
    isDark: true,
    bgCanvas: '#0B1117',
    bgSurface: '#111A22',
    bgCard: '#151F28',
    borderSubtle: '#293640',
    textPrimary: '#E8EEF1',
    textSecondary: '#91A0A9',
    accent: '#10B981',
    accentMuted: '#0B3B31',
    description: 'מסוף ניהול כהה ומדויק בגוני פחם וצפחה, עם אמרלד עמוק ונגיעות זהב מט',
  },
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
  {
    id: 'carbon_gold_luxury',
    nameHe: 'פחם וזהב (Carbon Gold Luxury)',
    nameEn: 'Carbon Gold Luxury',
    isDark: true,
    bgCanvas: '#0F1115',
    bgSurface: '#141820',
    bgCard: '#181C24',
    borderSubtle: 'rgba(212, 175, 55, 0.25)',
    textPrimary: '#F4F1E8',
    textSecondary: '#A9A69D',
    accent: '#D4AF37',
    accentMuted: '#3A321D',
    description: 'שחור פחם עמוק, משטחי מתכת כהים, זהב מוברש והדגשות אמרלד',
  },
  {
    id:'ocean_graphite',nameHe:'גרפיט אוקייני',nameEn:'Ocean Graphite',isDark:true,
    bgCanvas:'#081820',bgSurface:'#102832',bgCard:'#15313B',borderSubtle:'#294751',
    textPrimary:'#E7F2F3',textSecondary:'#91B0B5',accent:'#37C5B0',accentMuted:'#123F40',
    description:'כחול-פחם עמוק עם טורקיז מאופק',
  },
  {
    id:'porcelain_sand',nameHe:'פורצלן וחול',nameEn:'Porcelain Sand',isDark:false,
    bgCanvas:'#F7F5EF',bgSurface:'#EDEAE1',bgCard:'#FFFDF8',borderSubtle:'#DED9CC',
    textPrimary:'#292923',textSecondary:'#777365',accent:'#687D78',accentMuted:'#E0E9E3',
    description:'לבן שבור, אבן טבעית וירוק-אפור שקט',
  },
  {
    id:'plum_noir',nameHe:'שזיף לילי',nameEn:'Plum Noir',isDark:true,
    bgCanvas:'#17121D',bgSurface:'#211A29',bgCard:'#2A2133',borderSubtle:'#46364F',
    textPrimary:'#F5EEF7',textSecondary:'#B6A5BE',accent:'#C08AD7',accentMuted:'#432A50',
    description:'סגול-פחם עמוק עם הדגשות לילך',
  },
  {
    id:'olive_atelier',nameHe:'אטלייה זית',nameEn:'Olive Atelier',isDark:false,
    bgCanvas:'#F4F3EA',bgSurface:'#E9E8D9',bgCard:'#FCFCF5',borderSubtle:'#D9D8C5',
    textPrimary:'#252A20',textSecondary:'#707563',accent:'#687A3D',accentMuted:'#E6EBD5',
    description:'זית, אבן בהירה ונגיעות מרווה טבעיות',
  },
  {
    id:'arctic_blue',nameHe:'קרח כחול',nameEn:'Arctic Blue',isDark:true,
    bgCanvas:'#0C1726',bgSurface:'#14243A',bgCard:'#192D46',borderSubtle:'#2B4663',
    textPrimary:'#EDF5FF',textSecondary:'#9CB2CA',accent:'#63B3ED',accentMuted:'#173C63',
    description:'כחול קר ומודרני עם ניגודיות גבוהה',
  },
  {
    id:'copper_studio',nameHe:'סטודיו נחושת',nameEn:'Copper Studio',isDark:false,
    bgCanvas:'#F8F3EE',bgSurface:'#F0E6DD',bgCard:'#FFFCF8',borderSubtle:'#E4D3C5',
    textPrimary:'#30231C',textSecondary:'#806A5D',accent:'#A65D3F',accentMuted:'#F4E1D5',
    description:'נחושת חמה, שמנת ותחושת סטודיו מעוצבת',
  }

];
