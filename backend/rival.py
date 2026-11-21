"""Reporte de scouting del rival: presiones permitidas por la protección de pase."""
import pandas as pd

from . import datos as D
from .estadistica import tasa

ORDEN_POSICION = D.ORDEN_POSICION
ORDEN_SITUACION = D.ORDEN_SITUACION
LINEA = D.LINEA


def equipos() -> list[str]:
    return D.equipos()


def _ordenar(df: pd.DataFrame, col: str, orden: list[str]) -> pd.DataFrame:
    df = df.copy()
    df[col] = pd.Categorical(df[col], categories=orden, ordered=True)
    return df.sort_values(col)


def reporte(equipo: str, f: D.Filtros = D.Filtros()) -> dict | None:
    d = D.cargar()
    if equipo not in set(d.plays["possessionTeam"]):
        return None

    liga_p = D.filtrar(d.plays, f)
    jp = liga_p[liga_p["possessionTeam"] == equipo]
    liga_b = D.restringir(d.bloq, liga_p)
    bq = liga_b[liga_b["possessionTeam"] == equipo]

    # Presión permitida por posición, con la tasa de la liga como referencia
    liga_pos = liga_b.groupby("posicion").agg(snaps=("presiones", "size"), pres=("presiones", "sum"))
    pos = bq.groupby("posicion").agg(
        snaps=("presiones", "size"), presiones=("presiones", "sum"), sacks=("pff_sackAllowed", "sum")
    ).reset_index()
    por_posicion = []
    for r in _ordenar(pos, "posicion", ORDEN_POSICION).itertuples():
        t = tasa(r.presiones, r.snaps)
        lp = liga_pos.loc[r.posicion] if r.posicion in liga_pos.index else None
        por_posicion.append({
            "posicion": str(r.posicion), "snaps": int(r.snaps), "presiones": int(r.presiones), "sacks": int(r.sacks),
            "tasa": round(float(r.presiones) / r.snaps, 3),
            "ic_bajo": t["ic_bajo"], "ic_alto": t["ic_alto"], "muestra": t["muestra"],
            "tasa_liga": None if lp is None else round(float(lp.pres) / float(lp.snaps), 3),
        })

    # Por situación (down y distancia)
    liga_sit = liga_p.groupby("situacion")["presion"].mean()
    sit = jp.groupby("situacion")["presion"].agg(jugadas="size", k="sum").reset_index()
    por_situacion = []
    for r in _ordenar(sit, "situacion", ORDEN_SITUACION).itertuples():
        t = tasa(r.k, r.jugadas)
        por_situacion.append({
            "situacion": str(r.situacion), "jugadas": int(r.jugadas), "tasa_presion": round(float(r.k) / r.jugadas, 3),
            "ic_bajo": t["ic_bajo"], "ic_alto": t["ic_alto"], "muestra": t["muestra"],
            "tasa_liga": round(float(liga_sit.get(r.situacion)), 3) if r.situacion in liga_sit.index else None,
        })

    # Por formación
    liga_for = liga_p.groupby("offenseFormation")["presion"].mean()
    forma = jp.groupby("offenseFormation")["presion"].agg(jugadas="size", k="sum").reset_index()
    forma = forma[forma["jugadas"] >= 10].sort_values("jugadas", ascending=False)
    por_formacion = []
    for r in forma.itertuples():
        t = tasa(r.k, r.jugadas)
        por_formacion.append({
            "formacion": r.offenseFormation, "jugadas": int(r.jugadas), "tasa_presion": round(float(r.k) / r.jugadas, 3),
            "ic_bajo": t["ic_bajo"], "ic_alto": t["ic_alto"], "muestra": t["muestra"],
            "tasa_liga": round(float(liga_for.get(r.offenseFormation)), 3) if r.offenseFormation in liga_for.index else None,
        })

    n = len(jp)
    return {
        "equipo": equipo,
        "filtros": f.como_dict(),
        "jugadas_pase": int(n),
        "tasa_presion": round(float(jp["presion"].mean()), 3) if n else 0.0,
        "tasa_presion_liga": round(float(liga_p["presion"].mean()), 3) if len(liga_p) else 0.0,
        "por_posicion": por_posicion,
        "por_situacion": por_situacion,
        "por_formacion": por_formacion,
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
