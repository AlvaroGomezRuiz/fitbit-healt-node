"""
Esquema Pydantic del JSON maestro biométrico.

Validación dura antes de escribir en Drive: bloquea mutaciones corruptas
generadas por alucinación del LLM. Si el JSON no cumple el esquema, se
rechaza la mutación y se registra en logs.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, NonNegativeFloat, NonNegativeInt


class Identidad(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: str
    fecha_nacimiento: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    edad_anos: NonNegativeInt
    sexo: Literal["M", "F"]
    altura_cm: NonNegativeFloat


class BiometriaActual(BaseModel):
    model_config = ConfigDict(extra="forbid")

    peso_kg: float = Field(gt=20, lt=300)
    fecha_ultimo_pesaje: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    imc: float = Field(gt=10, lt=60)
    body_fat_estimado_pct: float = Field(ge=3, le=60)
    masa_libre_grasa_kg: float = Field(gt=0, lt=200)
    tendencia_peso_7dias_kg: float = Field(ge=-5, le=5)


class Objetivo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tipo: Literal[
        "CUTTING_AGRESIVO",
        "CUTTING_SUAVE",
        "MANTENIMIENTO",
        "VOLUMEN_LIMPIO",
        "VOLUMEN_AGRESIVO",
    ]
    kcal_target: int = Field(gt=800, lt=6000)
    proteina_g: int = Field(gt=20, lt=500)
    grasa_g: int = Field(gt=10, lt=300)
    carbos_g: int = Field(ge=0, lt=800)
    creatina_g: int = Field(ge=0, le=20)
    agua_l: float = Field(gt=0, le=10)
    fecha_ultimo_recalculo: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class GuardarraIles(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hrv_baseline_7d: float | None = None
    peso_baseline_2sem: float | None = None
    ultimo_top_set_squat: float | None = None
    ultimo_top_set_press: float | None = None
    bandera_roja: bool = False
    motivo_bandera_roja: str | None = None
    ultimo_chequeo: str


class MemoriaCorta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sueno_h: list[float] = Field(default_factory=list, max_length=14)
    hrv_ms: list[float] = Field(default_factory=list, max_length=14)
    rpe_promedio: list[float] = Field(default_factory=list, max_length=14)
    adherencia_kcal_pct: list[float] = Field(default_factory=list, max_length=14)


class BiometriaMaestro(BaseModel):
    """Esquema raíz del JSON maestro (FILE_ID_MAESTRO en Drive)."""

    model_config = ConfigDict(extra="forbid")

    identidad: Identidad
    biometria_actual: BiometriaActual
    objetivo: Objetivo
    guardarrailes_activos: GuardarraIles
    memoria_corta_7dias: MemoriaCorta


def validar(payload: dict) -> BiometriaMaestro:
    """Valida un dict crudo contra el esquema. Lanza ValidationError si falla."""
    return BiometriaMaestro.model_validate(payload)
