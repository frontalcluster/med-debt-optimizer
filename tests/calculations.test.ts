import { describe, it, expect } from 'vitest';

import {
  getPovertyLine,
  IDR_PLANS,
} from '../src/core/constants.js';

import {
  calculateIDRPayment,
  calculate10YearStandardPayment,
  projectIncome,
  calculateNPV,
  calculateAmortizationPayment,
  estimateTaxOnForgiveness,
  getDebtToIncomeRatio,
  compareFilingStatus,
} from '../src/core/calculations.js';

import {
  runQuickAnalysis,
  compareAllStrategies,
} from '../src/core/strategies.js';

import type { UserInputs, CareerInfo } from '../src/core/types.js';

// ============================================
// Poverty Line Tests
// ============================================

describe('getPovertyLine', () => {
  it('calculates correctly for single person', () => {
    expect(getPovertyLine(1)).toBe(15060);
  });
  
  it('calculates correctly for family of 4', () => {
    expect(getPovertyLine(4)).toBe(15060 + 3 * 5380);
    expect(getPovertyLine(4)).toBe(31200);
  });
});

// ============================================
// IDR Payment Tests
// ============================================

describe('calculateIDRPayment', () => {
  const payePlan = IDR_PLANS['PAYE'];
  
  it('calculates PAYE payment for resident income', () => {
    // PGY-1 making $65k, single, family of 1
    const monthly = calculateIDRPayment(payePlan, 65000, 1, 0, 'single');
    
    // Discretionary = 65000 - (15060 * 1.5) = 65000 - 22590 = 42410
    // Annual = 42410 * 0.10 = 4241
    // Monthly = 4241 / 12 = 353
    expect(monthly).toBeCloseTo(353, -1);
  });
  
  it('calculates PAYE payment for attending income', () => {
    // Attending making $300k, single, family of 1
    const monthly = calculateIDRPayment(payePlan, 300000, 1, 0, 'single');
    
    // Discretionary = 300000 - 22590 = 277410
    // Annual = 277410 * 0.10 = 27741
    // Monthly = 27741 / 12 = 2312
    expect(monthly).toBeCloseTo(2312, -1);
  });
  
  it('reduces payment for larger family size', () => {
    const single = calculateIDRPayment(payePlan, 100000, 1, 0, 'single');
    const family4 = calculateIDRPayment(payePlan, 100000, 4, 0, 'single');
    
    expect(family4).toBeLessThan(single);
  });
  
  it('uses only borrower income for MFS', () => {
    const mfj = calculateIDRPayment(payePlan, 70000, 2, 100000, 'mfj');
    const mfs = calculateIDRPayment(payePlan, 70000, 2, 100000, 'mfs');
    
    // MFS should be lower since it excludes spouse income
    expect(mfs).toBeLessThan(mfj);
  });
  
  it('calculates SAVE payment with higher poverty multiplier', () => {
    const savePlan = IDR_PLANS['SAVE'];
    const payePayment = calculateIDRPayment(payePlan, 65000, 1, 0, 'single');
    const savePayment = calculateIDRPayment(savePlan, 65000, 1, 0, 'single');
    
    // SAVE has 2.25x poverty line vs PAYE's 1.5x, so lower payment
    expect(savePayment).toBeLessThan(payePayment);
  });
});

// ============================================
// 10-Year Standard Payment Tests
// ============================================

describe('calculate10YearStandardPayment', () => {
  it('calculates correctly for typical med school debt', () => {
    // $250k at 6.5%
    const payment = calculate10YearStandardPayment(250000, 0.065);
    
    // Should be around $2,840/month
    expect(payment).toBeGreaterThan(2800);
    expect(payment).toBeLessThan(2900);
  });
  
  it('handles zero interest rate', () => {
    const payment = calculate10YearStandardPayment(120000, 0);
    expect(payment).toBe(1000); // 120000 / 120 months
  });
});

// ============================================
// Income Projection Tests
// ============================================

describe('projectIncome', () => {
  it('projects resident through attending transition', () => {
    const career: CareerInfo = {
      specialty: 'internal_medicine',
      currentStage: 'pgy1',
      trainingYearsRemaining: 3,
    };
    
    const projection = projectIncome(career, 10);
    
    expect(projection).toHaveLength(10);
    expect(projection[0].stage).toBe('pgy1');
    expect(projection[2].stage).toBe('pgy3');
    expect(projection[3].stage).toBe('attending');
    
    // Income should jump significantly at attending
    expect(projection[3].income).toBeGreaterThan(projection[2].income * 2);
  });
  
  it('respects custom attending salary override', () => {
    const career: CareerInfo = {
      specialty: 'internal_medicine',
      currentStage: 'pgy3',
      trainingYearsRemaining: 1,
      expectedAttendingSalary: 400000,
    };
    
    const projection = projectIncome(career, 5);
    
    // Year 2 should be attending with ~400k
    expect(projection[1].income).toBeCloseTo(400000, -4);
  });
});

// ============================================
// NPV Tests
// ============================================

describe('calculateNPV', () => {
  it('discounts future payments correctly', () => {
    const payments = [10000, 10000, 10000, 10000, 10000];
    const npv = calculateNPV(payments, 0, 0, 0.05);
    
    // Sum of discounted payments should be less than 50000
    expect(npv).toBeLessThan(50000);
    expect(npv).toBeGreaterThan(40000);
  });
  
  it('includes tax on forgiveness', () => {
    const payments = [5000, 5000, 5000];
    const withTax = calculateNPV(payments, 3, 20000, 0.05);
    const withoutTax = calculateNPV(payments, 0, 0, 0.05);
    
    expect(withTax).toBeGreaterThan(withoutTax);
  });
});

// ============================================
// Filing Status Comparison Tests
// ============================================

describe('compareFilingStatus', () => {
  it('recommends MFS when spouse income is much higher', () => {
    const comparison = compareFilingStatus(
      70000,   // borrower (resident)
      200000,  // spouse (high earner)
      2,
      IDR_PLANS['PAYE'],
      300000,
      0.065
    );
    
    // MFS should have lower loan payment
    expect(comparison.mfs.loanPayment).toBeLessThan(comparison.mfj.loanPayment);
  });
  
  it('provides annual savings estimate', () => {
    const comparison = compareFilingStatus(
      70000,
      150000,
      2,
      IDR_PLANS['PAYE'],
      250000,
      0.065
    );
    
    expect(comparison.annualSavings).toBeGreaterThanOrEqual(0);
    expect(comparison.recommendation).toMatch(/mfj|mfs/);
  });
});

// ============================================
// Tax on Forgiveness Tests
// ============================================

describe('estimateTaxOnForgiveness', () => {
  it('calculates meaningful tax for large forgiveness', () => {
    const tax = estimateTaxOnForgiveness(200000, 350000, 'CA', 'single');
    
    // Should be substantial (federal marginal ~32-35% + CA ~10%)
    expect(tax).toBeGreaterThan(60000);
    expect(tax).toBeLessThan(100000);
  });
  
  it('returns 0 for no forgiveness', () => {
    const tax = estimateTaxOnForgiveness(0, 300000, 'TX', 'single');
    expect(tax).toBe(0);
  });
  
  it('accounts for state tax differences', () => {
    const taxCA = estimateTaxOnForgiveness(100000, 300000, 'CA', 'single');
    const taxTX = estimateTaxOnForgiveness(100000, 300000, 'TX', 'single');
    
    // California has state income tax, Texas doesn't
    expect(taxCA).toBeGreaterThan(taxTX);
  });
});

// ============================================
// Debt-to-Income Ratio Tests
// ============================================

describe('getDebtToIncomeRatio', () => {
  it('calculates correctly', () => {
    expect(getDebtToIncomeRatio(300000, 300000)).toBe(1);
    expect(getDebtToIncomeRatio(450000, 300000)).toBe(1.5);
    expect(getDebtToIncomeRatio(150000, 500000)).toBe(0.3);
  });
});

// ============================================
// Quick Analysis Integration Tests
// ============================================

describe('runQuickAnalysis', () => {
  it('returns results for PSLF-eligible primary care', () => {
    const { results, recommendation } = runQuickAnalysis({
      totalDebt: 250000,
      specialty: 'family_medicine',
      pslfEligible: true,
      currentStage: 'pgy1',
      married: false,
    });
    
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(recommendation.primaryStrategy).toBeDefined();
    expect(recommendation.confidence).toMatch(/high|medium|low/);
    
    // PSLF should likely be recommended for this profile
    expect(results.some(r => r.strategyName === 'PSLF')).toBe(true);
  });
  
  it('recommends refinance for low-debt high-income specialty', () => {
    const { results, recommendation } = runQuickAnalysis({
      totalDebt: 150000,
      specialty: 'orthopedic_surgery',
      pslfEligible: false,
      currentStage: 'pgy1',
      married: false,
    });
    
    // With low debt and high expected income, refinance may win
    // or IDR with high payments
    expect(results[0].npv).toBeLessThan(results[results.length - 1].npv);
    expect(recommendation.keyMetrics.debtToIncomeRatio).toBeLessThan(0.5);
  });
  
  it('handles married with spouse income', () => {
    const { results, recommendation } = runQuickAnalysis({
      totalDebt: 300000,
      specialty: 'psychiatry',
      pslfEligible: true,
      currentStage: 'pgy2',
      married: true,
      spouseIncome: 80000,
    });
    
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(recommendation.reasoning.length).toBeGreaterThan(0);
  });
});

// ============================================
// Full Strategy Comparison Tests
// ============================================

describe('compareAllStrategies', () => {
  const baseInputs: UserInputs = {
    loans: {
      totalBalance: 280000,
      weightedInterestRate: 0.065,
      loanTypes: ['direct_unsub'],
      pslfQualifyingPayments: 0,
      idrQualifyingPayments: 0,
    },
    personal: {
      agi: 65000,
      spouseAgi: 0,
      filingStatus: 'single',
      familySize: 1,
      state: 'NY',
      pslfEligibleEmployer: true,
    },
    career: {
      specialty: 'internal_medicine',
      currentStage: 'pgy1',
      trainingYearsRemaining: 3,
    },
    preferences: {
      discountRate: 0.05,
      pslfConfidence: 0.85,
      savePlanAvailable: false,
      riskTolerance: 'medium',
    },
  };
  
  it('returns sorted results by NPV', () => {
    const results = compareAllStrategies(baseInputs);
    
    for (let i = 1; i < results.length; i++) {
      expect(results[i].npv).toBeGreaterThanOrEqual(results[i - 1].npv);
    }
  });
  
  it('includes PSLF when eligible', () => {
    const results = compareAllStrategies(baseInputs);
    expect(results.some(r => r.strategyName === 'PSLF')).toBe(true);
  });
  
  it('excludes PSLF when not eligible', () => {
    const results = compareAllStrategies({
      ...baseInputs,
      personal: { ...baseInputs.personal, pslfEligibleEmployer: false },
    });
    expect(results.some(r => r.strategyName === 'PSLF')).toBe(false);
  });
  
  it('includes SAVE only when available', () => {
    const withoutSave = compareAllStrategies(baseInputs);
    const withSave = compareAllStrategies({
      ...baseInputs,
      preferences: { ...baseInputs.preferences, savePlanAvailable: true },
    });
    
    expect(withoutSave.some(r => r.strategyName === 'SAVE')).toBe(false);
    expect(withSave.some(r => r.strategyName === 'SAVE')).toBe(true);
  });
  
  it('calculates reasonable NPVs', () => {
    const results = compareAllStrategies(baseInputs);
    
    for (const result of results) {
      // NPV should be positive and less than raw debt * some factor
      expect(result.npv).toBeGreaterThan(0);
      expect(result.npv).toBeLessThan(baseInputs.loans.totalBalance * 3);
    }
  });
  
  it('provides yearly breakdowns', () => {
    const results = compareAllStrategies(baseInputs);
    
    for (const result of results) {
      expect(result.yearlyBreakdown.length).toBeGreaterThan(0);
      expect(result.yearlyBreakdown[0].startingBalance).toBe(baseInputs.loans.totalBalance);
    }
  });
});
