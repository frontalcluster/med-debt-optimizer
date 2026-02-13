import type {
  IDRPlanParams,
  FilingStatus,
  IncomeProjection,
  CareerInfo,
  YearlyLoanState,
  TaxBracket,
  FilingComparison,
  TrainingStage,
} from './types.js';

import {
  getPovertyLine,
  IDR_PLANS,
  TRAINING_SALARIES,
  FEDERAL_BRACKETS_SINGLE,
  FEDERAL_BRACKETS_MFJ,
  FEDERAL_BRACKETS_MFS,
  STATE_TAX_RATES,
  DEFAULTS,
} from './constants.js';

import { getSpecialty } from './specialties.js';

// ============================================
// Income Projection
// ============================================

export function projectIncome(
  career: CareerInfo,
  years: number,
  growthRate: number = DEFAULTS.incomeGrowthRate
): IncomeProjection[] {
  const projections: IncomeProjection[] = [];
  const specialty = getSpecialty(career.specialty);
  
  let trainingYearsRemaining = career.trainingYearsRemaining;
  const stages: TrainingStage[] = ['pgy1', 'pgy2', 'pgy3', 'pgy4', 'pgy5', 'pgy6', 'pgy7', 'fellow'];
  
  // Find starting index in training
  let stageIndex = stages.indexOf(career.currentStage);
  if (stageIndex === -1) stageIndex = 0;
  
  for (let year = 0; year < years; year++) {
    let income: number;
    let stage: TrainingStage | 'attending';
    
    if (trainingYearsRemaining > 0) {
      stage = stages[Math.min(stageIndex + (career.trainingYearsRemaining - trainingYearsRemaining), stages.length - 1)];
      const baseSalary = TRAINING_SALARIES[stage] || TRAINING_SALARIES['fellow'];
      income = baseSalary * Math.pow(1 + growthRate, year);
      trainingYearsRemaining--;
    } else {
      stage = 'attending';
      const attendingYears = year - career.trainingYearsRemaining;
      const baseSalary = career.expectedAttendingSalary || specialty.medianAttendingSalary;
      income = baseSalary * Math.pow(1 + growthRate, attendingYears);
    }
    
    projections.push({
      year,
      income: Math.round(income),
      stage,
    });
  }
  
  return projections;
}

// ============================================
// IDR Payment Calculation
// ============================================

export function calculateIDRPayment(
  plan: IDRPlanParams,
  agi: number,
  familySize: number,
  spouseAgi: number = 0,
  filingStatus: FilingStatus = 'single'
): number {
  // Determine income to use for calculation
  let incomeForCalc: number;
  
  if (filingStatus === 'mfs') {
    // Married filing separately: only borrower's income
    incomeForCalc = agi;
  } else {
    // MFJ or single: use combined/individual income
    incomeForCalc = agi + spouseAgi;
  }
  
  const povertyLine = getPovertyLine(familySize);
  const discretionaryIncome = Math.max(0, incomeForCalc - (povertyLine * plan.povertyLineMultiplier));
  const annualPayment = discretionaryIncome * plan.discretionaryIncomePercent;
  
  return Math.max(0, Math.round(annualPayment / 12));
}

/**
 * Calculate the 10-year standard repayment amount (used as cap for some plans)
 */
export function calculate10YearStandardPayment(
  balance: number,
  interestRate: number
): number {
  const monthlyRate = interestRate / 12;
  const numPayments = 120;
  
  if (monthlyRate === 0) {
    return Math.round(balance / numPayments);
  }
  
  const payment = balance * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  return Math.round(payment);
}

/**
 * Get the effective monthly payment considering plan caps
 */
export function getEffectiveIDRPayment(
  plan: IDRPlanParams,
  calculatedPayment: number,
  balance: number,
  interestRate: number
): number {
  if (plan.capsPaymentAt10YearStandard) {
    const standardPayment = calculate10YearStandardPayment(balance, interestRate);
    return Math.min(calculatedPayment, standardPayment);
  }
  return calculatedPayment;
}

// ============================================
// Loan Balance Projection
// ============================================

export function projectLoanBalance(
  initialBalance: number,
  interestRate: number,
  annualPayments: number[],  // array of annual payment amounts
  plan: IDRPlanParams
): YearlyLoanState[] {
  const states: YearlyLoanState[] = [];
  let balance = initialBalance;
  let cumulativePayments = 0;
  
  for (let year = 0; year < annualPayments.length; year++) {
    const startingBalance = balance;
    const annualPayment = annualPayments[year];
    const monthlyPayment = annualPayment / 12;
    
    let interestAccrued = 0;
    let interestSubsidized = 0;
    
    for (let month = 0; month < 12; month++) {
      const monthlyInterest = balance * (interestRate / 12);
      interestAccrued += monthlyInterest;
      
      if (plan.interestSubsidy && monthlyPayment < monthlyInterest) {
        // SAVE plan: government covers unpaid interest
        interestSubsidized += (monthlyInterest - monthlyPayment);
        // Balance stays flat (interest covered)
      } else {
        balance = balance + monthlyInterest - monthlyPayment;
      }
    }
    
    balance = Math.max(0, balance);
    cumulativePayments += annualPayment;
    
    states.push({
      year: year + 1,
      startingBalance: Math.round(startingBalance),
      interestAccrued: Math.round(interestAccrued),
      paymentsMade: Math.round(annualPayment),
      endingBalance: Math.round(balance),
      interestSubsidized: Math.round(interestSubsidized),
      cumulativePayments: Math.round(cumulativePayments),
    });
    
    if (balance <= 0) break;
  }
  
  return states;
}

// ============================================
// Tax Calculations
// ============================================

function getBrackets(filingStatus: FilingStatus): TaxBracket[] {
  switch (filingStatus) {
    case 'mfj': return FEDERAL_BRACKETS_MFJ;
    case 'mfs': return FEDERAL_BRACKETS_MFS;
    default: return FEDERAL_BRACKETS_SINGLE;
  }
}

export function calculateFederalTax(
  taxableIncome: number,
  filingStatus: FilingStatus
): number {
  const brackets = getBrackets(filingStatus);
  let tax = 0;
  let remainingIncome = taxableIncome;
  
  for (let i = brackets.length - 1; i >= 0; i--) {
    const bracket = brackets[i];
    if (remainingIncome > bracket.threshold) {
      const taxableInBracket = remainingIncome - bracket.threshold;
      tax += taxableInBracket * bracket.rate;
      remainingIncome = bracket.threshold;
    }
  }
  
  return Math.round(tax);
}

export function estimateTaxOnForgiveness(
  forgivenAmount: number,
  agiInForgivenessYear: number,
  state: string,
  filingStatus: FilingStatus = 'single'
): number {
  if (forgivenAmount <= 0) return 0;
  
  // Calculate marginal federal tax on forgiveness
  const taxWithoutForgiveness = calculateFederalTax(agiInForgivenessYear, filingStatus);
  const taxWithForgiveness = calculateFederalTax(agiInForgivenessYear + forgivenAmount, filingStatus);
  const federalTax = taxWithForgiveness - taxWithoutForgiveness;
  
  // State tax (simplified - uses top marginal rate)
  const stateRate = STATE_TAX_RATES[state] || 0.05;
  const stateTax = forgivenAmount * stateRate;
  
  return Math.round(federalTax + stateTax);
}

// ============================================
// Filing Status Comparison
// ============================================

export function compareFilingStatus(
  borrowerAgi: number,
  spouseAgi: number,
  familySize: number,
  plan: IDRPlanParams,
  loanBalance: number,
  interestRate: number
): FilingComparison {
  // MFJ scenario
  const mfjPayment = calculateIDRPayment(plan, borrowerAgi, familySize, spouseAgi, 'mfj');
  const mfjEffective = getEffectiveIDRPayment(plan, mfjPayment, loanBalance, interestRate);
  const mfjTax = calculateFederalTax(borrowerAgi + spouseAgi, 'mfj');
  
  // MFS scenario
  const mfsPayment = calculateIDRPayment(plan, borrowerAgi, familySize, 0, 'mfs');
  const mfsEffective = getEffectiveIDRPayment(plan, mfsPayment, loanBalance, interestRate);
  const mfsBorrowerTax = calculateFederalTax(borrowerAgi, 'mfs');
  const mfsSpouseTax = calculateFederalTax(spouseAgi, 'mfs');
  const mfsTotalTax = mfsBorrowerTax + mfsSpouseTax;
  
  const mfjNetCost = mfjEffective * 12 + mfjTax;
  const mfsNetCost = mfsEffective * 12 + mfsTotalTax;
  
  return {
    mfj: {
      totalTax: mfjTax,
      loanPayment: mfjEffective * 12,
      netAnnualCost: mfjNetCost,
    },
    mfs: {
      totalTax: mfsTotalTax,
      loanPayment: mfsEffective * 12,
      netAnnualCost: mfsNetCost,
    },
    recommendation: mfjNetCost <= mfsNetCost ? 'mfj' : 'mfs',
    annualSavings: Math.abs(mfjNetCost - mfsNetCost),
  };
}

// ============================================
// NPV Calculation
// ============================================

export function calculateNPV(
  annualPayments: number[],
  forgivenessYear: number,
  taxOnForgiveness: number,
  discountRate: number
): number {
  let npv = 0;
  
  // Discount each year's payment
  for (let year = 0; year < annualPayments.length; year++) {
    npv += annualPayments[year] / Math.pow(1 + discountRate, year + 1);
  }
  
  // Add discounted tax on forgiveness (if any)
  if (taxOnForgiveness > 0 && forgivenessYear > 0) {
    npv += taxOnForgiveness / Math.pow(1 + discountRate, forgivenessYear);
  }
  
  return Math.round(npv);
}

// ============================================
// Amortization for Refinance
// ============================================

export function calculateAmortizationPayment(
  principal: number,
  annualRate: number,
  years: number
): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  
  if (monthlyRate === 0) {
    return Math.round(principal / numPayments);
  }
  
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  return Math.round(payment);
}

// ============================================
// Utility Functions
// ============================================

export function getDebtToIncomeRatio(
  totalDebt: number,
  expectedAttendingSalary: number
): number {
  return Math.round((totalDebt / expectedAttendingSalary) * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
