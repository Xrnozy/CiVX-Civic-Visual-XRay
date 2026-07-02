from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_REPO_ROOT = _BACKEND_ROOT.parent
_ENV_CANDIDATES = (
    _BACKEND_ROOT / ".env",
    _REPO_ROOT / "infra" / ".env",
    _REPO_ROOT / ".env",
)


def _existing_env_files() -> tuple[str, ...]:
    return tuple(str(p) for p in _ENV_CANDIDATES if p.is_file())


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_existing_env_files() or (str(_REPO_ROOT / "infra" / ".env"),),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_report_photos_bucket: str = "report-photos"
    supabase_event_photos_bucket: str = "event-photos"
    firebase_project_id: str = ""
    google_application_credentials: str = ""
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    yolo_model: str = "yolov8n.pt"
    yolo_confidence: float = 0.35
    locateanything_model: str = "nvidia/LocateAnything-3B"
    locateanything_device: str = "auto"
    locateanything_generation_mode: str = "fast"
    locateanything_max_new_tokens: int = 512
    locateanything_min_confidence: float = 0.35
    locateanything_video_generation_mode: str = "fast"
    locateanything_video_max_new_tokens: int = 128
    locateanything_video_sample_fps: float = 1.0
    locateanything_video_max_frames: int = 6
    passive_video_max_frames: int = 1
    passive_video_sample_fps: float = 1.0
    passive_video_max_side: int = 640
    passive_video_max_new_tokens: int = 96
    locateanything_video_max_side: int = 896
    locateanything_image_max_side: int = 1024
    locateanything_max_boxes_per_frame: int = 2
    locateanything_min_box_area_ratio: float = 0.003
    locateanything_max_sky_center_ratio: float = 0.40
    ffmpeg_path: str = "ffmpeg"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    duplicate_merge_threshold: float = 0.75
    duplicate_radius_m: float = 25.0
    attendance_gps_radius_m: float = 100.0
    demo_lgu_auto_role: bool = False
    mobile_demo_base_url: str = "https://civx.xrnozy.me/mobile"
    public_web_url: str = "http://localhost:5173"
    google_maps_api_key: str = ""

    # Passive pipeline (Redis + YOLO + LocateAnything)
    redis_url: str = "redis://127.0.0.1:6379/0"
    pipeline_storage_root: str = "storage"
    pipeline_session_ttl_minutes: int = 15
    pipeline_max_job_retries: int = 3
    queue_yolo_busy: int = 500
    queue_locate_busy: int = 100
    queue_yolo_overloaded: int = 2000
    queue_locate_overloaded: int = 300
    queue_sample_fps_normal: float = 2.0
    queue_sample_fps_busy: float = 1.0
    queue_sample_fps_overloaded: float = 0.5
    yolo_batch_normal: int = 16
    yolo_batch_busy: int = 32
    yolo_confidence_high: float = 0.85
    yolo_confidence_medium: float = 0.50
    trust_threshold_trusted: float = 0.75
    trust_threshold_semi: float = 0.45
    blur_laplacian_min: float = 80.0
    frame_hash_max_distance: int = 5
    pipeline_upload_evidence_to_supabase: bool = True

    @property
    def pipeline_storage_path(self) -> Path:
        root = Path(self.pipeline_storage_root)
        if root.is_absolute():
            return root
        return (_REPO_ROOT / root).resolve()

    @field_validator(
        "supabase_url",
        "supabase_service_key",
        "firebase_project_id",
        "google_application_credentials",
        "cors_origins",
        "public_web_url",
        mode="before",
    )
    @classmethod
    def strip_strings(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)

    @property
    def resolved_firebase_credentials(self) -> str:
        """Resolve service account path relative to infra/ when backend runs from backend/."""
        raw = self.google_application_credentials
        if not raw:
            return ""
        p = Path(raw)
        if p.is_file():
            return str(p.resolve())
        infra_candidate = _REPO_ROOT / "infra" / p.name
        if infra_candidate.is_file():
            return str(infra_candidate.resolve())
        if not p.is_absolute():
            from_cwd = Path.cwd() / p
            if from_cwd.is_file():
                return str(from_cwd.resolve())
        return raw


settings = Settings()
