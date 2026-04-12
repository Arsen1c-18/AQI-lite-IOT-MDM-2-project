from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LatestDataResponse(BaseModel):
    aqi: Optional[int]
    raw_aqi: Optional[int]
    hybrid_aqi: Optional[int]
    category: Optional[str]
    main_pollutant: Optional[str]
    calibration_model: Optional[str]
    pm25: Optional[float]
    corrected_pm25: Optional[float]
    co2: Optional[float]
    temperature: Optional[float]
    humidity: Optional[float]
    timestamp: datetime


class DeviceInfoResponse(BaseModel):
    device_name: str
    last_seen: datetime
    status: str


class HistoricalDataPoint(BaseModel):
    timestamp: datetime
    final_aqi: Optional[int]
    raw_aqi: Optional[int]
    corrected_pm25: Optional[float]
    calibration_model: Optional[str]
    pm25: Optional[float]
    co2: Optional[float]
    temperature: Optional[float]
    humidity: Optional[float]
    category: Optional[str] = None
    main_pollutant: Optional[str] = None


class HistoricalDataResponse(BaseModel):
    data: list[HistoricalDataPoint]
