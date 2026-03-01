export interface UserProfile {
  zip_code: string;
  housing_status: 'renter' | 'owner' | 'other';
  has_children: boolean;
  household_income_bracket: 'under_50k' | '50_100k' | '100_200k' | 'over_200k';
  primary_concerns: string[];
  job?: string;
  goals?: string[];
  age_bracket?: 'under_25' | '25_34' | '35_49' | '50_64' | '65_plus';
  commute_method?: 'drive' | 'transit' | 'bike_walk' | 'wfh';
  owns_business?: boolean;
}

export interface Citation {
  chunk_id: string;
  chunk_text: string;
  source_url: string;
  plain_translation: string;
  relevance_score: number;
}

export interface BudgetShift {
  category: string;
  delta_pct: number;
  delta_usd: number;
  personal_annual_usd: number;
}

export interface MapPin {
  lat: number;
  lon: number;
  label: string;
  category: string;
  measure_id: string;
  address?: string;
}

export interface ExplainResponse {
  measure_id: string;
  measure_title: string;
  plain_english_summary: string;
  personal_impact_statement: string;
  citations: Citation[];
  budget_shifts: BudgetShift[];
  map_pins: MapPin[];
  confidence_score: number;
}

export interface ExplainRequest {
  measure_id: string;
  measure_text: string;
  measure_title: string;
  user: UserProfile;
}

export interface BudgetRequest {
  measure_id: string;
  user: UserProfile;
}

export interface BudgetResponse {
  shifts: BudgetShift[];
  model_r2: number;
}

export interface Topic {
  id: string;
  label: string;
  icon: string;
}

export interface BudgetCategory {
  category: string;
  amount_usd: number;
  pct_of_total: number;
}

export interface CandidateBudgetPlan {
  category: string;
  delta_pct: number;
}

export interface Candidate {
  candidate_id: string;
  name: string;
  party: string;
  bio: string;
  priorities: string[];
  budget_plan: CandidateBudgetPlan[];
}

export interface Race {
  race_id: string;
  position: string;
  jurisdiction: string;
  candidates: Candidate[];
}

export interface FollowMoneyResponse {
  jurisdiction: string;
  total_budget_usd: number;
  categories: BudgetCategory[];
  candidates: Candidate[];
}

export type CategoryType =
  | 'housing'
  | 'education'
  | 'transportation'
  | 'public_safety'
  | 'environment'
  | 'healthcare'
  | 'economy'
  | 'other';

// Paper & Pastels — muted enough to feel stationery-like, saturated enough for text legibility
export const CATEGORY_COLORS: Record<CategoryType, string> = {
  housing:       '#7C6FD4', // lavender
  education:     '#C2955A', // sand
  transportation:'#5BA89F', // dusty teal / mint
  public_safety: '#C9706C', // dusty rose
  environment:   '#6AAB74', // sage green
  healthcare:    '#5B9BC4', // soft blue
  economy:       '#B8944A', // warm gold
  other:         '#94a3b8', // slate
};