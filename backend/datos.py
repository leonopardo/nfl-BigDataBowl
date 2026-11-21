"""Carga única de los CSV y columnas derivadas que usan todos los módulos."""
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

DATOS = Path(__file__).resolve().parent.parent / "data" / "nfl-big-data-bowl-regional-event-data-main" / "data"

LINEA = ["LT", "LG", "C", "RG", "RT"]
ORDEN_POSICION = LINEA + ["TE", "RB", "WR"]
ORDEN_SITUACION = [
    "1ª down",
    "2ª y corta (1-3)", "2ª y media (4-6)", "2ª y larga (7+)",
    "3ª/4ª y corta (1-3)", "3ª/4ª y media (4-6)", "3ª/4ª y larga (7+)",
]

TIPO_RUSHER = {
    "DRT": "Interior", "DLT": "Interior", "NT": "Interior", "NRT": "Interior", "NLT": "Interior",
    "LEO": "Borde", "REO": "Borde", "LE": "Borde", "RE": "Borde", "ROLB": "Borde", "LOLB": "Borde",
    "RILB": "Linebacker", "LILB": "Linebacker", "LLB": "Linebacker", "RLB": "Linebacker", "MLB": "Linebacker",
}


def grupo_posicion(pos: str) -> str:
    if pos in LINEA:
        return pos
    if pos.startswith("TE"):
        return "TE"
    if pos.startswith(("HB", "FB")):
        return "RB"
    return "WR"


def tipo_rusher(pos: str) -> str:
    return TIPO_RUSHER.get(pos, "Secundaria")


def banda_distancia(ytg: int) -> str:
    return "corta" if ytg <= 3 else "media" if ytg <= 6 else "larga"


def situacion(down: int, ytg: int) -> str:
    if down == 1:
        return "1ª down"
    d = "2ª" if down == 2 else "3ª/4ª"
    b = banda_distancia(ytg)
    rango = {"corta": "corta (1-3)", "media": "media (4-6)", "larga": "larga (7+)"}[b]
    return f"{d} y {rango}"


@dataclass
class Datos:
    plays: pd.DataFrame   # una fila por jugada de pase, con columnas derivadas
    bloq: pd.DataFrame    # una fila por bloqueador y jugada
    rush: pd.DataFrame    # una fila por pass rusher y jugada
    nombres: dict         # nflId -> nombre
    posiciones: dict      # nflId -> posición oficial


@lru_cache(maxsize=1)
def cargar() -> Datos:
    plays = pd.read_csv(DATOS / "plays.csv")
    pff = pd.read_csv(DATOS / "pffScoutingData.csv")
    jug = pd.read_csv(DATOS / "players.csv")
    juegos = pd.read_csv(DATOS / "games.csv")

    llave = ["gameId", "playId"]
    for c in ["pff_hurry", "pff_hit", "pff_sack", "pff_hurryAllowed", "pff_hitAllowed", "pff_sackAllowed"]:
        pff[c] = pff[c].fillna(0).astype(float)

    # Pass rushers
    rush = pff[pff["pff_role"] == "Pass Rush"].copy()
    rush["presiones"] = rush["pff_hurry"] + rush["pff_hit"] + rush["pff_sack"]
    rush["presion"] = rush["presiones"] > 0
    rush["tipo"] = rush["pff_positionLinedUp"].fillna("").map(tipo_rusher)
    por_jugada = rush.groupby(llave).agg(rushers=("nflId", "size"), presion=("presion", "any")).reset_index()

    # Jugadas
    plays = plays.merge(por_jugada, on=llave, how="left")
    plays["presion"] = plays["presion"].eq(True)
    plays = plays.merge(juegos[["gameId", "homeTeamAbbr"]], on="gameId", how="left")
    local = plays["possessionTeam"] == plays["homeTeamAbbr"]
    plays["margen"] = np.where(
        local,
        plays["preSnapHomeScore"] - plays["preSnapVisitorScore"],
        plays["preSnapVisitorScore"] - plays["preSnapHomeScore"],
    )
    plays["marcador"] = np.where(plays["margen"] > 0, "ganando", np.where(plays["margen"] < 0, "perdiendo", "empatado"))
    plays["down_g"] = plays["down"].clip(upper=3).astype(int)
    plays["dist_g"] = plays["yardsToGo"].astype(int).map(banda_distancia)
    plays["situacion"] = [situacion(int(d), int(y)) for d, y in zip(plays["down"], plays["yardsToGo"])]
    plays["completo"] = plays["passResult"] == "C"
    plays["sack"] = plays["passResult"] == "S"
    plays["intercepcion"] = plays["passResult"] == "IN"
    plays["rushers"] = plays["rushers"].astype("float")

    # Bloqueadores
    bloq = pff[pff["pff_role"] == "Pass Block"].copy()
    bloq = bloq.merge(plays[llave + ["possessionTeam"]], on=llave)
    bloq["posicion"] = bloq["pff_positionLinedUp"].fillna("").map(grupo_posicion)
    bloq["presiones"] = bloq["pff_hurryAllowed"] + bloq["pff_hitAllowed"] + bloq["pff_sackAllowed"]

    rush = rush.merge(plays[llave + ["defensiveTeam"]], on=llave)

    nombres = dict(zip(jug["nflId"], jug["displayName"]))
    posiciones = dict(zip(jug["nflId"], jug["officialPosition"]))
    return Datos(plays=plays, bloq=bloq, rush=rush, nombres=nombres, posiciones=posiciones)


@dataclass(frozen=True)
class Filtros:
    down: int | None = None          # 1, 2 o 3 (3 incluye 4ª)
    distancia: str | None = None     # corta, media, larga
    cuarto: int | None = None        # 1 a 5 (5 = tiempo extra)
    marcador: str | None = None      # ganando, empatado, perdiendo (del equipo con el balón)
    formacion: str | None = None

    def como_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if v is not None}


def filtrar(plays: pd.DataFrame, f: Filtros) -> pd.DataFrame:
    m = pd.Series(True, index=plays.index)
    if f.down is not None:
        m &= plays["down_g"] == f.down
    if f.distancia is not None:
        m &= plays["dist_g"] == f.distancia
    if f.cuarto is not None:
        m &= plays["quarter"] == f.cuarto
    if f.marcador is not None:
        m &= plays["marcador"] == f.marcador
    if f.formacion is not None:
        m &= plays["offenseFormation"] == f.formacion
    return plays[m]


def restringir(df: pd.DataFrame, plays_filtradas: pd.DataFrame) -> pd.DataFrame:
    """Deja solo las filas de df que pertenecen a las jugadas ya filtradas."""
    llaves = plays_filtradas[["gameId", "playId"]].drop_duplicates()
    return df.merge(llaves, on=["gameId", "playId"], how="inner")


def equipos() -> list[str]:
    return sorted(cargar().plays["possessionTeam"].unique().tolist())
