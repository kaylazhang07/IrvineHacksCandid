import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CATEGORY_COLORS, CategoryType } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDollar(n: number): string {
  const safe = isFinite(+n) ? +n : 0;
  const abs  = Math.abs(Math.round(safe));
  const sign = safe >= 0 ? '+' : '-';
  return `${sign}$${abs.toLocaleString()}/yr`;
}

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category as CategoryType] ?? CATEGORY_COLORS.other;
}

const _ST: Record<string,string> = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia'};
const _BT: Record<string,string> = {SB:'Senate Bill',AB:'Assembly Bill',HB:'House Bill',HR:'House Resolution',S:'Senate Bill',SR:'Senate Resolution',SJR:'Senate Joint Resolution',HJR:'House Joint Resolution'};
export function prettifyTitle(title: string, measureId?: string): string {
  let t: string;
  try { t = decodeURIComponent(title || measureId || ''); } catch { t = title || measureId || ''; }
  const m = t.match(/^([A-Z]{2})[- ]+([A-Z]+)\s*(\d+)$/);
  if (m) return (_ST[m[1]]||m[1]) + ' ' + (_BT[m[2]]||m[2]) + ' ' + m[3];
  return t;
}
