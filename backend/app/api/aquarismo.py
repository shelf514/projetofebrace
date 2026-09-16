from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services import aquarismo_service

router = APIRouter(prefix="/api/aquarismo", tags=["aquarismo"])


class EspecieResumo(BaseModel):
    especie: str
    nome: str
    ph_min: float
    ph_max: float
    temp_min: float
    temp_max: float
    tds_max: float
    volume_min_l: Optional[int] = None
    dificuldade: Optional[str] = None


class RecomendarRequest(BaseModel):
    especie: str = Field(min_length=1, max_length=32, description="Espécie alvo (ex.: betta)")
    volume_l: Optional[float] = Field(default=None, ge=1, le=10000, description="Volume do aquário em litros")
    companheiros: Optional[List[str]] = Field(default=None, max_length=10, description="Espécies já no aquário / pretendidas")
    temperature: Optional[float] = Field(default=None, description="Temp atual para diagnóstico")
    tds: Optional[float] = Field(default=None)
    ph: Optional[float] = Field(default=None, ge=0, le=14)
    turbidity: Optional[float] = Field(default=None, ge=0)


@router.get("/especies", response_model=dict)
def list_especies():
    data = aquarismo_service._load()
    resumo = [
        {
            "especie": f["especie"],
            "nome": f["nome"],
            "ph_min": f["ph_min"],
            "ph_max": f["ph_max"],
            "temp_min": f["temp_min"],
            "temp_max": f["temp_max"],
            "tds_max": f["tds_max"],
            "volume_min_l": f.get("volume_min_l"),
            "dificuldade": f.get("dificuldade"),
        }
        for f in data
    ]
    return {"especies": resumo, "total": len(resumo)}


@router.get("/especies/{especie}", response_model=dict)
def get_especie(especie: str):
    fish = aquarismo_service.get_fish(especie)
    if not fish:
        raise HTTPException(status_code=404, detail=f"Espécie '{especie}' não encontrada. Tente: {', '.join(aquarismo_service.list_especies())}")
    return fish


@router.get("/compatibilidade", response_model=dict)
def compatibilidade(
    especie_a: str = Query(..., description="Espécie A"),
    especie_b: str = Query(..., description="Espécie B"),
):
    result = aquarismo_service.check_compatibilidade(especie_a, especie_b)
    if result.get("compativel") is None and "não encontrada" in result.get("motivo", ""):
        raise HTTPException(status_code=404, detail=result["motivo"])
    return result


@router.post("/recomendar", response_model=dict)
def recomendar(payload: RecomendarRequest):
    result = aquarismo_service.recomendar(
        especie=payload.especie,
        volume_l=payload.volume_l,
        companheiros=payload.companheiros,
        temperature=payload.temperature,
        tds=payload.tds,
        ph=payload.ph,
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    # inclui diagnóstico de turbidez se fornecida
    if payload.turbidity is not None:
        diag = aquarismo_service.diagnose(payload.temperature, payload.turbidity, payload.tds, payload.especie, ph=payload.ph)
        result["diagnostico_turbidez"] = diag
    return result
