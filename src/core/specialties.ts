import type { SpecialtyData } from './types.js';

// ============================================
// Medical Specialty Data
// Sources: Medscape 2024, Doximity 2024
// Update annually
// ============================================

export const SPECIALTIES: Record<string, SpecialtyData> = {
  // Primary Care
  family_medicine: {
    name: 'Family Medicine',
    medianAttendingSalary: 255000,
    salaryP25: 210000,
    salaryP75: 300000,
    typicalTrainingYears: 3,
    pslfPrevalence: 0.45,
  },
  internal_medicine: {
    name: 'Internal Medicine (General)',
    medianAttendingSalary: 275000,
    salaryP25: 230000,
    salaryP75: 330000,
    typicalTrainingYears: 3,
    pslfPrevalence: 0.40,
  },
  pediatrics: {
    name: 'Pediatrics (General)',
    medianAttendingSalary: 245000,
    salaryP25: 200000,
    salaryP75: 290000,
    typicalTrainingYears: 3,
    pslfPrevalence: 0.55,
  },
  med_peds: {
    name: 'Med-Peds',
    medianAttendingSalary: 260000,
    salaryP25: 215000,
    salaryP75: 310000,
    typicalTrainingYears: 4,
    pslfPrevalence: 0.45,
  },

  // Internal Medicine Subspecialties
  cardiology: {
    name: 'Cardiology',
    medianAttendingSalary: 510000,
    salaryP25: 400000,
    salaryP75: 650000,
    typicalTrainingYears: 6,
    pslfPrevalence: 0.30,
  },
  gastroenterology: {
    name: 'Gastroenterology',
    medianAttendingSalary: 495000,
    salaryP25: 380000,
    salaryP75: 600000,
    typicalTrainingYears: 6,
    pslfPrevalence: 0.25,
  },
  pulm_crit: {
    name: 'Pulmonology/Critical Care',
    medianAttendingSalary: 400000,
    salaryP25: 320000,
    salaryP75: 480000,
    typicalTrainingYears: 6,
    pslfPrevalence: 0.40,
  },
  nephrology: {
    name: 'Nephrology',
    medianAttendingSalary: 310000,
    salaryP25: 260000,
    salaryP75: 370000,
    typicalTrainingYears: 5,
    pslfPrevalence: 0.40,
  },
  endocrinology: {
    name: 'Endocrinology',
    medianAttendingSalary: 270000,
    salaryP25: 220000,
    salaryP75: 320000,
    typicalTrainingYears: 5,
    pslfPrevalence: 0.45,
  },
  rheumatology: {
    name: 'Rheumatology',
    medianAttendingSalary: 290000,
    salaryP25: 240000,
    salaryP75: 350000,
    typicalTrainingYears: 5,
    pslfPrevalence: 0.40,
  },
  infectious_disease: {
    name: 'Infectious Disease',
    medianAttendingSalary: 265000,
    salaryP25: 220000,
    salaryP75: 315000,
    typicalTrainingYears: 5,
    pslfPrevalence: 0.50,
  },
  hematology_oncology: {
    name: 'Hematology/Oncology',
    medianAttendingSalary: 440000,
    salaryP25: 350000,
    salaryP75: 550000,
    typicalTrainingYears: 6,
    pslfPrevalence: 0.35,
  },

  // Hospital Medicine
  hospitalist: {
    name: 'Hospitalist',
    medianAttendingSalary: 310000,
    salaryP25: 260000,
    salaryP75: 365000,
    typicalTrainingYears: 3,
    pslfPrevalence: 0.45,
  },

  // Surgery
  general_surgery: {
    name: 'General Surgery',
    medianAttendingSalary: 420000,
    salaryP25: 340000,
    salaryP75: 520000,
    typicalTrainingYears: 5,
    pslfPrevalence: 0.25,
  },
  orthopedic_surgery: {
    name: 'Orthopedic Surgery',
    medianAttendingSalary: 560000,
    salaryP25: 450000,
    salaryP75: 750000,
    typicalTrainingYears: 5,
    pslfPrevalence: 0.15,
  },
  neurosurgery: {
    name: 'Neurosurgery',
    medianAttendingSalary: 650000,
    salaryP25: 500000,
    salaryP75: 850000,
    typicalTrainingYears: 7,
    pslfPrevalence: 0.20,
  },
  plastic_surgery: {
    name: 'Plastic Surgery',
    medianAttendingSalary: 520000,
    salaryP25: 380000,
    salaryP75: 700000,
    typicalTrainingYears: 6,
    pslfPrevalence: 0.10,
  },
  cardiothoracic_surgery: {
    name: 'Cardiothoracic Surgery',
    medianAttendingSalary: 600000,
    salaryP25: 480000,
    salaryP75: 780000,
    typicalTrainingYears: 7,
    pslfPrevalence: 0.25,
  },
  vascular_surgery: {
    name: 'Vascular Surgery',
    medianAttendingSalary: 500000,
    salaryP25: 400000,
    salaryP75: 620000,
    typicalTrainingYears: 6,
    pslfPrevalence: 0.25,
  },
  urology: {
    name: 'Urology',
    medianAttendingSalary: 480000,
    salaryP25: 380000,
    salaryP75: 600000,
    typicalTrainingYears: 5,
    pslfPrevalence: 0.20,
  },
  colorectal_surgery: {
    name: 'Colorectal Surgery',
    medianAttendingSalary: 420000,
    salaryP25: 340000,
    salaryP75: 520000,
    typicalTrainingYears: 6,
    pslfPrevalence: 0.25,
  },

  // Other Specialties
  anesthesiology: {
    name: 'Anesthesiology',
    medianAttendingSalary: 430000,
    salaryP25: 350000,
    salaryP75: 520000,
    typicalTrainingYears: 4,
    pslfPrevalence: 0.25,
  },
  radiology: {
    name: 'Radiology',
    medianAttendingSalary: 470000,
    salaryP25: 380000,
    salaryP75: 570000,
    typicalTrainingYears: 5,
    pslfPrevalence: 0.30,
  },
  radiation_oncology: {
    name: 'Radiation Oncology',
    medianAttendingSalary: 480000,
    salaryP25: 380000,
    salaryP75: 580000,
    typicalTrainingYears: 5,
    pslfPrevalence: 0.35,
  },
  emergency_medicine: {
    name: 'Emergency Medicine',
    medianAttendingSalary: 350000,
    salaryP25: 290000,
    salaryP75: 420000,
    typicalTrainingYears: 3,
    pslfPrevalence: 0.40,
  },
  psychiatry: {
    name: 'Psychiatry',
    medianAttendingSalary: 280000,
    salaryP25: 230000,
    salaryP75: 340000,
    typicalTrainingYears: 4,
    pslfPrevalence: 0.50,
  },
  neurology: {
    name: 'Neurology',
    medianAttendingSalary: 315000,
    salaryP25: 260000,
    salaryP75: 380000,
    typicalTrainingYears: 4,
    pslfPrevalence: 0.40,
  },
  dermatology: {
    name: 'Dermatology',
    medianAttendingSalary: 450000,
    salaryP25: 350000,
    salaryP75: 600000,
    typicalTrainingYears: 4,
    pslfPrevalence: 0.15,
  },
  ophthalmology: {
    name: 'Ophthalmology',
    medianAttendingSalary: 400000,
    salaryP25: 300000,
    salaryP75: 550000,
    typicalTrainingYears: 4,
    pslfPrevalence: 0.15,
  },
  pathology: {
    name: 'Pathology',
    medianAttendingSalary: 320000,
    salaryP25: 260000,
    salaryP75: 390000,
    typicalTrainingYears: 4,
    pslfPrevalence: 0.40,
  },
  physical_medicine: {
    name: 'Physical Medicine & Rehabilitation',
    medianAttendingSalary: 290000,
    salaryP25: 240000,
    salaryP75: 350000,
    typicalTrainingYears: 4,
    pslfPrevalence: 0.35,
  },
  ob_gyn: {
    name: 'Obstetrics & Gynecology',
    medianAttendingSalary: 340000,
    salaryP25: 275000,
    salaryP75: 420000,
    typicalTrainingYears: 4,
    pslfPrevalence: 0.35,
  },
  otolaryngology: {
    name: 'Otolaryngology (ENT)',
    medianAttendingSalary: 420000,
    salaryP25: 330000,
    salaryP75: 530000,
    typicalTrainingYears: 5,
    pslfPrevalence: 0.20,
  },

  // Custom/Other
  other: {
    name: 'Other Specialty',
    medianAttendingSalary: 320000,
    salaryP25: 250000,
    salaryP75: 400000,
    typicalTrainingYears: 4,
    pslfPrevalence: 0.35,
  },
};

export function getSpecialty(key: string): SpecialtyData {
  return SPECIALTIES[key] || SPECIALTIES['other'];
}

export function getAllSpecialtyKeys(): string[] {
  return Object.keys(SPECIALTIES);
}
