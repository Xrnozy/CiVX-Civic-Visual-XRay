from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    latitude: float
    longitude: float
    description: str | None = None
    issue_type: str | None = None
    barangay: str | None = None
    photo_url: str | None = None
    photo_urls: list[str] = Field(default_factory=list)


class IncidentUpdate(BaseModel):
    status: str | None = None
    assigned_department_id: str | None = None
    primary_issue_type: str | None = None


class CleanupEventCreate(BaseModel):
    title: str
    description: str | None = None
    latitude: float
    longitude: float
    barangay: str | None = None
    scheduled_start: str
    scheduled_end: str
    max_volunteers: int = 50
    issue_or_incident_id: str | None = None
    banner_url: str | None = None


class CleanupEventBannerUpdate(BaseModel):
    banner_url: str


class VolunteerRegister(BaseModel):
    full_name: str
    phone_number: str | None = None
    barangay: str | None = None
    emergency_contact: str | None = None
    safety_agreement: bool = False


class AttendanceCheckIn(BaseModel):
    qr_code_id: str
    latitude: float
    longitude: float
    selfie_url: str | None = None


class AttendanceWebCheckIn(BaseModel):
    latitude: float
    longitude: float


class AttendanceRejectBody(BaseModel):
    reason: str | None = None


class EcoQuestTaskCreate(BaseModel):
    title: str
    description: str | None = None
    task_type: str
    latitude: float | None = None
    longitude: float | None = None
    barangay: str | None = None
    reward_type: str | None = None
    required_proof: dict | None = None


class EcoQuestTaskUpdate(BaseModel):
    status: str | None = None
    title: str | None = None
    description: str | None = None


class EcoQuestSubmit(BaseModel):
    before_photo_url: str | None = None
    after_photo_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class RouteSessionCreate(BaseModel):
    mode: str = "passive"
    device_id: str | None = None


class SensorEventCreate(BaseModel):
    route_session_id: str
    latitude: float
    longitude: float
    magnitude: float
    event_type: str
    event_timestamp: str
    video_chunk_id: str | None = None


class UserProfileUpdate(BaseModel):
    full_name: str | None = None
    phone_number: str | None = None
    barangay: str | None = None
    organization_name: str | None = None
    profile_photo_url: str | None = None
    organization_logo_url: str | None = None


class CompleteRegistration(BaseModel):
    account_type: str  # citizen | organizer | street_sweeper
    full_name: str
    phone_number: str
    barangay: str
    organization_name: str | None = None
    organization_logo_url: str | None = None
    profile_photo_url: str | None = None
    invite_token: str | None = None
    public_worker_type: str | None = None


class RegistrationInviteCreate(BaseModel):
    label: str | None = None
    barangay: str | None = None
    expires_in_days: int = Field(default=7, ge=1, le=90)


class SetUserRole(BaseModel):
    role: str


class PassiveWorkerSummary(BaseModel):
    total_sessions: int
    total_chunks: int
    total_detections: int
    active_session_id: str | None = None


class PassiveSessionListItem(BaseModel):
    id: str
    mode: str
    started_at: str
    ended_at: str | None = None
    route_status: str
    total_chunks: int


class PassiveSessionDetail(PassiveSessionListItem):
    device_id: str | None = None
    chunks_completed: int = 0
    chunks_pending: int = 0
    chunks_failed: int = 0


class PassiveDetectionItem(BaseModel):
    id: str
    detected_issue_type: str
    confidence: float
    severity_score: float | None = None
    matched_latitude: float | None = None
    matched_longitude: float | None = None
    created_at: str
    session_id: str


class AnalyzerBoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class AnalyzerDetection(BaseModel):
    issue_type: str
    confidence: float
    severity_score: float
    bounding_box: AnalyzerBoundingBox
    bounding_boxes: list[AnalyzerBoundingBox] = []
    raw_class: str
    model_answer: str | None = None
    frame_timestamp: float | None = None
    matched_latitude: float | None = None
    matched_longitude: float | None = None
    image_width: int | None = None
    image_height: int | None = None


class AnalyzerDuplicateHint(BaseModel):
    action: str
    duplicate_score: float
    incident_id: str | None = None
    reason: str


class AnalyzerImageResponse(BaseModel):
    detection: AnalyzerDetection
    duplicate_hint: AnalyzerDuplicateHint | None = None
    image_width: int
    image_height: int


class AnalyzerVideoResponse(BaseModel):
    detections: list[AnalyzerDetection]
    frames_analyzed: int
    frame_timestamps: list[float] = []
    sample_fps: float = 1.0
