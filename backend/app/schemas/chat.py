from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000, description="Pergunta do usuário sobre aquarismo")
    especie: str | None = Field(default=None, max_length=32, description="Espécie consultada (ex.: betta, neon)")
    include_sensor_context: bool = Field(default=True, description="Incluir leitura atual dos sensores no contexto")
    conversation_id: str | None = Field(default=None, max_length=64, description="ID para memória multi-turno (opcional)")
    temperature: float | None = Field(default=None, description="Override temp para diagnóstico")
    turbidity: float | None = Field(default=None)
    tds: float | None = Field(default=None)
    ph: float | None = Field(default=None, ge=0, le=14, description="pH manual (sem sensor)")
    gh: float | None = Field(default=None, ge=0, le=50, description="GH manual")
    volume_l: float | None = Field(default=None, ge=1, le=10000, description="Volume do aquário em litros")
    companheiros: list[str] | None = Field(default=None, max_length=10, description="Espécies companheiras para checar compatibilidade")


class ChatResponse(BaseModel):
    reply: str
    sources: list[str] = Field(default_factory=list)
    model_used: str = Field(description="regras | openai")
    especie: str | None = None
    conversation_id: str | None = None


class ChatHistoryResponse(BaseModel):
    conversation_id: str
    messages: list[dict]
    count: int
