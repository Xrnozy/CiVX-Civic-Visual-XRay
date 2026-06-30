from fastapi import APIRouter, Depends

from app.auth.firebase import AuthUser, get_current_user
from app.agents.driver_signal import DriverSignalAgent
from app.models.schemas import SensorEventCreate

router = APIRouter(prefix="/api/driver", tags=["driver"])


@router.post("/sensor-events")
def sensor_event(body: SensorEventCreate, user: AuthUser = Depends(get_current_user)):
    agent = DriverSignalAgent()
    return agent.process_sensor_event(
        route_session_id=body.route_session_id,
        latitude=body.latitude,
        longitude=body.longitude,
        magnitude=body.magnitude,
        event_type=body.event_type,
        timestamp=body.event_timestamp,
        video_chunk_id=body.video_chunk_id,
    )
