from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    temperature: float = Field(allow_inf_nan=False)
    turbidity: float = Field(ge=0, allow_inf_nan=False)
    tds: float = Field(ge=0, allow_inf_nan=False)
    device_id: str | None = Field(default=None, description="Usado para a deteccao de anomalia por dispositivo")


class PredictResponse(BaseModel):
    prediction: str | None
    prediction_probability: float | None
    anomaly: bool
    model_loaded: bool


class TrainRequest(BaseModel):
    dataset: str
    target: str | None = None
    test_size: float = Field(default=0.2, gt=0, lt=1)
