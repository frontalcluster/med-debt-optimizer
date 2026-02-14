// ============================================
// Core Types for Med Debt Optimizer
// ============================================

export type LoanType = 'direct_unsub' | 'direct_sub' | 'direct_plus' | 'ffel' | 'perkins';
export type FilingStatus = 'single' | 'mfj' | 'mfs';
export type TrainingStage = 'ms4' | 'pgy1' | 'pgy2' | 'pgy3' | 'pgy4' | 'pgy5' | 'pgy6' | 'pgy7' | 'fellow' | 'attending';
export type RiskTolerance = 'low' | 'medium' | 'high';
export type IDRPlanName = 'SAVE' | 'PAYE' | 'IBR_NEW' | 'IBR_OLD' | 'ICR';

// ============================================
// Input Types
// ============================================

export interface LoanPortfolio {
  totalBalance: number;
  weightedInterestRate: number;  // decimal, e.g., 0.065 for 6.5%
  loanTypes: LoanType[];
  pslfQualifyingPayments: number;  // 0-120
  idrQualifyingPayments: number;   // 0-300
}

export interface PersonalInfo {
  agi: number;
  spouseAgi: number;
  filingStatus: FilingStatus;
  familySize: number;
  state: string;
  pslfEligibleEmployer: boolean;
}

export interface CareerInfo {
  specialty: string;
  currentStage: TrainingStage;
  trainingYearsRemaining: number;
  expectedAttendingSalary?: number;  // override specialty default
}

export interface Preferences {
  discountRate: number;           // default 0.05 (5%)
  pslfConfidence: number;         // 0-1, belief program will exist
  savePlanAvailable: boolean;     // litigation status
  riskTolerance: RiskTolerance;
}

export interface UserInputs {
  loans: LoanPortfolio;
  personal: PersonalInfo;
  career: CareerInfo;
  preferences: Preferences;
}

// ============================================
// Reference Data Types
// ============================================

export interface IDRPlanParams {
  name: string;
  discretionaryIncomePercent: number;
  povertyLineMultiplier: number;
  forgivenessYears: number;
  interestSubsidy: boolean;
  capsPaymentAt10YearStandard: boolean;
  undergraduateRate?: number;  // SAVE has different rate for undergrad
}

export interface SpecialtyData {
  name: string;
  medianAttendingSalary: number;
  salaryP25: number;
  salaryP75: number;
  typicalTrainingYears: number;
  pslfPrevalence: number;  // % who work at eligible employers
}

export interface TaxBracket {
  threshold: number;
  rate: number;
}

// ============================================
// Calculation Output Types
// ============================================

export interface IncomeProjection {
  year: number;
  income: number;
  stage: TrainingStage | 'attending';
}

export interface YearlyLoanState {
  year: number;
  startingBalance: number;
  interestAccrued: number;
  paymentsMade: number;
  endingBalance: number;
  interestSubsidized: number;
  cumulativePayments: number;
}

export interface StrategyResult {
  strategyName: string;
  description: string;
  totalPayments: number;
  forgivenessAmount: number;
  taxOnForgiveness: number;
  npv: number;
  totalYears: number;
  monthlyPaymentRange: { min: number; max: number };
  yearlyBreakdown: YearlyLoanState[];
  risks: string[];
  benefits: string[];
}

export interface FilingComparison {
  mfj: { totalTax: number; loanPayment: number; netAnnualCost: number };
  mfs: { totalTax: number; loanPayment: number; netAnnualCost: number };
  recommendation: FilingStatus;
  annualSavings: number;
}

export interface PSLFSalaryPremiumParams {
  pslfNPV: number;
  bestNonPslfNPV: number;
  pslfYearsRemaining: number;
  discountRate: number;
  attendingSalary: number;
  filingStatus: FilingStatus;
  state: string;
}

export interface PSLFSalaryPremiumResult {
  annualPremiumRequired: number;
  monthlyPremiumRequired: number;
  pslfNPVBenefit: number;
  effectiveMarginalRate: number;
  annuityFactor: number;
}

export interface Recommendation {
  primaryStrategy: StrategyResult;
  alternativeStrategy?: StrategyResult;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string[];
  keyMetrics: {
    debtToIncomeRatio: number;
    totalSavingsVsRefi: number;
    forgivenessBenefit: number;
    pslfSalaryPremium?: PSLFSalaryPremiumResult;
  };
}

// ============================================
// Quick-start simplified inputs
// ============================================

export interface QuickStartInputs {
  totalDebt: number;
  specialty: string;
  pslfEligible: boolean;
  currentStage: TrainingStage;
  married: boolean;
  spouseIncome?: number;
}
