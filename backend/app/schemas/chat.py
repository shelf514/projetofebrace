from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000, description="Pergunta do usuário sobre aquarismo")
    especie: str | None = Field(default=None, max_length=32, description="Espécie consultada (ex.: betta, neon)")
    include_sensor_context: bool = Field(default=True, description="Incluir leitura atual dos sensores no contexto")
    conversation_id: str | None = Field(default=None, max_length=64)
    temperature: float | None = Field(default=None, description="Override temp para diagnóstico")
    turbidity: float | None = Field(default=None)
    tds: float | None = Field(default=None)


class ChatResponse(BaseModel):
    reply: str
    sources: list[str] = Field(default_factory=list)
    model_used: str = Field(description="regras | openai")
    especie: str | None = None
