import type { IDRPlanParams, TaxBracket } from './types.js';

// ============================================
// Federal Poverty Guidelines (2024)
// Update annually from HHS
// ============================================

export const POVERTY_LINE_BASE = 15060;
export const POVERTY_LINE_PER_PERSON = 5380;

export function getPovertyLine(familySize: number): number {
  return POVERTY_LINE_BASE + Math.max(0, familySize - 1) * POVERTY_LINE_PER_PERSON;
}

// ============================================
// IDR Plan Parameters
// ============================================

export const IDR_PLANS: Record<string, IDRPlanParams> = {
  SAVE: {
    name: 'SAVE (Saving on a Valuable Education)',
    discretionaryIncomePercent: 0.10,
    povertyLineMultiplier: 2.25,
    forgivenessYears: 25,
    interestSubsidy: true,
    capsPaymentAt10YearStandard: false,
    undergraduateRate: 0.05,
  },
  PAYE: {
    name: 'PAYE (Pay As You Earn)',
    discretionaryIncomePercent: 0.10,
    povertyLineMultiplier: 1.50,
    forgivenessYears: 20,
    interestSubsidy: false,
    capsPaymentAt10YearStandard: true,
  },
  IBR_NEW: {
    name: 'IBR (New Borrowers after 2014)',
    discretionaryIncomePercent: 0.10,
    povertyLineMultiplier: 1.50,
    forgivenessYears: 20,
    interestSubsidy: false,
    capsPaymentAt10YearStandard: true,
  },
  IBR_OLD: {
    name: 'IBR (Borrowers before 2014)',
    discretionaryIncomePercent: 0.15,
    povertyLineMultiplier: 1.50,
    forgivenessYears: 25,
    interestSubsidy: false,
    capsPaymentAt10YearStandard: true,
  },
  ICR: {
    name: 'ICR (Income-Contingent Repayment)',
    discretionaryIncomePercent: 0.20,
    povertyLineMultiplier: 1.00,
    forgivenessYears: 25,
    interestSubsidy: false,
    capsPaymentAt10YearStandard: false,
  },
};

// ============================================
// Resident/Fellow Salary Progression
// National averages, update annually
// ============================================

export const TRAINING_SALARIES: Record<string, number> = {
  ms4: 0,
  pgy1: 64000,
  pgy2: 66000,
  pgy3: 69000,
  pgy4: 72000,
  pgy5: 75000,
  pgy6: 78000,
  pgy7: 81000,
  fellow: 85000,
};

// ============================================
// Federal Tax Brackets (2024, Single)
// ============================================

export const FEDERAL_BRACKETS_SINGLE: TaxBracket[] = [
  { threshold: 0, rate: 0.10 },
  { threshold: 11600, rate: 0.12 },
  { threshold: 47150, rate: 0.22 },
  { threshold: 100525, rate: 0.24 },
  { threshold: 191950, rate: 0.32 },
  { threshold: 243725, rate: 0.35 },
  { threshold: 609350, rate: 0.37 },
];

export const FEDERAL_BRACKETS_MFJ: TaxBracket[] = [
  { threshold: 0, rate: 0.10 },
  { threshold: 23200, rate: 0.12 },
  { threshold: 94300, rate: 0.22 },
  { threshold: 201050, rate: 0.24 },
  { threshold: 383900, rate: 0.32 },
  { threshold: 487450, rate: 0.35 },
  { threshold: 731200, rate: 0.37 },
];

export const FEDERAL_BRACKETS_MFS: TaxBracket[] = [
  { threshold: 0, rate: 0.10 },
  { threshold: 11600, rate: 0.12 },
  { threshold: 47150, rate: 0.22 },
  { threshold: 100525, rate: 0.24 },
  { threshold: 191950, rate: 0.32 },
  { threshold: 243725, rate: 0.35 },
  { threshold: 365600, rate: 0.37 },
];

// ============================================
// State Tax Rates (simplified top marginal)
// ============================================

export const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.05, AK: 0, AZ: 0.025, AR: 0.047, CA: 0.133,
  CO: 0.044, CT: 0.0699, DE: 0.066, FL: 0, GA: 0.0549,
  HI: 0.11, ID: 0.058, IL: 0.0495, IN: 0.0315, IA: 0.06,
  KS: 0.057, KY: 0.04, LA: 0.0425, ME: 0.0715, MD: 0.0575,
  MA: 0.09, MI: 0.0425, MN: 0.0985, MS: 0.05, MO: 0.048,
  MT: 0.059, NE: 0.0584, NV: 0, NH: 0.05, NJ: 0.1075,
  NM: 0.059, NY: 0.109, NC: 0.0475, ND: 0.0225, OH: 0.035,
  OK: 0.0475, OR: 0.099, PA: 0.0307, RI: 0.0599, SC: 0.064,
  SD: 0, TN: 0, TX: 0, UT: 0.0465, VT: 0.0875,
  VA: 0.0575, WA: 0, WV: 0.055, WI: 0.0765, WY: 0,
  DC: 0.105,
};

// ============================================
// Default Assumptions
// ============================================

export const DEFAULTS = {
  discountRate: 0.05,
  incomeGrowthRate: 0.03,
  inflationRate: 0.025,
  refiRate: 0.055,
  refiTermYears: 10,
  pslfConfidence: 0.85,
  savePlanAvailable: false,  // Currently enjoined
};

// ============================================
// PSLF Constants
// ============================================

export const PSLF = {
  requiredPayments: 120,
  taxableForgiveness: false,
  requiresFullTime: true,  // 30+ hours/week
};
