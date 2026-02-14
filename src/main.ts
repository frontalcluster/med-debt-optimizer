import {
  compareAllStrategies,
  generateRecommendation,
  getAllSpecialtyKeys,
  getSpecialty,
  STATE_TAX_RATES,
  calculateAggressivePayoff,
} from './index.js';

import type { 
  UserInputs, 
  StrategyResult, 
  Recommendation, 
  TrainingStage, 
  FilingStatus,
} from './core/types.js';

import type { AggressivePayoffParams, AggressivePayoffResult } from './core/calculations.js';
import { sanitizeNumericValue } from './core/utils.js';

// ============================================
// DOM Elements
// ============================================

const form = document.getElementById('calculator') as HTMLFormElement;
const resultsDiv = document.getElementById('results') as HTMLDivElement;
const specialtySelect = document.getElementById('specialty') as HTMLSelectElement;
const stateSelect = document.getElementById('state') as HTMLSelectElement;

// Career path comparison state (persisted across real-time salary updates)
let lastResults: StrategyResult[] | null = null;
let lastRecommendation: Recommendation | null = null;
let lastAggressiveResult: AggressivePayoffResult | null = null;
let lastInputs: UserInputs | null = null;

// ============================================
// Initialize Dropdowns
// ============================================

function initSpecialtyDropdown() {
  const specialties = getAllSpecialtyKeys();
  
  for (const key of specialties) {
    const data = getSpecialty(key);
    const option = document.createElement('option');
    option.value = key;
    option.textContent = data.name;
    specialtySelect.appendChild(option);
  }
  
  // Default to internal medicine
  specialtySelect.value = 'internal_medicine';
}

function initStateDropdown() {
  const states = Object.keys(STATE_TAX_RATES).sort();
  
  for (const state of states) {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = state;
    stateSelect.appendChild(option);
  }
  
  stateSelect.value = 'CA';
}

// ============================================
// Form Handling
// ============================================

function getFormInputs(): UserInputs {
  const getValue = (id: string): number => {
    const el = document.getElementById(id) as HTMLInputElement;
    return sanitizeNumericValue(el.value);
  };
  
  const getChecked = (id: string): boolean => {
    const el = document.getElementById(id) as HTMLInputElement;
    return el.checked;
  };
  
  const getString = (id: string): string => {
    const el = document.getElementById(id) as HTMLSelectElement | HTMLInputElement;
    return el.value;
  };
  
  const specialty = getString('specialty');
  const specialtyData = getSpecialty(specialty);
  
  // Calculate training years remaining based on current stage
  const currentStage = getString('currentStage') as TrainingStage;
  const trainingYearsRemaining = calculateTrainingRemaining(currentStage, specialtyData.typicalTrainingYears);
  
  return {
    loans: {
      totalBalance: getValue('totalDebt'),
      weightedInterestRate: getValue('interestRate') / 100,
      loanTypes: ['direct_unsub'],
      pslfQualifyingPayments: getValue('pslfPayments'),
      idrQualifyingPayments: 0,
    },
    personal: {
      agi: getValue('agi'),
      spouseAgi: getValue('spouseAgi'),
      filingStatus: getString('filingStatus') as FilingStatus,
      familySize: getValue('familySize'),
      state: getString('state'),
      pslfEligibleEmployer: getChecked('pslfEligible'),
    },
    career: {
      specialty,
      currentStage,
      trainingYearsRemaining,
    },
    preferences: {
      discountRate: getValue('discountRate') / 100,
      pslfConfidence: getValue('pslfConfidence') / 100,
      savePlanAvailable: getChecked('saveAvailable'),
      riskTolerance: 'medium',
    },
  };
}

function getAggressiveParams(inputs: UserInputs): AggressivePayoffParams | null {
  const aggressiveEnabled = (document.getElementById('aggressivePayoff') as HTMLInputElement).checked;
  if (!aggressiveEnabled) return null;
  
  const getValue = (id: string): number => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
    return sanitizeNumericValue(el.value);
  };
  
  const specialty = getSpecialty(inputs.career.specialty);
  
  return {
    loanBalance: inputs.loans.totalBalance,
    interestRate: getValue('aggressiveRefiRate') / 100,
    trainingYearsRemaining: inputs.career.trainingYearsRemaining,
    attendingSalary: inputs.career.expectedAttendingSalary || specialty.medianAttendingSalary,
    livingExpenses: getValue('livingExpenses'),
    aggressiveYears: getValue('aggressiveYears'),
    discountRate: inputs.preferences.discountRate,
  };
}

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

// ============================================
// URL Parameter Handling
// ============================================

function encodeFormToURL(): string {
  const params = new URLSearchParams();
  
  // All form fields to encode
  const fields = [
    'totalDebt', 'interestRate', 'pslfPayments', 'specialty', 'currentStage',
    'pslfEligible', 'agi', 'familySize', 'filingStatus', 'spouseAgi', 'state',
    'discountRate', 'pslfConfidence', 'saveAvailable',
    'aggressivePayoff', 'livingExpenses', 'aggressiveYears', 'aggressiveRefiRate'
  ];
  
  for (const field of fields) {
    const el = document.getElementById(field) as HTMLInputElement | HTMLSelectElement;
    if (!el) continue;
    
    if (el.type === 'checkbox') {
      params.set(field, (el as HTMLInputElement).checked ? '1' : '0');
    } else {
      params.set(field, el.value);
    }
  }
  
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function loadFormFromURL(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.size === 0) return false;
  
  for (const [key, value] of params) {
    const el = document.getElementById(key) as HTMLInputElement | HTMLSelectElement;
    if (!el) continue;
    
    if (el.type === 'checkbox') {
      (el as HTMLInputElement).checked = value === '1';
    } else {
      el.value = value;
    }
  }
  
  // Trigger any change handlers
  document.getElementById('filingStatus')?.dispatchEvent(new Event('change'));
  document.getElementById('aggressivePayoff')?.dispatchEvent(new Event('change'));
  
  return true;
}

// ============================================
// Results Display
// ============================================

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function generateExplanation(recommendation: Recommendation, inputs: UserInputs): string {
  const dti = recommendation.keyMetrics.debtToIncomeRatio;
  const strategy = recommendation.primaryStrategy.strategyName;
  
  let explanation = '';
  
  if (strategy === 'PSLF') {
    explanation = `PSLF is recommended because your debt-to-income ratio of ${dti.toFixed(2)} means the tax-free forgiveness value significantly exceeds what you'd pay through other strategies. `;
    if (dti > 1.5) {
      explanation += `With debt exceeding 1.5x your expected income, forgiveness strategies almost always win. `;
    }
    explanation += `The key is maintaining employment at a qualifying employer for the full 10 years.`;
  } else if (strategy.includes('Refinance')) {
    explanation = `Refinancing is recommended because your debt-to-income ratio of ${dti.toFixed(2)} is low enough that aggressive payoff saves more than forgiveness would provide. `;
    explanation += `You'll pay more per month, but you'll be debt-free faster and pay less total interest.`;
  } else {
    explanation = `${strategy} is recommended as the best available IDR option given your inputs. `;
    if (!inputs.personal.pslfEligibleEmployer) {
      explanation += `If you move to a PSLF-eligible employer, PSLF would likely be more favorable.`;
    }
  }
  
  return explanation;
}

// ============================================
// Career Path Comparison
// ============================================

function displayCareerPathSection(
  results: StrategyResult[],
  recommendation: Recommendation,
  aggressiveResult: AggressivePayoffResult | null,
  inputs: UserInputs
) {
  const careerPathCard = document.getElementById('careerPathComparison')!;
  const pslfPremiumCard = document.getElementById('pslfPremiumCard')!;
  const aggressiveResultsDiv = document.getElementById('aggressiveResults')!;

  const premium = recommendation.keyMetrics.pslfSalaryPremium;
  const hasPSLF = premium && premium.annualPremiumRequired > 0;
  const hasAggressive = aggressiveResult !== null;

  // Hide all three first
  careerPathCard.style.display = 'none';
  pslfPremiumCard.style.display = 'none';
  aggressiveResultsDiv.style.display = 'none';

  if (hasPSLF && hasAggressive) {
    // Unified career path comparison
    careerPathCard.style.display = 'block';
    displayCareerPathComparison(results, recommendation, aggressiveResult!, inputs, premium!);
  } else if (hasPSLF) {
    // Fallback: standalone PSLF premium card
    displayPSLFPremiumFallback(results, recommendation, inputs, premium!);
  } else if (hasAggressive) {
    // Fallback: standalone aggressive payoff card
    displayAggressiveFallback(recommendation, aggressiveResult!);
  }
}

function displayCareerPathComparison(
  results: StrategyResult[],
  recommendation: Recommendation,
  aggressiveResult: AggressivePayoffResult,
  inputs: UserInputs,
  premium: NonNullable<Recommendation['keyMetrics']['pslfSalaryPremium']>
) {
  const specialtyData = getSpecialty(inputs.career.specialty);
  const attendingSalary = inputs.career.expectedAttendingSalary || specialtyData.medianAttendingSalary;

  // Find PSLF strategy result
  const pslfResult = results.find(r => r.strategyName === 'PSLF');
  if (!pslfResult) return;

  // Path A: PSLF
  document.getElementById('pslfPathPlan')!.textContent = pslfResult.strategyName;
  document.getElementById('pslfPathNPV')!.textContent = formatMoney(pslfResult.npv);
  document.getElementById('pslfPathTimeline')!.textContent = `${pslfResult.totalYears} years`;
  document.getElementById('pslfPathMonthly')!.textContent =
    `${formatMoney(pslfResult.monthlyPaymentRange.min)} - ${formatMoney(pslfResult.monthlyPaymentRange.max)}`;
  document.getElementById('pslfPathForgiveness')!.textContent = formatMoney(pslfResult.forgivenessAmount);

  // Path B: Private Practice (Aggressive Payoff)
  document.getElementById('privatePathPlan')!.textContent = 'Aggressive Payoff';
  document.getElementById('privatePathNPV')!.textContent = formatMoney(aggressiveResult.npv);
  document.getElementById('privatePathTimeline')!.textContent =
    `${aggressiveResult.yearsToPayoff} years after training`;
  document.getElementById('privatePathMonthly')!.textContent =
    formatMoney(aggressiveResult.monthlyPaymentAggressive);
  document.getElementById('privatePathForgiveness')!.textContent = '$0';

  // Highlight NPV winner on the path cards
  const pathPSLF = document.getElementById('pathPSLF')!;
  const pathPrivate = document.getElementById('pathPrivate')!;
  pathPSLF.classList.remove('winner');
  pathPrivate.classList.remove('winner');

  if (pslfResult.npv <= aggressiveResult.npv) {
    pathPSLF.classList.add('winner');
  } else {
    pathPrivate.classList.add('winner');
  }

  // Salary comparison section
  document.getElementById('pslfSalaryDisplay')!.textContent = formatMoney(attendingSalary);

  const breakevenSalary = attendingSalary + premium.annualPremiumRequired;
  document.getElementById('breakevenLabel')!.textContent =
    `Breakeven: ${formatMoney(breakevenSalary)}/yr`;

  // Set default private salary to breakeven
  const salaryInput = document.getElementById('privateSalaryInput') as HTMLInputElement;
  if (!salaryInput.value || salaryInput.dataset.autoSet === 'true') {
    salaryInput.value = breakevenSalary.toLocaleString('en-US');
    salaryInput.dataset.autoSet = 'true';
  }

  // Update breakeven bar and verdict
  updateBreakevenBar(attendingSalary, premium.annualPremiumRequired);

  // Explanation
  const pslfYears = pslfResult.totalYears;
  document.getElementById('careerPathExplanation')!.textContent =
    `This comparison accounts for taxes on extra income (${(premium.effectiveMarginalRate * 100).toFixed(1)}% marginal rate) ` +
    `and the time value of money over the ${pslfYears}-year PSLF period. ` +
    `The breakeven salary is what a private practice job must pay to offset the PSLF forgiveness benefit.`;
}

function updateBreakevenBar(pslfSalary?: number, annualPremium?: number) {
  // Use stored values if not provided (for event listener calls)
  if (pslfSalary === undefined || annualPremium === undefined) {
    if (!lastRecommendation || !lastInputs) return;
    const premium = lastRecommendation.keyMetrics.pslfSalaryPremium;
    if (!premium || premium.annualPremiumRequired <= 0) return;

    const specialtyData = getSpecialty(lastInputs.career.specialty);
    pslfSalary = lastInputs.career.expectedAttendingSalary || specialtyData.medianAttendingSalary;
    annualPremium = premium.annualPremiumRequired;
  }

  const salaryInput = document.getElementById('privateSalaryInput') as HTMLInputElement;
  const enteredSalary = sanitizeNumericValue(salaryInput.value);
  const salaryDiff = enteredSalary - pslfSalary;
  const breakevenSalary = pslfSalary + annualPremium;

  // Clear auto-set flag once user edits
  if (salaryInput.dataset.autoSet === 'true') {
    salaryInput.dataset.autoSet = 'false';
  }

  // Breakeven fill: percentage of premium threshold reached
  const fillPercent = annualPremium > 0
    ? Math.min(100, Math.max(0, (salaryDiff / annualPremium) * 100))
    : 0;

  const fillEl = document.getElementById('breakevenFill')!;
  fillEl.style.width = `${fillPercent}%`;
  fillEl.style.background = fillPercent >= 100 ? 'var(--success)' : 'var(--warning)';

  // Breakeven marker at 100% position
  const markerEl = document.getElementById('breakevenMarker')!;
  markerEl.style.left = '100%';

  // Verdict
  const verdictBox = document.getElementById('verdictBox')!;
  const verdictText = document.getElementById('verdictText')!;

  verdictBox.classList.remove('pslf-wins', 'private-wins');

  if (enteredSalary <= 0) {
    verdictText.textContent = 'Enter a private practice salary to see the verdict.';
  } else if (enteredSalary >= breakevenSalary) {
    verdictBox.classList.add('private-wins');
    const surplus = enteredSalary - breakevenSalary;
    verdictText.textContent = surplus > 0
      ? `Private practice wins \u2014 you'd earn ${formatMoney(surplus)}/yr above the breakeven threshold.`
      : `At exactly the breakeven point \u2014 either path is financially equivalent.`;
  } else {
    verdictBox.classList.add('pslf-wins');
    const shortfall = breakevenSalary - enteredSalary;
    verdictText.textContent =
      `PSLF wins \u2014 the private offer is ${formatMoney(shortfall)}/yr below what you'd need to offset loan forgiveness.`;
  }
}

function displayPSLFPremiumFallback(
  results: StrategyResult[],
  recommendation: Recommendation,
  inputs: UserInputs,
  premium: NonNullable<Recommendation['keyMetrics']['pslfSalaryPremium']>
) {
  const pslfPremiumCard = document.getElementById('pslfPremiumCard')!;
  pslfPremiumCard.style.display = 'block';

  const specialtyData = getSpecialty(inputs.career.specialty);
  const attendingSalary = inputs.career.expectedAttendingSalary || specialtyData.medianAttendingSalary;

  document.getElementById('pslfPremiumAnnual')!.textContent =
    formatMoney(premium.annualPremiumRequired) + '/yr';
  document.getElementById('pslfPremiumMonthly')!.textContent =
    formatMoney(premium.monthlyPremiumRequired) + '/mo';
  document.getElementById('pslfPremiumBenefit')!.textContent =
    formatMoney(premium.pslfNPVBenefit);

  document.getElementById('pslfPremiumDescription')!.textContent =
    `To make leaving a PSLF-eligible job worthwhile, a non-PSLF position would need to pay at least ` +
    `${formatMoney(premium.annualPremiumRequired)} more per year ` +
    `(${formatMoney(attendingSalary + premium.annualPremiumRequired)} total vs ` +
    `${formatMoney(attendingSalary)} at a PSLF-eligible employer).`;

  const pslfStrategy = results.find(r => r.strategyName === 'PSLF');
  const pslfYears = pslfStrategy ? pslfStrategy.totalYears : recommendation.primaryStrategy.totalYears;

  document.getElementById('pslfPremiumExplanation')!.textContent =
    `This accounts for taxes on the extra income (${(premium.effectiveMarginalRate * 100).toFixed(1)}% marginal rate) ` +
    `and the time value of money over the ${pslfYears}-year PSLF repayment period. ` +
    `A private practice job paying less than this premium would not offset the PSLF forgiveness benefit.`;
}

function displayAggressiveFallback(
  recommendation: Recommendation,
  aggressiveResult: AggressivePayoffResult
) {
  const aggressiveResultsDiv = document.getElementById('aggressiveResults')!;
  aggressiveResultsDiv.style.display = 'block';

  const livingExpenses = (document.getElementById('livingExpenses') as HTMLInputElement).value;
  const aggressiveYears = (document.getElementById('aggressiveYears') as HTMLSelectElement).value;

  document.getElementById('aggressiveDescription')!.textContent =
    `Living on ${formatMoney(sanitizeNumericValue(livingExpenses))}/year for ${aggressiveYears} years after training, ` +
    `you'd pay ${formatMoney(aggressiveResult.monthlyPaymentAggressive)}/month toward loans.`;

  document.getElementById('aggressiveNPV')!.textContent = formatMoney(aggressiveResult.npv);
  document.getElementById('aggressiveTime')!.textContent =
    `Debt-free ${aggressiveResult.yearsToPayoff} years after training`;

  document.getElementById('bestStrategyLabel')!.textContent = recommendation.primaryStrategy.strategyName;
  document.getElementById('bestStrategyNPV')!.textContent = formatMoney(recommendation.primaryStrategy.npv);
  document.getElementById('bestStrategyTime')!.textContent =
    `${recommendation.primaryStrategy.totalYears} years`;

  // Highlight winner
  const aggressiveItem = document.getElementById('aggressiveItem')!;
  const bestItem = document.getElementById('bestStrategyItem')!;
  aggressiveItem.classList.remove('winner');
  bestItem.classList.remove('winner');

  if (aggressiveResult.npv < recommendation.primaryStrategy.npv) {
    aggressiveItem.classList.add('winner');
    const yearsSooner = recommendation.primaryStrategy.totalYears - aggressiveResult.totalYears;
    document.getElementById('aggressiveExplanation')!.textContent =
      `Aggressive payoff wins by ${formatMoney(recommendation.primaryStrategy.npv - aggressiveResult.npv)} (net present value). ` +
      (yearsSooner > 0 ? `You'd be debt-free ${yearsSooner} years sooner.` : `You'd be debt-free faster.`);
  } else {
    bestItem.classList.add('winner');
    document.getElementById('aggressiveExplanation')!.textContent =
      `${recommendation.primaryStrategy.strategyName} wins by ${formatMoney(aggressiveResult.npv - recommendation.primaryStrategy.npv)} (net present value). ` +
      `The forgiveness value exceeds what you'd save through aggressive payoff.`;
  }
}

function displayResults(
  results: StrategyResult[], 
  recommendation: Recommendation,
  aggressiveResult: AggressivePayoffResult | null,
  inputs: UserInputs
) {
  resultsDiv.classList.add('visible');
  
  // Recommendation box
  document.getElementById('recommendedStrategy')!.textContent = recommendation.primaryStrategy.strategyName;
  
  const confidenceEl = document.getElementById('confidence')!;
  confidenceEl.textContent = recommendation.confidence;
  confidenceEl.className = `confidence ${recommendation.confidence}`;
  
  document.getElementById('dtiRatio')!.textContent = recommendation.keyMetrics.debtToIncomeRatio.toFixed(2);
  document.getElementById('savings')!.textContent = formatMoney(recommendation.keyMetrics.totalSavingsVsRefi);
  document.getElementById('forgiveness')!.textContent = formatMoney(recommendation.keyMetrics.forgivenessBenefit);
  
  const reasoningEl = document.getElementById('reasoning')!;
  reasoningEl.innerHTML = recommendation.reasoning.map(r => `<li>${r}</li>`).join('');
  
  document.getElementById('explanationText')!.textContent = generateExplanation(recommendation, inputs);

  // Store state for real-time salary updates
  lastResults = results;
  lastRecommendation = recommendation;
  lastAggressiveResult = aggressiveResult;
  lastInputs = inputs;

  // Career path / PSLF premium / aggressive payoff display
  displayCareerPathSection(results, recommendation, aggressiveResult, inputs);

  // Results table
  const tableBody = document.getElementById('resultsTable')!;
  tableBody.innerHTML = '';
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const row = document.createElement('tr');
    if (i === 0) row.className = 'best-row';
    
    row.innerHTML = `
      <td>
        <strong>${result.strategyName}</strong>
        <div class="risks">${result.description}</div>
      </td>
      <td class="money">${formatMoney(result.totalPayments)}</td>
      <td class="money ${result.forgivenessAmount > 0 ? 'negative' : ''}">${formatMoney(result.forgivenessAmount)}</td>
      <td class="money">${formatMoney(result.taxOnForgiveness)}</td>
      <td class="money"><strong>${formatMoney(result.npv)}</strong></td>
      <td>${result.totalYears}</td>
    `;
    
    tableBody.appendChild(row);
  }
  
  // Scroll to results
  resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// Event Handlers
// ============================================

form.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const inputs = getFormInputs();
  const results = compareAllStrategies(inputs);
  const recommendation = generateRecommendation(inputs, results);
  
  // Calculate aggressive payoff if enabled
  const aggressiveParams = getAggressiveParams(inputs);
  const aggressiveResult = aggressiveParams ? calculateAggressivePayoff(aggressiveParams) : null;
  
  displayResults(results, recommendation, aggressiveResult, inputs);
});

// Update AGI when stage changes (convenience)
document.getElementById('currentStage')!.addEventListener('change', (e) => {
  const stage = (e.target as HTMLSelectElement).value;
  const salaries: Record<string, number> = {
    ms4: 0,
    pgy1: 64000,
    pgy2: 66000,
    pgy3: 69000,
    pgy4: 72000,
    pgy5: 75000,
    pgy6: 78000,
    pgy7: 81000,
    fellow: 85000,
    attending: 275000,
  };
  
  const agiInput = document.getElementById('agi') as HTMLInputElement;
  if (salaries[stage]) {
    agiInput.value = salaries[stage].toString();
  }
});

// Show/hide spouse income based on filing status
document.getElementById('filingStatus')!.addEventListener('change', (e) => {
  const status = (e.target as HTMLSelectElement).value;
  const spouseGroup = document.getElementById('spouseAgi')!.parentElement!;
  spouseGroup.style.display = status === 'single' ? 'none' : 'flex';
});

// Toggle aggressive payoff section
document.getElementById('aggressivePayoff')!.addEventListener('change', (e) => {
  const checked = (e.target as HTMLInputElement).checked;
  const content = document.getElementById('aggressiveContent')!;
  content.classList.toggle('visible', checked);
});

// Real-time salary comparison update
document.getElementById('privateSalaryInput')!.addEventListener('input', () => {
  if (lastRecommendation && lastAggressiveResult && lastResults && lastInputs) {
    updateBreakevenBar();
  }
});

// Share button
document.getElementById('shareButton')!.addEventListener('click', async () => {
  const url = encodeFormToURL();
  
  try {
    await navigator.clipboard.writeText(url);
    const button = document.getElementById('shareButton')!;
    const originalText = button.textContent;
    button.textContent = '✓ Copied!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  } catch (err) {
    // Fallback for browsers without clipboard API
    prompt('Copy this link:', url);
  }
});

// ============================================
// Initialize
// ============================================

initSpecialtyDropdown();
initStateDropdown();

// Hide spouse income initially
document.getElementById('spouseAgi')!.parentElement!.style.display = 'none';

// Load from URL if parameters present
const hasParams = loadFormFromURL();
if (hasParams) {
  // Auto-calculate if URL had parameters
  form.dispatchEvent(new Event('submit'));
}

console.log('Med Debt Optimizer loaded');
