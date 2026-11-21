"""Reporte de scouting del rival: presiones permitidas por la protección de pase."""
from functools import lru_cache
from pathlib import Path

import pandas as pd

DATOS = Path(__file__).resolve().parent.parent / "data" / "nfl-big-data-bowl-regional-event-data-main" / "data"

LINEA = ["LT", "LG", "C", "RG", "RT"]


def _grupo_posicion(pos: str) -> str:
    if pos in LINEA:
        return pos
    if pos.startswith("TE"):
        return "TE"
    if pos.startswith(("HB", "FB")):
        return "RB"
    return "WR"


def _situacion(down: int, ytg: int) -> str:
    if down == 1:
        return "1ª down"
    d = "2ª" if down == 2 else "3ª/4ª"
    if ytg <= 3:
        return f"{d} y corta (1-3)"
    if ytg <= 6:
        return f"{d} y media (4-6)"
    return f"{d} y larga (7+)"


ORDEN_SITUACION = [
    "1ª down",
    "2ª y corta (1-3)", "2ª y media (4-6)", "2ª y larga (7+)",
    "3ª/4ª y corta (1-3)", "3ª/4ª y media (4-6)", "3ª/4ª y larga (7+)",
]
ORDEN_POSICION = LINEA + ["TE", "RB", "WR"]


@lru_cache(maxsize=1)
def cargar():
    """Lee los CSV una sola vez y prepara las tablas base."""
    plays = pd.read_csv(DATOS / "plays.csv")
    pff = pd.read_csv(DATOS / "pffScoutingData.csv")

    # Presión por jugada: algún pass rusher logró hurry, hit o sack.
    rush = pff[pff["pff_role"] == "Pass Rush"].copy()
    rush["presion"] = rush[["pff_hurry", "pff_hit", "pff_sack"]].fillna(0).sum(axis=1) > 0
    presion = rush.groupby(["gameId", "playId"])["presion"].any().rename("presion")
    plays = plays.merge(presion, on=["gameId", "playId"], how="left")
    plays["presion"] = plays["presion"].fillna(False).astype(bool)
    plays["situacion"] = [_situacion(d, y) for d, y in zip(plays["down"], plays["yardsToGo"])]

    # Bloqueadores: cada fila es un jugador protegiendo en una jugada.
    bloq = pff[pff["pff_role"] == "Pass Block"].copy()
    bloq = bloq.merge(plays[["gameId", "playId", "possessionTeam"]], on=["gameId", "playId"])
    bloq["posicion"] = bloq["pff_positionLinedUp"].fillna("").map(_grupo_posicion)
    for c in ["pff_hurryAllowed", "pff_hitAllowed", "pff_sackAllowed"]:
        bloq[c] = bloq[c].fillna(0)
    bloq["presiones"] = bloq["pff_hurryAllowed"] + bloq["pff_hitAllowed"] + bloq["pff_sackAllowed"]
    return plays, bloq


def equipos() -> list[str]:
    plays, _ = cargar()
    return sorted(plays["possessionTeam"].unique().tolist())


def _tabla(df: pd.DataFrame, columna: str, orden: list[str]) -> list[dict]:
    g = df.groupby(columna)["presion"].agg(jugadas="size", tasa_presion="mean").reset_index()
    g[columna] = pd.Categorical(g[columna], categories=orden, ordered=True)
    g = g.sort_values(columna)
    return [
        {"situacion": str(getattr(r, columna)), "jugadas": int(r.jugadas), "tasa_presion": round(float(r.tasa_presion), 3)}
        for r in g.itertuples()
    ]


def reporte(equipo: str) -> dict | None:
    plays, bloq = cargar()
    jp = plays[plays["possessionTeam"] == equipo]
    if jp.empty:
        return None
    bq = bloq[bloq["possessionTeam"] == equipo]

    pos = bq.groupby("posicion").agg(
        snaps=("presiones", "size"),
        presiones=("presiones", "sum"),
        sacks=("pff_sackAllowed", "sum"),
    ).reset_index()
    pos["tasa"] = pos["presiones"] / pos["snaps"]
    pos["posicion"] = pd.Categorical(pos["posicion"], categories=ORDEN_POSICION, ordered=True)
    pos = pos.sort_values("posicion")

    forma = jp.groupby("offenseFormation")["presion"].agg(jugadas="size", tasa_presion="mean").reset_index()
    forma = forma[forma["jugadas"] >= 10].sort_values("jugadas", ascending=False)

    return {
        "equipo": equipo,
        "jugadas_pase": int(len(jp)),
        "tasa_presion": round(float(jp["presion"].mean()), 3),
        "tasa_presion_liga": round(float(plays["presion"].mean()), 3),
        "por_posicion": [
            {
                "posicion": str(r.posicion),
                "snaps": int(r.snaps),
                "presiones": int(r.presiones),
                "sacks": int(r.sacks),
                "tasa": round(float(r.tasa), 3),
            }
            for r in pos.itertuples()
        ],
        "por_situacion": _tabla(jp, "situacion", ORDEN_SITUACION),
        "por_formacion": [
            {"formacion": r.offenseFormation, "jugadas": int(r.jugadas), "tasa_presion": round(float(r.tasa_presion), 3)}
            for r in forma.itertuples()
        ],
    }

def resumen_basico(r: dict) -> str:
    """Resumen sin IA con las mismas cifras del reporte (respaldo si Nova falla)."""
    dif = r["tasa_presion"] - r["tasa_presion_liga"]
    lado = "por encima" if dif > 0 else "por debajo"
    lineas = [
        f"• Reciben presión en el {r['tasa_presion']:.1%} de sus pases, "
        f"{abs(dif) * 100:.1f} puntos {lado} del promedio de la liga ({r['tasa_presion_liga']:.1%})."
    ]
    pos = [p for p in r["por_posicion"] if p["posicion"] in LINEA and p["snaps"] >= 15]
    if pos:
        p = max(pos, key=lambda x: x["tasa"])
        lineas.append(
            f"• Punto débil de la protección: {p['posicion']}, con {p['presiones']} presiones "
            f"en {p['snaps']} snaps ({p['tasa']:.1%}). Cargar el pass rush por ese lado."
        )
    sit = [s for s in r["por_situacion"] if s["jugadas"] >= 15]
    if sit:
        s = max(sit, key=lambda x: x["tasa_presion"])
        lineas.append(
            f"• Situación con más presión: {s['situacion']}, {s['tasa_presion']:.1%} de sus pases "
            f"({s['jugadas']} jugadas). Buen momento para enviar blitz."
        )
    form = [f for f in r["por_formacion"] if f["jugadas"] >= 15]
    if form:
        f = max(form, key=lambda x: x["tasa_presion"])
        lineas.append(
            f"• Formación con más presión: {f['formacion']}, {f['tasa_presion']:.1%} en {f['jugadas']} jugadas."
        )
    return "\n".join(lineas)