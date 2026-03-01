import budgetByState from './budget-by-state.json';

const COLORS: Record<string, string> = {
  education:      '#4F86C6',
  housing:        '#E8875A',
  transportation: '#6BAE75',
  public_safety:  '#C47DBB',
  environment:    '#5BB8C4',
  healthcare:     '#E8C15A',
};

const LABELS: Record<string, string> = {
  education:      'Education',
  housing:        'Housing',
  transportation: 'Transportation',
  public_safety:  'Public Safety',
  environment:    'Environment',
  healthcare:     'Healthcare',
};

export function getBudgetForState(stateAbbr: string) {
  const state = (budgetByState as any)[stateAbbr] ?? (budgetByState as any)['CA'];
  return Object.entries(state).map(([id, d]: [string, any]) => ({
    id,
    label: LABELS[id] ?? id,
    amount: d.amount,
    pct_change: d.pct_change,
    color: COLORS[id] ?? '#999',
  }));
}

export const CA_BUDGET_2023 = getBudgetForState('CA');
export const TOTAL = CA_BUDGET_2023.reduce((s, d) => s + d.amount, 0);
