from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    latitude: float
    longitude: float
    description: str | None = None
    issue_type: str | None = None
    barangay: str | None = None
    photo_url: str | None = None


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


class EcoQuestTaskCreate(BaseModel):
    title: str
    description: str | None = None
    task_type: str
    latitude: float | None = None
    longitude: float | None = None
    barangay: str | None = None
    reward_type: str | None = None
    required_proof: dict | None = None


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
