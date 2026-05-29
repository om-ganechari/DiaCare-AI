/**
 * Shared Type Definitions for DiaCare AI
 */

export type Language = 'en' | 'hi' | 'mr';

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface SymptomData {
  frequentUrination: boolean;
  excessiveThirst: boolean;
  extremeHunger: boolean;
  constantFatigue: boolean;
  blurredVision: boolean;
  slowHealing: boolean;
  tinglingHandsFeet: boolean;
  frequentInfections: boolean;
  dryMouth: boolean;
  suddenWeightChange: boolean;
  headaches: boolean;
  dizziness: boolean;
}

export interface LifestyleData {
  activityLevel: 'low' | 'moderate' | 'active';
  sleepHours: number;
  stressLevel: 'low' | 'medium' | 'high';
  waterIntake: number; // liters
  junkFoodFreq: 'rare' | 'sometimes' | 'frequent';
  sugarIntake: 'low' | 'moderate' | 'high';
  smoking: boolean;
  alcohol: 'none' | 'occasional' | 'regular';
  familyHistory: boolean;
}

export interface BodyMetrics {
  age: number;
  gender: 'male' | 'female' | 'other';
  height: number; // cm
  weight: number; // kg
  bmi: number;
}

export interface ClinicalData {
  glucose: number; // mg/dL
  bloodPressure: number; // mmHg (systolic preferred)
  insulin: number; // uIU/mL
  hba1c?: number; // %
  cholesterol?: number; // mg/dL
  bmi: number;
}

export interface AssessmentResponse {
  assessmentId: string;
  userId: string;
  metrics: BodyMetrics;
  symptoms: SymptomData;
  lifestyle: LifestyleData;
  clinicalData?: ClinicalData;
  riskLevel: RiskLevel;
  riskPercentage: number;
  riskCategory?: string;
  suggestedTests?: string[];
  healthScore: number;
  explanation: string;
  recommendations: string[];
  clinicallyPredicted: boolean;
  createdAt: string;
}

export interface FeedbackData {
  rating: number;
  comment: string;
  name?: string;
  email?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface PdfDownload {
  downloadId: string;
  userId: string;
  assessmentId: string;
  fileName: string;
  riskLevel: RiskLevel;
  riskPercentage: number;
  createdAt: string;
}
