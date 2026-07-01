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
    firebase_project_id: str = ""
    google_application_credentials: str = ""
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    yolo_model: str = "yolov8n.pt"
    yolo_confidence: float = 0.35
    ffmpeg_path: str = "ffmpeg"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    duplicate_merge_threshold: float = 0.75
    duplicate_radius_m: float = 25.0
    attendance_gps_radius_m: float = 100.0
    demo_lgu_auto_role: bool = True
    google_maps_api_key: str = ""

    @field_validator(
        "supabase_url",
        "supabase_service_key",
        "firebase_project_id",
        "google_application_credentials",
        "cors_origins",
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
