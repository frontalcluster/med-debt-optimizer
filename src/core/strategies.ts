import type {
  UserInputs,
  StrategyResult,
  Recommendation,
  IncomeProjection,
  QuickStartInputs,
} from './types.js';

import {
  projectIncome,
  calculateIDRPayment,
  getEffectiveIDRPayment,
  projectLoanBalance,
  estimateTaxOnForgiveness,
  calculateNPV,
  calculateAmortizationPayment,
  getDebtToIncomeRatio,
} from './calculations.js';

import { IDR_PLANS, DEFAULTS, PSLF, TRAINING_SALARIES } from './constants.js';
import { getSpecialty } from './specialties.js';

// ============================================
// Strategy Calculators
// ============================================

function calculatePSLFStrategy(
  inputs: UserInputs,
  incomeProjection: IncomeProjection[],
  underlyingPlan: string = 'PAYE'
): StrategyResult {
  const plan = IDR_PLANS[underlyingPlan];
  const paymentsRemaining = PSLF.requiredPayments - inputs.loans.pslfQualifyingPayments;
  const yearsRemaining = Math.ceil(paymentsRemaining / 12);
  
  const annualPayments: number[] = [];
  const monthlyPayments: number[] = [];
  
  for (let year = 0; year < yearsRemaining; year++) {
    const income = incomeProjection[year]?.income || incomeProjection[incomeProjection.length - 1].income;
    
    const monthlyPayment = calculateIDRPayment(
      plan,
      income,
      inputs.personal.familySize,
      inputs.personal.spouseAgi,
      inputs.personal.filingStatus
    );
    
    const effectivePayment = getEffectiveIDRPayment(
      plan,
      monthlyPayment,
      inputs.loans.totalBalance,
      inputs.loans.weightedInterestRate
    );
    
    annualPayments.push(effectivePayment * 12);
    for (let m = 0; m < 12; m++) {
      monthlyPayments.push(effectivePayment);
    }
  }
  
  const totalPayments = annualPayments.reduce((a, b) => a + b, 0);
  const yearlyBreakdown = projectLoanBalance(
    inputs.loans.totalBalance,
    inputs.loans.weightedInterestRate,
    annualPayments,
    plan
  );
  
  const finalBalance = yearlyBreakdown[yearlyBreakdown.length - 1]?.endingBalance || 0;
  
  // Weight by PSLF confidence
  const adjustedNPV = calculateNPV(
    annualPayments,
    yearsRemaining,
    0, // PSLF forgiveness is tax-free
    inputs.preferences.discountRate
  );
  
  return {
    strategyName: 'PSLF',
    description: `Public Service Loan Forgiveness using ${plan.name} payments`,
    totalPayments,
    forgivenessAmount: finalBalance,
    taxOnForgiveness: 0,
    npv: adjustedNPV,
    totalYears: yearsRemaining,
    monthlyPaymentRange: {
      min: Math.min(...monthlyPayments),
      max: Math.max(...monthlyPayments),
    },
    yearlyBreakdown,
    risks: [
      'Requires continuous employment at PSLF-eligible employer',
      'Must recertify employment annually',
      'Program could be modified by future legislation',
      inputs.preferences.pslfConfidence < 0.8 
        ? `Your confidence level (${Math.round(inputs.preferences.pslfConfidence * 100)}%) suggests hedging` 
        : '',
    ].filter(Boolean),
    benefits: [
      'Forgiveness is completely tax-free',
      'Lowest total cost for most high-debt physicians',
      'Payments based on income, not debt',
      'All residency/fellowship years count toward 120 payments',
    ],
  };
}

function calculateIDRStrategy(
  inputs: UserInputs,
  incomeProjection: IncomeProjection[],
  planName: string
): StrategyResult {
  const plan = IDR_PLANS[planName];
  const years = plan.forgivenessYears - Math.floor(inputs.loans.idrQualifyingPayments / 12);
  
  const annualPayments: number[] = [];
  const monthlyPayments: number[] = [];
  
  for (let year = 0; year < years; year++) {
    const income = incomeProjection[year]?.income || incomeProjection[incomeProjection.length - 1].income;
    
    const monthlyPayment = calculateIDRPayment(
      plan,
      income,
      inputs.personal.familySize,
      inputs.personal.spouseAgi,
      inputs.personal.filingStatus
    );
    
    const effectivePayment = getEffectiveIDRPayment(
      plan,
      monthlyPayment,
      inputs.loans.totalBalance,
      inputs.loans.weightedInterestRate
    );
    
    annualPayments.push(effectivePayment * 12);
    for (let m = 0; m < 12; m++) {
      monthlyPayments.push(effectivePayment);
    }
  }
  
  const totalPayments = annualPayments.reduce((a, b) => a + b, 0);
  const yearlyBreakdown = projectLoanBalance(
    inputs.loans.totalBalance,
    inputs.loans.weightedInterestRate,
    annualPayments,
    plan
  );
  
  const finalBalance = yearlyBreakdown[yearlyBreakdown.length - 1]?.endingBalance || 0;
  
  // Estimate income at forgiveness year for tax calculation
  const forgivenessYearIncome = incomeProjection[years - 1]?.income || 
    incomeProjection[incomeProjection.length - 1].income;
  
  const taxOnForgiveness = estimateTaxOnForgiveness(
    finalBalance,
    forgivenessYearIncome,
    inputs.personal.state,
    inputs.personal.filingStatus
  );
  
  const npv = calculateNPV(
    annualPayments,
    years,
    taxOnForgiveness,
    inputs.preferences.discountRate
  );
  
  const risks = [
    'Forgiveness is taxed as ordinary income (could be $50k-$150k+ tax bill)',
    'Long repayment period (20-25 years)',
    'Balance may grow significantly during training years',
  ];
  
  if (planName === 'SAVE') {
    risks.push('SAVE plan currently enjoined by litigation - may not be available');
  }
  
  return {
    strategyName: planName,
    description: plan.name,
    totalPayments,
    forgivenessAmount: finalBalance,
    taxOnForgiveness,
    npv,
    totalYears: years,
    monthlyPaymentRange: {
      min: Math.min(...monthlyPayments),
      max: Math.max(...monthlyPayments),
    },
    yearlyBreakdown,
    risks,
    benefits: [
      'Payments based on income, not debt amount',
      'No employer restrictions',
      planName === 'SAVE' ? 'Government covers unpaid interest (if available)' : '',
      'Can switch to PSLF if employment situation changes',
    ].filter(Boolean),
  };
}

function calculateRefiStrategy(
  inputs: UserInputs,
  incomeProjection: IncomeProjection[],
  refiRate: number = DEFAULTS.refiRate,
  termYears: number = DEFAULTS.refiTermYears
): StrategyResult {
  const monthlyPayment = calculateAmortizationPayment(
    inputs.loans.totalBalance,
    refiRate,
    termYears
  );
  
  const annualPayment = monthlyPayment * 12;
  const annualPayments = Array(termYears).fill(annualPayment);
  const totalPayments = annualPayment * termYears;
  
  // Simple amortization breakdown
  const yearlyBreakdown = [];
  let balance = inputs.loans.totalBalance;
  let cumulative = 0;
  
  for (let year = 1; year <= termYears; year++) {
    const startBalance = balance;
    const interestAccrued = balance * refiRate;
    const principalPaid = annualPayment - interestAccrued;
    balance = Math.max(0, balance - principalPaid);
    cumulative += annualPayment;
    
    yearlyBreakdown.push({
      year,
      startingBalance: Math.round(startBalance),
      interestAccrued: Math.round(interestAccrued),
      paymentsMade: Math.round(annualPayment),
      endingBalance: Math.round(balance),
      interestSubsidized: 0,
      cumulativePayments: Math.round(cumulative),
    });
  }
  
  const npv = calculateNPV(annualPayments, 0, 0, inputs.preferences.discountRate);
  
  return {
    strategyName: `Refinance (${termYears}yr @ ${(refiRate * 100).toFixed(1)}%)`,
    description: `Private refinance to ${(refiRate * 100).toFixed(1)}% fixed rate, ${termYears}-year term`,
    totalPayments,
    forgivenessAmount: 0,
    taxOnForgiveness: 0,
    npv,
    totalYears: termYears,
    monthlyPaymentRange: {
      min: monthlyPayment,
      max: monthlyPayment,
    },
    yearlyBreakdown,
    risks: [
      'Permanently lose all federal protections',
      'Cannot return to IDR or PSLF after refinancing',
      'No forbearance/deferment options',
      'High monthly payments during training years',
    ],
    benefits: [
      'Lowest total interest paid if income is high',
      'Predictable fixed payments',
      'Debt-free in 10 years',
      'Best for low debt-to-income ratios',
    ],
  };
}

// ============================================
// Main Comparison Function
// ============================================

export function compareAllStrategies(inputs: UserInputs): StrategyResult[] {
  const results: StrategyResult[] = [];
  const incomeProjection = projectIncome(inputs.career, 30);
  
  // 1. PSLF (if eligible)
  if (inputs.personal.pslfEligibleEmployer) {
    results.push(calculatePSLFStrategy(inputs, incomeProjection, 'PAYE'));
  }
  
  // 2. IDR plans
  const plansToCompare = ['PAYE', 'IBR_NEW'];
  
  if (inputs.preferences.savePlanAvailable) {
    plansToCompare.unshift('SAVE');
  }
  
  for (const planName of plansToCompare) {
    results.push(calculateIDRStrategy(inputs, incomeProjection, planName));
  }
  
  // 3. Refinance options
  results.push(calculateRefiStrategy(inputs, incomeProjection, 0.055, 10));
  results.push(calculateRefiStrategy(inputs, incomeProjection, 0.06, 7));
  
  // Sort by NPV (lowest = best)
  return results.sort((a, b) => a.npv - b.npv);
}

// ============================================
// Recommendation Generator
// ============================================

export function generateRecommendation(
  inputs: UserInputs,
  results: StrategyResult[]
): Recommendation {
  const specialty = getSpecialty(inputs.career.specialty);
  const dti = getDebtToIncomeRatio(
    inputs.loans.totalBalance,
    inputs.career.expectedAttendingSalary || specialty.medianAttendingSalary
  );
  
  const best = results[0];
  const secondBest = results[1];
  const npvDifference = secondBest ? secondBest.npv - best.npv : 0;
  
  const refiResult = results.find(r => r.strategyName.includes('Refinance'));
  const savingsVsRefi = refiResult ? refiResult.npv - best.npv : 0;
  
  const reasoning: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'high';
  
  // DTI-based guidance
  if (dti < 0.5) {
    reasoning.push(`Low debt-to-income ratio (${dti}) favors aggressive payoff`);
  } else if (dti > 1.5) {
    reasoning.push(`High debt-to-income ratio (${dti}) strongly favors forgiveness strategies`);
  } else {
    reasoning.push(`Moderate debt-to-income ratio (${dti}) - outcome depends on employment and preferences`);
  }
  
  // PSLF-specific reasoning
  if (best.strategyName === 'PSLF') {
    if (inputs.preferences.pslfConfidence < 0.7) {
      confidence = 'medium';
      reasoning.push('PSLF is optimal but your confidence in the program affects certainty');
    }
    
    const highIncomeSpecialties = ['orthopedic_surgery', 'cardiology', 'gastroenterology', 'neurosurgery', 'dermatology'];
    if (highIncomeSpecialties.includes(inputs.career.specialty)) {
      reasoning.push('High-income specialty - verify PSLF-eligible employment is achievable and sustainable');
    }
    
    reasoning.push(`PSLF saves ~${formatMoney(savingsVsRefi)} vs refinancing (NPV)`);
  }
  
  // Close call detection
  if (npvDifference < 10000 && secondBest) {
    confidence = 'low';
    reasoning.push(
      `Close call: ${best.strategyName} beats ${secondBest.strategyName} by only ${formatMoney(npvDifference)}`
    );
  }
  
  // Tax bomb warning
  if (best.taxOnForgiveness > 50000) {
    reasoning.push(
      `Warning: ${formatMoney(best.taxOnForgiveness)} tax liability at forgiveness - start saving now`
    );
  }
  
  return {
    primaryStrategy: best,
    alternativeStrategy: npvDifference < 25000 ? secondBest : undefined,
    confidence,
    reasoning,
    keyMetrics: {
      debtToIncomeRatio: dti,
      totalSavingsVsRefi: savingsVsRefi,
      forgivenessBenefit: best.forgivenessAmount - best.taxOnForgiveness,
    },
  };
}

// ============================================
// Quick Start (Simplified Inputs)
// ============================================

export function runQuickAnalysis(quick: QuickStartInputs): {
  results: StrategyResult[];
  recommendation: Recommendation;
} {
  const specialty = getSpecialty(quick.specialty);
  
  // Build full inputs from quick start
  const inputs: UserInputs = {
    loans: {
      totalBalance: quick.totalDebt,
      weightedInterestRate: 0.065, // reasonable default
      loanTypes: ['direct_unsub'],
      pslfQualifyingPayments: 0,
      idrQualifyingPayments: 0,
    },
    personal: {
      agi: TRAINING_SALARIES[quick.currentStage] || 65000,
      spouseAgi: quick.spouseIncome || 0,
      filingStatus: quick.married ? 'mfj' : 'single',
      familySize: quick.married ? 2 : 1,
      state: 'CA', // default to high-tax state for conservative estimate
      pslfEligibleEmployer: quick.pslfEligible,
    },
    career: {
      specialty: quick.specialty,
      currentStage: quick.currentStage,
      trainingYearsRemaining: calculateTrainingRemaining(quick.currentStage, specialty.typicalTrainingYears),
      expectedAttendingSalary: undefined,
    },
    preferences: {
      discountRate: DEFAULTS.discountRate,
      pslfConfidence: DEFAULTS.pslfConfidence,
      savePlanAvailable: DEFAULTS.savePlanAvailable,
      riskTolerance: 'medium',
    },
  };
  
  const results = compareAllStrategies(inputs);
  const recommendation = generateRecommendation(inputs, results);
  
  return { results, recommendation };
}

// ============================================
// Helpers
// ============================================

function calculateTrainingRemaining(currentStage: string, typicalYears: number): number {
  const stageYears: Record<string, number> = {
    ms4: typicalYears,
    pgy1: typicalYears,
    pgy2: Math.max(0, typicalYears - 1),
    pgy3: Math.max(0, typicalYears - 2),
    pgy4: Math.max(0, typicalYears - 3),
    pgy5: Math.max(0, typicalYears - 4),
    pgy6: Math.max(0, typicalYears - 5),
    pgy7: Math.max(0, typicalYears - 6),
    fellow: 1,
    attending: 0,
  };
  return stageYears[currentStage] ?? typicalYears;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================
// Exports
// ============================================

export {
  calculatePSLFStrategy,
  calculateIDRStrategy,
  calculateRefiStrategy,
};
