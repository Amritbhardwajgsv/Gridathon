export type UserRole = "admin" | "operator" | "viewer";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  approval_status?: "pending" | "approved" | "rejected";
  badge_id?: string | null;
  rank?: string | null;
  unit_name?: string | null;
  rejection_reason?: string | null;
  created_at?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  badge_id?: string;
  rank?: string;
  unit_name?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  user: AuthUser;
}

export interface PredictImpactPayload {
  event_name?: string;
  event_cause_grouped: string;
  event_type: string;
  priority: string;
  requires_road_closure: boolean;
  corridor: string;
  zone: string;
  latitude: number;
  longitude: number;
  hour: number;
  day_of_week: number;
  month: number;
  pipeline_mode?: "planned" | "unplanned";
  idempotency_key?: string;
  operator_override_notes?: string;
  estimated_crowd_size?: number;
  operational_description?: string;
}

export interface NlpSignal {
  summary: string;
  keywords: string[];
  urgency_score: number;
  detected_risks: string[];
  agent_used: string;
}

export interface ResourceRecommendation {
  personnel_total: number;
  constables: number;
  asi: number;
  si: number;
  inspectors: number;
  barricades: number;
  tow_units: number;
  medical_units: number;
  diversion_confidence: number;
  primary_action: string;
  deployment_notes: string[];
}

export interface LearningSignal {
  feedback_required: boolean;
  retraining_priority: string;
  expected_ground_truth_fields: string[];
  post_event_questions: string[];
  learning_notes: string[];
}

export interface PredictImpactResponse {
  predicted_duration_minutes: number;
  impact_level: string;
  model_version: string;
  nlp_signal?: NlpSignal | null;
  resource_recommendation?: ResourceRecommendation | null;
  learning_signal?: LearningSignal | null;
}

export interface PredictionHistoryItem {
  id: string;
  created_at: string;
  payload: PredictImpactPayload;
  result: PredictImpactResponse;
}

export interface RecentPrediction {
  id: string;
  event_name?: string | null;
  event_cause_grouped: string;
  event_type: string;
  priority: string;
  corridor: string;
  zone: string;
  predicted_duration_minutes: number;
  impact_level: string;
  model_version: string;
  pipeline_mode: string;
  created_at: string;
}

export interface OperationsSummary {
  prediction_count: number;
  grievance_count: number;
  retraining_ready_count: number;
  impact_counts: Record<string, number>;
  severity_counts: Record<string, number>;
  recent_predictions: RecentPrediction[];
}

export type GrievanceType =
  | "event_congestion"
  | "illegal_parking"
  | "road_closure"
  | "accident_or_breakdown"
  | "signal_failure"
  | "other";

export interface CitizenGrievancePayload {
  reporter_name?: string;
  reporter_phone?: string;
  reporter_email?: string;
  complaint_type: GrievanceType;
  severity?: "Low" | "Medium" | "High" | "Critical";  // omit to let DRISHTI auto-assess
  location_text: string;
  zone?: string;
  corridor?: string;
  latitude?: number;
  longitude?: number;
  description: string;
}

export interface CitizenGrievance {
  id: string;
  tracking_id: string;
  complaint_type: GrievanceType;
  severity: "Low" | "Medium" | "High" | "Critical";
  location_text: string;
  zone?: string | null;
  corridor?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description: string;
  status: string;
  agent_priority_score?: number | null;
  agent_recommendation?: string | null;
  reporter_phone?: string | null;
  created_at: string;
}

export type GrievanceStatus = "pending" | "in_progress" | "assigned" | "pending_verification" | "resolved" | "closed";
export type DeploymentStatus = "draft" | "issued" | "enroute" | "onscene" | "resolved" | "escalated" | "cancelled";

export interface GrievanceStatusUpdatePayload {
  status: GrievanceStatus;
  notes?: string;
}

export interface DeploymentStatusUpdatePayload {
  status: DeploymentStatus;
  notes?: string;
}

export interface PolicePersonnelPayload {
  badge_id: string;
  name: string;
  rank: "Constable" | "Head Constable" | "ASI" | "SI" | "Inspector" | "ACP" | "DCP";
  unit_name: string;
  zone?: string;
  phone?: string;
  whatsapp_phone?: string;
  current_latitude?: number;
  current_longitude?: number;
}

export interface PolicePersonnel extends PolicePersonnelPayload {
  id: string;
  is_available: boolean;
  is_active?: boolean;
  last_location_at?: string | null;
  created_at: string;
}

export interface PersonnelLocationUpdatePayload {
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
}

export interface PersonnelLocationUpdateResponse {
  badge_id: string;
  name: string;
  current_latitude: number;
  current_longitude: number;
  last_location_at: string;
  polling_interval_seconds: number;
}

export interface FieldAssignment {
  order_id: string;
  order_number: string;
  status: string;
  priority: string;
  corridor: string;
  zone: string;
  deployment_latitude?: number | null;
  deployment_longitude?: number | null;
  field_brief?: string | null;
  notification_payload: Record<string, unknown>;
  complaint_tracking_id?: string | null;
  complaint_type?: string | null;
  complaint_severity?: string | null;
  complaint_location?: string | null;
  complaint_description?: string | null;
  created_at: string;
}

export interface DeploymentOrderPayload {
  grievance_id: string;
  personnel_ids?: string[];
  auto_assign_nearest?: boolean;
  required_personnel_count?: number;
  field_brief: string;
  status?: "draft" | "issued";
}

export interface DeploymentOrder {
  id: string;
  order_number: string;
  grievance_id?: string | null;
  corridor: string;
  zone: string;
  priority: string;
  status: string;
  resource_recommendation: Record<string, unknown>;
  notification_payload: Record<string, unknown>;
  deployment_latitude?: number | null;
  deployment_longitude?: number | null;
  field_brief?: string | null;
  assigned_personnel: PolicePersonnel[];
  created_at: string;
}
