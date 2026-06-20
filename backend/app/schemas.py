from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ImpactPredictionRequest(BaseModel):
    event_name: str | None = Field(default=None, max_length=160)
    event_cause_grouped: str = Field(..., examples=["vehicle_breakdown"])
    event_type: str = Field(..., examples=["unplanned"])
    priority: str = Field(..., examples=["High"])
    requires_road_closure: bool = Field(..., examples=[False])
    corridor: str = Field(..., examples=["ORR East 1"])
    zone: str = Field(..., examples=["East Zone 1"])
    latitude: float = Field(..., examples=[12.9716])
    longitude: float = Field(..., examples=[77.5946])
    hour: int = Field(..., ge=0, le=23, examples=[9])
    day_of_week: int = Field(..., ge=0, le=6, examples=[2])
    month: int = Field(..., ge=1, le=12, examples=[6])
    pipeline_mode: Literal["planned", "unplanned"] | None = Field(
        default=None,
        description="Operational lane. Planned is batch/document-first; unplanned is SLA-first.",
    )
    idempotency_key: str | None = Field(
        default=None,
        description="Optional client-supplied key for byte-identical repeated outputs.",
    )
    operator_override_notes: str | None = Field(
        default=None,
        description="Stored as feedback only; never blocks or challenges the operator.",
    )
    estimated_crowd_size: int | None = Field(default=None, ge=0)
    operational_description: str | None = Field(default=None, max_length=2000)


class NlpSignal(BaseModel):
    summary: str
    keywords: list[str]
    urgency_score: int
    detected_risks: list[str]
    agent_used: str


class ResourceRecommendation(BaseModel):
    personnel_total: int
    constables: int
    asi: int
    si: int
    inspectors: int
    barricades: int
    tow_units: int
    medical_units: int
    diversion_confidence: float
    primary_action: str
    deployment_notes: list[str]


class LearningSignal(BaseModel):
    feedback_required: bool
    retraining_priority: str
    expected_ground_truth_fields: list[str]
    post_event_questions: list[str]
    learning_notes: list[str]


class ImpactPredictionResponse(BaseModel):
    predicted_duration_minutes: float
    impact_level: str
    model_version: str = "v1"
    nlp_signal: NlpSignal | None = None
    resource_recommendation: ResourceRecommendation | None = None
    learning_signal: LearningSignal | None = None


class HealthResponse(BaseModel):
    status: str
    duration_model_loaded: bool
    impact_model_loaded: bool
    resource_model_loaded: bool = False
    learning_model_loaded: bool = False
    prediction_logging_enabled: bool


class RecentPredictionResponse(BaseModel):
    id: UUID
    event_name: str | None = None
    event_cause_grouped: str
    event_type: str
    priority: str
    corridor: str
    zone: str
    predicted_duration_minutes: float
    impact_level: str
    model_version: str
    pipeline_mode: str
    created_at: datetime


class OperationsSummaryResponse(BaseModel):
    prediction_count: int
    grievance_count: int
    retraining_ready_count: int
    impact_counts: dict[str, int]
    severity_counts: dict[str, int]
    recent_predictions: list[RecentPredictionResponse]


class SystemLogResponse(BaseModel):
    id: UUID
    aggregate_type: str
    aggregate_key: str
    event_type: str
    event_payload: dict
    created_at: datetime


class SystemLogListResponse(BaseModel):
    items: list[SystemLogResponse]


class AuthUserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: Literal["admin", "operator", "viewer"]
    is_active: bool
    approval_status: Literal["pending", "approved", "rejected"] = "approved"
    badge_id: str | None = None
    rank: str | None = None
    unit_name: str | None = None
    rejection_reason: str | None = None
    created_at: datetime | None = None


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: Literal["admin", "operator", "viewer"]
    badge_id: str | None = Field(default=None, max_length=64)
    rank: str | None = Field(default=None, max_length=64)
    unit_name: str | None = Field(default=None, max_length=120)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserResponse


class UserListResponse(BaseModel):
    items: list[AuthUserResponse]


class RejectUserRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class PolicePersonnelCreateRequest(BaseModel):
    badge_id: str = Field(..., min_length=2, max_length=64)
    name: str = Field(..., min_length=1, max_length=120)
    rank: Literal["Constable", "Head Constable", "ASI", "SI", "Inspector", "ACP", "DCP"]
    unit_name: str = Field(..., min_length=1, max_length=120)
    zone: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    whatsapp_phone: str | None = Field(default=None, max_length=20)
    current_latitude: float | None = None
    current_longitude: float | None = None


class PolicePersonnelResponse(BaseModel):
    id: UUID
    badge_id: str
    name: str
    rank: str
    unit_name: str
    zone: str | None = None
    phone: str | None = None
    whatsapp_phone: str | None = None
    current_latitude: float | None = None
    current_longitude: float | None = None
    last_location_at: datetime | None = None
    is_available: bool
    is_active: bool = True
    created_at: datetime


class PolicePersonnelListResponse(BaseModel):
    items: list[PolicePersonnelResponse]


class PersonnelLocationUpdateRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy_meters: float | None = Field(default=None, ge=0)


class PersonnelLocationUpdateResponse(BaseModel):
    badge_id: str
    name: str
    current_latitude: float
    current_longitude: float
    last_location_at: datetime
    polling_interval_seconds: int = 30


class FieldAssignmentResponse(BaseModel):
    order_id: UUID
    order_number: str
    status: str
    priority: str
    corridor: str
    zone: str
    deployment_latitude: float | None = None
    deployment_longitude: float | None = None
    field_brief: str | None = None
    notification_payload: dict = {}
    complaint_tracking_id: str | None = None
    complaint_type: str | None = None
    complaint_severity: str | None = None
    complaint_location: str | None = None
    complaint_description: str | None = None
    created_at: datetime


class FieldAssignmentListResponse(BaseModel):
    items: list[FieldAssignmentResponse]


class DeploymentOrderCreateRequest(BaseModel):
    grievance_id: UUID
    personnel_ids: list[UUID] = Field(default_factory=list)
    auto_assign_nearest: bool = True
    required_personnel_count: int = Field(default=4, ge=1, le=25)
    field_brief: str = Field(..., min_length=10, max_length=2000)
    status: Literal["draft", "issued"] = "issued"


class DeploymentOrderResponse(BaseModel):
    id: UUID
    order_number: str
    grievance_id: UUID | None = None
    corridor: str
    zone: str
    priority: str
    status: str
    resource_recommendation: dict
    notification_payload: dict = {}
    deployment_latitude: float | None = None
    deployment_longitude: float | None = None
    field_brief: str | None = None
    assigned_personnel: list[PolicePersonnelResponse] = []
    created_at: datetime


class DeploymentOrderListResponse(BaseModel):
    items: list[DeploymentOrderResponse]


class CitizenGrievanceCreateRequest(BaseModel):
    reporter_name: str | None = Field(default=None, max_length=120)
    reporter_phone: str | None = Field(default=None, max_length=20)
    reporter_email: str | None = Field(default=None, max_length=255)
    complaint_type: Literal[
        "event_congestion",
        "illegal_parking",
        "road_closure",
        "accident_or_breakdown",
        "signal_failure",
        "other",
    ]
    severity: Literal["Low", "Medium", "High", "Critical"] | None = Field(
        default=None,
        description="If omitted, DRISHTI auto-infers severity from complaint type and description.",
    )
    location_text: str = Field(..., min_length=3, max_length=255)
    zone: str | None = Field(default=None, max_length=120)
    corridor: str | None = Field(default=None, max_length=120)
    latitude: float | None = None
    longitude: float | None = None
    description: str = Field(..., min_length=10, max_length=2000)


class CitizenGrievanceResponse(BaseModel):
    id: UUID
    tracking_id: str
    complaint_type: str
    severity: str
    location_text: str
    zone: str | None = None
    corridor: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    description: str
    status: str
    agent_priority_score: int | None = None
    agent_recommendation: str | None = None
    reporter_phone: str | None = None
    created_at: datetime


class CitizenGrievanceListResponse(BaseModel):
    items: list[CitizenGrievanceResponse]


class GrievanceStatusUpdateRequest(BaseModel):
    status: Literal["pending", "in_progress", "assigned", "pending_verification", "resolved", "closed"]
    notes: str | None = Field(default=None, max_length=500)


class DeploymentStatusUpdateRequest(BaseModel):
    status: Literal["draft", "issued", "enroute", "onscene", "resolved", "escalated", "cancelled"]
    notes: str | None = Field(default=None, max_length=500)


# ---------------------------------------------------------------------------
# Incident prediction (ML pipeline + LLM firewall)
# ---------------------------------------------------------------------------

class IncidentPredictionRequest(BaseModel):
    description:           str   = Field(..., min_length=10, max_length=2000)
    latitude:              float = Field(..., examples=[12.9716])
    longitude:             float = Field(..., examples=[77.5946])
    requires_road_closure: bool  = False
    event_cause:           str   = Field(default="others",       max_length=80)
    veh_type:              str   = Field(default="unknown",      max_length=80)
    corridor:              str   = Field(default="Non-corridor", max_length=120)
    police_station:        str   = Field(default="unknown",      max_length=120)
    zone:                  str   = Field(default="unknown",      max_length=120)


class IncidentFirewallResult(BaseModel):
    passed:        bool
    reason:        str
    incident_type: str | None = None


class IncidentPredictionResponse(BaseModel):
    status:                  Literal["OK", "REJECTED"]
    firewall:                IncidentFirewallResult
    estimated_duration_min:  float | None = None
    estimated_duration_hrs:  float | None = None
    priority:                str   | None = None
    personnel_to_deploy:     int   | None = None
    urgency:                 str   | None = None
    detected_cause:          str   | None = None
    detected_veh_type:       str   | None = None
