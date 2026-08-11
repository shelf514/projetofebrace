from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models import Device
from app.schemas.device import DeviceOut

router = APIRouter(prefix="/api/devices", tags=["devices"])

OFFLINE_AFTER_SECONDS = 300


def computed_status(device: Device) -> str:
    if device.last_seen is None:
        return "desconhecido"
    last = device.last_seen
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    delta = (datetime.now(timezone.utc) - last).total_seconds()
    if delta <= OFFLINE_AFTER_SECONDS:
        return "online"
    return "offline"


@router.get("", response_model=list[DeviceOut])
def list_devices(db: Session = Depends(get_db)) -> list[Device]:
    devices = db.query(Device).all()
    for device in devices:
        device.status = computed_status(device)
    return devices


@router.get("/{device_id}", response_model=DeviceOut)
def get_device(device_id: str, db: Session = Depends(get_db)) -> Device:
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Dispositivo nao encontrado")
    device.status = computed_status(device)
    return device
