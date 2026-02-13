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

// ============================================
// Aggressive Payoff Calculation
// ============================================

export interface AggressivePayoffParams {
  loanBalance: number;
  interestRate: number;
  trainingYearsRemaining: number;
  attendingSalary: number;
  livingExpenses: number;        // annual living expenses during aggressive period
  aggressiveYears: number;       // how many years to "live like a resident"
  discountRate: number;
}

export interface AggressivePayoffResult {
  totalPayments: number;
  totalInterest: number;
  yearsToPayoff: number;
  monthsToPayoff: number;
  npv: number;
  yearlyBreakdown: {
    year: number;
    payment: number;
    principal: number;
    interest: number;
    endingBalance: number;
    phase: 'training' | 'aggressive' | 'standard';
  }[];
  monthlyPaymentDuringTraining: number;
  monthlyPaymentAggressive: number;
  monthlyPaymentStandard: number;
}

export function calculateAggressivePayoff(params: AggressivePayoffParams): AggressivePayoffResult {
  const {
    loanBalance,
    interestRate,
    trainingYearsRemaining,
    attendingSalary,
    livingExpenses,
    aggressiveYears,
    discountRate,
  } = params;
  
  // Estimate taxes (simplified - ~30% effective rate for attending)
  const effectiveTaxRate = 0.30;
  const afterTaxIncome = attendingSalary * (1 - effectiveTaxRate);
  
  // During aggressive period: all income above living expenses goes to loans
  const annualAggressivePayment = Math.max(0, afterTaxIncome - livingExpenses);
  const monthlyAggressivePayment = annualAggressivePayment / 12;
  
  // During training: interest-only or minimum (we'll use interest-only as floor)
  const monthlyInterestOnly = (loanBalance * interestRate) / 12;
  const monthlyTrainingPayment = monthlyInterestOnly;
  
  const yearlyBreakdown: AggressivePayoffResult['yearlyBreakdown'] = [];
  let balance = loanBalance;
  let totalPayments = 0;
  let totalInterest = 0;
  let year = 0;
  let months = 0;
  
  // Phase 1: Training years (interest-only payments)
  for (let y = 0; y < trainingYearsRemaining && balance > 0; y++) {
    year++;
    let yearPayment = 0;
    let yearInterest = 0;
    let yearPrincipal = 0;
    const startBalance = balance;
    
    for (let m = 0; m < 12 && balance > 0; m++) {
      const monthInterest = balance * (interestRate / 12);
      const payment = Math.min(monthlyTrainingPayment, balance + monthInterest);
      const principal = Math.max(0, payment - monthInterest);
      
      balance = balance + monthInterest - payment;
      yearPayment += payment;
      yearInterest += monthInterest;
      yearPrincipal += principal;
      totalPayments += payment;
      totalInterest += monthInterest;
      months++;
    }
    
    yearlyBreakdown.push({
      year,
      payment: Math.round(yearPayment),
      principal: Math.round(yearPrincipal),
      interest: Math.round(yearInterest),
      endingBalance: Math.round(Math.max(0, balance)),
      phase: 'training',
    });
  }
  
  // Phase 2: Aggressive payoff years
  for (let y = 0; y < aggressiveYears && balance > 0; y++) {
    year++;
    let yearPayment = 0;
    let yearInterest = 0;
    let yearPrincipal = 0;
    const startBalance = balance;
    
    for (let m = 0; m < 12 && balance > 0; m++) {
      const monthInterest = balance * (interestRate / 12);
      const payment = Math.min(monthlyAggressivePayment, balance + monthInterest);
      const principal = payment - monthInterest;
      
      balance = Math.max(0, balance + monthInterest - payment);
      yearPayment += payment;
      yearInterest += monthInterest;
      yearPrincipal += principal;
      totalPayments += payment;
      totalInterest += monthInterest;
      months++;
      
      if (balance <= 0) break;
    }
    
    yearlyBreakdown.push({
      year,
      payment: Math.round(yearPayment),
      principal: Math.round(yearPrincipal),
      interest: Math.round(yearInterest),
      endingBalance: Math.round(Math.max(0, balance)),
      phase: 'aggressive',
    });
  }
  
  // Phase 3: Standard payments on remaining balance (if any)
  if (balance > 0) {
    const remainingTermYears = 10; // standard 10-year term on remainder
    const monthlyStandard = calculateAmortizationPayment(balance, interestRate, remainingTermYears);
    
    for (let y = 0; y < remainingTermYears && balance > 0; y++) {
      year++;
      let yearPayment = 0;
      let yearInterest = 0;
      let yearPrincipal = 0;
      
      for (let m = 0; m < 12 && balance > 0; m++) {
        const monthInterest = balance * (interestRate / 12);
        const payment = Math.min(monthlyStandard, balance + monthInterest);
        const principal = payment - monthInterest;
        
        balance = Math.max(0, balance + monthInterest - payment);
        yearPayment += payment;
        yearInterest += monthInterest;
        yearPrincipal += principal;
        totalPayments += payment;
        totalInterest += monthInterest;
        months++;
        
        if (balance <= 0) break;
      }
      
      yearlyBreakdown.push({
        year,
        payment: Math.round(yearPayment),
        principal: Math.round(yearPrincipal),
        interest: Math.round(yearInterest),
        endingBalance: Math.round(Math.max(0, balance)),
        phase: 'standard',
      });
      
      if (balance <= 0) break;
    }
  }
  
  // Calculate NPV
  const annualPayments = yearlyBreakdown.map(y => y.payment);
  const npv = calculateNPV(annualPayments, 0, 0, discountRate);
  
  // Calculate standard payment for remaining balance after aggressive (for display)
  const balanceAfterAggressive = yearlyBreakdown.find(y => y.phase === 'aggressive' && y.endingBalance > 0)?.endingBalance || 0;
  const monthlyStandardPayment = balanceAfterAggressive > 0 
    ? calculateAmortizationPayment(balanceAfterAggressive, interestRate, 10)
    : 0;
  
  return {
    totalPayments: Math.round(totalPayments),
    totalInterest: Math.round(totalInterest),
    yearsToPayoff: year,
    monthsToPayoff: months,
    npv,
    yearlyBreakdown,
    monthlyPaymentDuringTraining: Math.round(monthlyTrainingPayment),
    monthlyPaymentAggressive: Math.round(monthlyAggressivePayment),
    monthlyPaymentStandard: Math.round(monthlyStandardPayment),
  };
}
