"""API del plan de juego. Ejecuta: .venv/bin/uvicorn backend.main:app --reload"""
import json
import os
from contextlib import asynccontextmanager
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

from fastapi import Depends, FastAPI, HTTPException, Query  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402
from strands import Agent, tool  # noqa: E402
from strands.models import BedrockModel  # noqa: E402

from backend import analisis, datos as D, reloj, rival  # noqa: E402

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

SISTEMA_PLAN = (
    "Eres analista de datos deportivos de futbol americano y escribes para un entrenador que no es experto "
    "en estadística. Recibes un JSON con el enfrentamiento entre una defensa y la línea ofensiva de un rival "
    "(semanas 1 a 8 de 2021): presión esperada, situaciones, eslabones débiles, mejores rushers y si conviene "
    "el blitz. Las tasas son proporciones (0.25 = 25 %). Escribe en español un plan de juego de 5 viñetas cortas "
    "y concretas para NUESTRA defensa. Cada viñeta lleva la cifra que la respalda. Usa solo los datos del JSON; "
    "no inventes jugadores ni cifras, y evita jerga. Si un grupo tiene pocas jugadas, dilo."
)

SISTEMA_ANALISTA = (
    "Eres un analista de datos de la NFL (semanas 1 a 8 de 2021). Responde en español, simple y breve, "
    "SOLO con cifras que obtengas de tus herramientas; si no puedes obtenerlas, dilo. Las tasas son "
    "proporciones (0.25 = 25 %). No inventes jugadores ni números."
)

FILTRO = "blocked by our content filters"


@asynccontextmanager
async def vida(_: FastAPI):
    # Los datos ligeros se cargan al arrancar; el resumen del tracking se calcula en segundo plano.
    try:
        D.cargar()
        reloj.iniciar_calculo()
    except FileNotFoundError:
        pass  # la API responde 503 con un mensaje claro si faltan los datos
    yield


app = FastAPI(title="Plan de juego NFL", lifespan=vida)


def nuevo_agente(sistema: str = SISTEMA, herramientas: list | None = None) -> Agent:
    # Un agente por petición para no mezclar conversaciones entre usuarios.
    modelo = BedrockModel(
        model_id=MODEL_ID, region_name=REGION, temperature=0.3, max_tokens=800
    )
    return Agent(model=modelo, system_prompt=sistema, tools=herramientas or [], callback_handler=None)


def consultar_nova(sistema: str, texto: str, intentos: int = 3, herramientas: list | None = None) -> str:
    """Llama a Nova; si el filtro de contenido bloquea la respuesta, reintenta."""
    for _ in range(intentos):
        try:
            respuesta = str(nuevo_agente(sistema, herramientas)(texto)).strip()
        except Exception as e:  # la app debe seguir funcionando aunque la IA falle
            raise HTTPException(
                status_code=503, detail=f"La IA no está disponible: {type(e).__name__}"
            )
        if FILTRO not in respuesta:
            return respuesta
    raise HTTPException(status_code=503, detail="El filtro de contenido de Bedrock bloqueó la respuesta")


# ----------------------------------------------------------------- utilidades de la API
def filtros(
    down: int | None = Query(None, ge=1, le=3, description="1, 2 o 3 (3 incluye 4ª)"),
    distancia: str | None = Query(None, pattern="^(corta|media|larga)$"),
    cuarto: int | None = Query(None, ge=1, le=5),
    marcador: str | None = Query(None, pattern="^(ganando|empatado|perdiendo)$"),
    formacion: str | None = Query(None, max_length=30),
) -> D.Filtros:
    return D.Filtros(down=down, distancia=distancia, cuarto=cuarto, marcador=marcador, formacion=formacion)


def datos_o_503():
    try:
        return D.cargar()
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="No se encontraron los datos en data/")


def equipo_valido(equipo: str, lado: str = "possessionTeam") -> str:
    d = datos_o_503()
    e = equipo.upper()
    if e not in set(d.plays[lado]):
        raise HTTPException(status_code=404, detail=f"Equipo no encontrado: {equipo}")
    return e


def obtener_reporte(equipo: str, f: D.Filtros = D.Filtros()) -> dict:
    e = equipo_valido(equipo)
    r = rival.reporte(e, f)
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


class PlanEntrada(BaseModel):
    ataque: str = Field(min_length=2, max_length=4, description="Equipo rival (su línea ofensiva)")
    defensa: str = Field(min_length=2, max_length=4, description="Nuestra defensa")


# ----------------------------------------------------------------- endpoints
@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/equipos")
def listar_equipos() -> list[str]:
    datos_o_503()
    return rival.equipos()


@app.get("/api/rival/{equipo}")
def reporte_rival(equipo: str, f: D.Filtros = Depends(filtros)) -> dict:
    return obtener_reporte(equipo, f)


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


@app.get("/api/costo-presion")
def costo_presion(equipo: str | None = None, f: D.Filtros = Depends(filtros)) -> dict:
    e = equipo_valido(equipo) if equipo else None
    return analisis.costo_presion(e, f)


@app.get("/api/blitz")
def blitz(defensa: str | None = None, f: D.Filtros = Depends(filtros)) -> dict:
    e = equipo_valido(defensa, "defensiveTeam") if defensa else None
    return analisis.blitz(e, f)


@app.get("/api/jugadores/{equipo}")
def jugadores(equipo: str, min_snaps: int = Query(30, ge=1, le=500), f: D.Filtros = Depends(filtros)) -> dict:
    e = equipo_valido(equipo)
    return analisis.jugadores(e, f, min_snaps)


@app.get("/api/duelos/{equipo}")
def duelos(equipo: str, f: D.Filtros = Depends(filtros)) -> dict:
    e = equipo_valido(equipo)
    return analisis.duelos(e, f)


@app.get("/api/cara-a-cara")
def cara_a_cara(ataque: str, defensa: str, f: D.Filtros = Depends(filtros)) -> dict:
    a = equipo_valido(ataque)
    de = equipo_valido(defensa, "defensiveTeam")
    return analisis.cara_a_cara(a, de, f)


# ---- Tracking: cancha y reloj
@app.get("/api/jugadas/{equipo}")
def lista_jugadas(equipo: str, tipo: str = Query("presion", pattern="^(presion|sack|limpia)$"),
                  limite: int = Query(24, ge=1, le=100)) -> list[dict]:
    """Jugadas del equipo (en ataque) para reproducir en la cancha."""
    e = equipo_valido(equipo)
    p = D.cargar().plays
    p = p[(p["possessionTeam"] == e) & p["passResult"].isin(["C", "I", "S", "IN"])]
    if tipo == "sack":
        p = p[p["sack"]]
    elif tipo == "presion":
        p = p[p["presion"] & ~p["sack"]]
    else:
        p = p[~p["presion"]]
    p = p[[(D.DATOS / "tracking" / f"tracking_{int(g)}.csv").exists() for g in p["gameId"]]]
    out = []
    for r in p.head(limite).itertuples():
        out.append({"gameId": int(r.gameId), "playId": int(r.playId), "down": int(r.down), "distancia": int(r.yardsToGo),
                    "cuarto": int(r.quarter), "resultado": r.passResult, "yardas": int(r.playResult),
                    "presion": bool(r.presion), "descripcion": str(r.playDescription)})
    return out


@app.get("/api/jugada/{game_id}/{play_id}")
def una_jugada(game_id: int, play_id: int) -> dict:
    datos_o_503()
    try:
        j = reloj.jugada(game_id, play_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="No hay tracking para ese partido")
    if j is None:
        raise HTTPException(status_code=404, detail="Jugada no encontrada")
    return j


@app.get("/api/reloj/estado")
def reloj_estado() -> dict:
    return reloj.estado()


@app.get("/api/reloj")
def reloj_curvas(equipo: str | None = None) -> dict:
    e = equipo_valido(equipo) if equipo else None
    c = reloj.curvas(e)
    if c is None:
        raise HTTPException(status_code=503, detail="El reloj todavía se está calculando")
    return c


# ---- IA (opcional: la app funciona sin ella)
@app.post("/api/plan", response_model=Resumen)
def plan(datos: PlanEntrada) -> Resumen:
    """Plan de juego: nuestra defensa contra la línea de un rival."""
    a = equipo_valido(datos.ataque)
    de = equipo_valido(datos.defensa, "defensiveTeam")
    f = D.Filtros()
    cc = analisis.cara_a_cara(a, de, f)
    bl = analisis.blitz(de, f)
    paquete = {"cara_a_cara": cc, "blitz_de_nuestra_defensa": {k: bl[k] for k in ("frecuencia_blitz", "frecuencia_blitz_liga", "por_situacion")}}
    try:
        texto = consultar_nova(SISTEMA_PLAN, json.dumps(paquete, ensure_ascii=False))
    except HTTPException:
        return Resumen(resumen=analisis.plan_basico(cc, bl), fuente="automatico")
    return Resumen(resumen=texto)


@tool
def tool_reporte_equipo(equipo: str) -> str:
    """Presión que permite la línea ofensiva de un equipo (siglas, p. ej. KC): tasa general, por posición y por situación."""
    r = rival.reporte(equipo.upper())
    return json.dumps(r, ensure_ascii=False) if r else "Equipo no encontrado"


@tool
def tool_costo_presion() -> str:
    """Cuánto cambian los pases completos y las yardas cuando hay presión (toda la liga)."""
    return json.dumps(analisis.costo_presion(None, D.Filtros()), ensure_ascii=False)


@tool
def tool_blitz(defensa: str = "") -> str:
    """Efecto de mandar 4, 5, 6 o más rushers. Con siglas de equipo, solo esa defensa."""
    return json.dumps(analisis.blitz(defensa.upper() or None, D.Filtros()), ensure_ascii=False)


@tool
def tool_jugadores(equipo: str) -> str:
    """Bloqueadores y rushers de un equipo con su tasa de presión."""
    r = analisis.jugadores(equipo.upper(), D.Filtros(), 40)
    return json.dumps(r, ensure_ascii=False) if r else "Equipo no encontrado"


@app.post("/api/analista", response_model=Respuesta)
def analista(datos: Pregunta) -> Respuesta:
    """Pregunta libre: Nova consulta funciones sobre los datos en lugar de inventar cifras."""
    herramientas = [tool_reporte_equipo, tool_costo_presion, tool_blitz, tool_jugadores]
    return Respuesta(respuesta=consultar_nova(SISTEMA_ANALISTA, datos.pregunta, herramientas=herramientas), modelo=MODEL_ID)


@app.post("/api/ia/preguntar", response_model=Respuesta)
def preguntar(datos: Pregunta) -> Respuesta:
    """Envía una pregunta a Amazon Nova (Bedrock) y devuelve su respuesta."""
    return Respuesta(respuesta=consultar_nova(SISTEMA, datos.pregunta), modelo=MODEL_ID)
