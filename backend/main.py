"""API de la plantilla. Ejecuta: .venv/Scripts/uvicorn backend.main:app --reload"""
import json
import os
from pathlib import Path


def cargar_env():
    f = Path(__file__).resolve().parent.parent / ".env"
    if f.exists():
        for linea in f.read_text(encoding="utf-8-sig").splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


cargar_env()

from fastapi import FastAPI, HTTPException  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402
from strands import Agent  # noqa: E402
from strands.models import BedrockModel  # noqa: E402

from backend import rival  # noqa: E402

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-pro-v1:0")
REGION = os.environ.get("AWS_REGION", "us-east-1")

SISTEMA = (
    "Eres un analista de la NFL que ayuda a un equipo del hackathon NFL Big Data Bowl "
    "de la UNAM. Responde en español, de forma clara y breve."
)

SISTEMA_COACH = (
    "Eres analista de datos deportivos de futbol americano. Recibes un reporte en JSON con "
    "estadisticas de protección de pase de un equipo (semanas 1 a 8 de 2021). 'tasa' y "
    "'tasa_presion' son proporciones (0.25 = 25%). Escribe en español de 4 a 5 viñetas "
    "cortas para el cuerpo técnico del equipo que jugará contra ellos y prepara su plan "
    "defensivo. Cada viñeta describe una tendencia de su protección de pase y qué ajuste puede hacer "
    "nuestra defensa (por qué lado cargar el pass rush, en qué downs enviar blitz), con el "
    "número que la respalda. No des consejos para el equipo analizado. Usa solo los datos "
    "del JSON; no inventes jugadores ni cifras. Ignora grupos con menos de 15 jugadas o snaps."
)

FILTRO = "blocked by our content filters"

app = FastAPI(title="Hackathon NFL UNAM")


def nuevo_agente(sistema: str = SISTEMA) -> Agent:
    # Un agente por petición para no mezclar conversaciones entre usuarios.
    modelo = BedrockModel(
        model_id=MODEL_ID, region_name=REGION, temperature=0.3, max_tokens=800
    )
    return Agent(model=modelo, system_prompt=sistema, callback_handler=None)


def consultar_nova(sistema: str, texto: str, intentos: int = 3) -> str:
    """Llama a Nova; si el filtro de contenido bloquea la respuesta, reintenta."""
    for _ in range(intentos):
        try:
            respuesta = str(nuevo_agente(sistema)(texto)).strip()
        except Exception as e:  # la app debe seguir funcionando aunque la IA falle
            raise HTTPException(
                status_code=503, detail=f"La IA no está disponible: {type(e).__name__}"
            )
        if FILTRO not in respuesta:
            return respuesta
    raise HTTPException(status_code=503, detail="El filtro de contenido de Bedrock bloqueó la respuesta")


def obtener_reporte(equipo: str) -> dict:
    try:
        r = rival.reporte(equipo.upper())
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="No se encontraron los datos en data/")
    if r is None:
        raise HTTPException(status_code=404, detail=f"Equipo no encontrado: {equipo}")
    return r


class Pregunta(BaseModel):
    pregunta: str = Field(min_length=1, max_length=4000)


class Respuesta(BaseModel):
    respuesta: str
    modelo: str


class Resumen(BaseModel):
    resumen: str
    fuente: str = "nova"  # "nova" o "automatico"


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/equipos")
def listar_equipos() -> list[str]:
    try:
        return rival.equipos()
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="No se encontraron los datos en data/")


@app.get("/api/rival/{equipo}")
def reporte_rival(equipo: str) -> dict:
    return obtener_reporte(equipo)


@app.post("/api/rival/{equipo}/resumen", response_model=Resumen)
def resumen_rival(equipo: str) -> Resumen:
    """Nova redacta recomendaciones para el coach a partir del reporte ya calculado."""
    r = obtener_reporte(equipo)
    try:
        texto = consultar_nova(SISTEMA_COACH, json.dumps(r, ensure_ascii=False))
    except HTTPException:
        # Si Nova no responde, el coach recibe un resumen calculado con los mismos datos.
        return Resumen(resumen=rival.resumen_basico(r), fuente="automatico")
    return Resumen(resumen=texto)


@app.post("/api/ia/preguntar", response_model=Respuesta)
def preguntar(datos: Pregunta) -> Respuesta:
    """Envía una pregunta a Amazon Nova (Bedrock) y devuelve su respuesta."""
    return Respuesta(respuesta=consultar_nova(SISTEMA, datos.pregunta), modelo=MODEL_ID)