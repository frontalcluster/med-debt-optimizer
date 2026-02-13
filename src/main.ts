import {
  compareAllStrategies,
  generateRecommendation,
  getAllSpecialtyKeys,
  getSpecialty,
  STATE_TAX_RATES,
} from './index.js';

import type { UserInputs, StrategyResult, Recommendation, TrainingStage, FilingStatus } from './core/types.js';

// ============================================
// DOM Elements
// ============================================

const form = document.getElementById('calculator') as HTMLFormElement;
const resultsDiv = document.getElementById('results') as HTMLDivElement;
const specialtySelect = document.getElementById('specialty') as HTMLSelectElement;
const stateSelect = document.getElementById('state') as HTMLSelectElement;

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
    return parseFloat(el.value) || 0;
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

function displayResults(results: StrategyResult[], recommendation: Recommendation) {
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
  
  displayResults(results, recommendation);
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

// ============================================
// Initialize
// ============================================

initSpecialtyDropdown();
initStateDropdown();

// Hide spouse income initially
document.getElementById('spouseAgi')!.parentElement!.style.display = 'none';

console.log('Med Debt Optimizer loaded');
