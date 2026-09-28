export type BiomarkerStatus = 'Normal' | 'Borderline' | 'Attention';

export interface Biomarker {
  id: string;
  name: string;
  value: number;
  unit: string;
  referenceRange: string;
  status: BiomarkerStatus | string;
  organSystem: 'Metabolic' | 'Cardiovascular' | 'Micronutrient' | 'Thyroid & Hepatic' | string;
  clinicalInsight: string;
  targetAction: string;
}

export interface ChronoMeal {
  id: string;
  timeWindow: string;
  mealName: string;
  dishTitle: string;
  targetedBiomarkers: string;
  macros: string;
  bioavailabilityRule: string;
  ingredients: string;
  completed?: boolean;
}

export interface ExercisePrescription {
  id: string;
  sessionTitle: string;
  cadence: string;
  durationMinutes: number;
  heartRateZone: string;
  targetedBiomarkerMechanism: string;
  protocolSteps: string;
  safetyGuardrail: string;
  completed?: boolean;
}

export interface MedicationAlertItem {
  id: string;
  name: string;
  dosage: string;
  scheduledTime: string; // HH:MM 24h format
  circadianWindow: 'Morning' | 'Midday' | 'Evening' | 'Bedtime' | string;
  foodInstruction: string;
  interactionWarning: string;
  linkedBiomarker: string;
  status: 'Scheduled' | 'Taken' | 'Snoozed';
  lastTakenAt?: string;
}

export interface SpecialistHospitalEntry {
  id: string;
  doctorName: string;
  specialty: string;
  subSpecialtyFocus: string;
  hospitalName: string;
  cityDistrict: string;
  accreditation: string;
  experienceYears: number;
  consultationFee: number;
  regionalAverageFee: number;
  diagnosticBundlePrice: number;
  regionalDiagnosticAverage: number;
  priceTier: 'Fair Value Benchmark' | 'Subsidized Academic' | 'Standard Private';
  nextAvailableSlot: string;
  matchedBiomarkers: string[];
  avatarUrl?: string;
  outcomesMetric: string;
}

export interface HealthReportAnalysis {
  reportTitle: string;
  reportDate: string;
  patientName: string;
  labSource: string;
  summaryHeadline: string;
  conditionOverview: string;
  recommendedSpecialistCategory: string;
  biomarkers: Biomarker[];
  dietPlan: ChronoMeal[];
  exercisePlan: ExercisePrescription[];
}
