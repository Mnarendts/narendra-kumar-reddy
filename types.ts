
export interface Transcription {
  drug_name: string;
  generic_name: string;
  dosage_strength: string;
  frequency_translated: string;
  diagnosis_inferred: string;
  duration_days: number;
}

export interface PillDetails {
  color: string;
  shape: string;
  imprint: string;
  scoring: string;
  logo_description: string;
}

export interface PillVerification {
  visual_match: "MATCH" | "MISMATCH" | "NO_PILL_IMAGE";
  reasoning: string;
  details: PillDetails;
}

export interface PatientLiteracy {
  purpose_simplified: string;
  critical_warning: string;
}

export interface MedicationGuidance {
  best_time_to_take: string;
  food_interaction: string;
  missed_dose_logic: string;
}

export interface RecoveryTimelineEvent {
  day: number;
  status: string;
  expectation: string;
  severity_score: number; // 0-10 scale (10 = worst symptoms, 0 = recovered)
}

export interface DosageAnalysis {
  status: "OPTIMAL" | "HIGH" | "LOW" | "REQUIRES_REVIEW";
  standard_range: string;
  recommendation: string;
}

export interface PatientDetails {
  name: string;
  age_or_dob: string;
}

export interface ScriptGuardResponse {
  patient_details: PatientDetails;
  safety_status: "SAFE" | "ALERT";
  raw_script_extraction: string;
  transcription: Transcription;
  dosage_analysis: DosageAnalysis;
  medication_guidance: MedicationGuidance;
  pill_verification: PillVerification;
  patient_literacy_card: PatientLiteracy;
  recovery_timeline: RecoveryTimelineEvent[];
}

export interface FileState {
  file: File | null;
  previewUrl: string | null;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string; // base64 string
  audio?: string; // base64 string
  audioMimeType?: string; // e.g. 'audio/webm', 'audio/mp4'
  timestamp: number;
  isEmergency?: boolean;
  emergencyReason?: string;
}

export interface RecoveryMetric {
  day: string;
  severity: number;
}

export interface ShelfConflict {
  shelf_drug: string;
  conflict_reason: string;
  action: string;
}

export interface CabinetScanResult {
  shelf_inventory: string[];
  conflicts: ShelfConflict[];
  safe_items: string[];
}

export interface SubstituteAnalysis {
  status: "APPROVED" | "CAUTION" | "REJECTED";
  reason: string;
  dosage_adjustment: string;
  visual_check: string;
}

// NEW: Structure to hold the data plus metadata like notes
export interface ScriptRecord {
  data: ScriptGuardResponse[];
  notes: string[];
  timestamp: number;
}

// UPDATED: Archive now maps to ScriptRecord instead of just the array
export interface ScriptArchive {
  [key: string]: ScriptRecord; 
}

// NEW: User Info with Sender Credentials
export interface UserInfo {
  name: string;
  email: string;
  country: string;
  phone: string;
  language: string;
  sos: string;
  sender_email?: string;
  sender_pass?: string;
}

// NEW: Notification Log Item with Status
export interface NotificationLogItem {
  time: string;
  type: 'SMS' | 'EMAIL';
  msg: string;
  status?: string; // e.g. "Sent (Real)" or "Sent (Simulated)"
}

// NEW: Lab Analysis Structures
export interface LabAbnormality {
  test_name: string;
  measured_value: string;
  status: "HIGH" | "LOW" | "CRITICAL" | "ABNORMAL";
  significance: string;
}

export interface LabMetric {
  metric: string;
  value: string;
  unit: string;
}

export interface LabAnalysis {
  patient_name_detected: string | null;
  report_date: string | null;
  summary: string;
  abnormalities: LabAbnormality[];
  key_vitals: LabMetric[];
}
