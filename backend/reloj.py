"""Reloj del mariscal: cuánto tiempo hay entre el snap, el lanzamiento y la llegada de los rushers.

Usa los archivos de tracking (10 cuadros por segundo). Todo se calcula en memoria:
- por jugada, a demanda (para animarla en la cancha);
- el resumen de todos los partidos, en un hilo de segundo plano al arrancar.
"""
import threading
from functools import lru_cache

import numpy as np
import pandas as pd

from . import datos as D

FPS = 10.0
UMBRAL_CONTACTO = 2.0   # yardas: un rusher a esta distancia del mariscal ya lo está presionando
ANCHO, ALTO = 120.0, 53.3
COLUMNAS = ["gameId", "playId", "nflId", "frameId", "team", "playDirection", "jerseyNumber", "x", "y", "s", "o", "event"]

SNAP = {"ball_snap", "autoevent_ballsnap"}
LANZAMIENTO = {"pass_forward", "autoevent_passforward"}
NOMBRE_EVENTO = {
    "ball_snap": "snap", "autoevent_ballsnap": "snap",
    "pass_forward": "lanzamiento", "autoevent_passforward": "lanzamiento",
    "qb_sack": "sack", "pass_arrived": "llega el balón", "pass_outcome_caught": "recepción",
    "pass_outcome_incomplete": "pase incompleto", "pass_outcome_interception": "intercepción",
    "play_action": "play action", "line_set": "línea lista", "man_in_motion": "hombre en movimiento",
    "fumble": "fumble", "run": "corre el mariscal",
}


@lru_cache(maxsize=4)
def _juego(game_id: int) -> pd.DataFrame:
    """Tracking de un partido, con el campo orientado para que la ofensiva siempre avance hacia la derecha."""
    ruta = D.DATOS / "tracking" / f"tracking_{int(game_id)}.csv"
    t = pd.read_csv(ruta, usecols=COLUMNAS)
    izq = t["playDirection"] == "left"
    t["x"] = np.where(izq, ANCHO - t["x"], t["x"])
    t["y"] = np.where(izq, ALTO - t["y"], t["y"])
    t["o"] = np.where(izq, (t["o"] + 180) % 360, t["o"])
    return t


@lru_cache(maxsize=1)
def _pff() -> pd.DataFrame:
    f = pd.read_csv(D.DATOS / "pffScoutingData.csv", usecols=["gameId", "playId", "nflId", "pff_role", "pff_positionLinedUp"])
    return f


def _primer_evento(t: pd.DataFrame, nombres: set) -> pd.Series:
    ev = t[t["event"].isin(nombres)]
    return ev.groupby("playId")["frameId"].min()


def resumen_juego(game_id: int, umbrales: tuple = (UMBRAL_CONTACTO,)) -> pd.DataFrame:
    """Una fila por jugada: segundos hasta el lanzamiento, hasta el sack y hasta que llega el primer rusher."""
    t = _juego(game_id)
    f = _pff()
    f = f[f["gameId"] == game_id]
    filas = t[t["nflId"].notna()].merge(f[["playId", "nflId", "pff_role"]], on=["playId", "nflId"], how="inner")

    snap = _primer_evento(t, SNAP)
    lanz = _primer_evento(t, LANZAMIENTO)
    sack = _primer_evento(t, {"qb_sack"})

    qb = filas[filas["pff_role"] == "Pass"][["playId", "frameId", "x", "y"]]
    rush = filas[filas["pff_role"] == "Pass Rush"][["playId", "frameId", "nflId", "x", "y"]]
    m = rush.merge(qb, on=["playId", "frameId"], suffixes=("_r", "_q"))
    m["d"] = np.hypot(m["x_r"] - m["x_q"], m["y_r"] - m["y_q"])
    dmin = m.groupby(["playId", "frameId"])["d"].min().reset_index()
    dmin = dmin.merge(snap.rename("snap"), left_on="playId", right_index=True)
    dmin = dmin[dmin["frameId"] >= dmin["snap"]]
    dmin["t"] = (dmin["frameId"] - dmin["snap"]) / FPS

    res = pd.DataFrame({"snap": snap})
    res["t_lanzamiento"] = ((lanz - snap) / FPS).reindex(res.index)
    res["t_sack"] = ((sack - snap) / FPS).reindex(res.index)
    for u in umbrales:
        res[f"t_contacto_{u:g}"] = dmin[dmin["d"] <= u].groupby("playId")["t"].min().reindex(res.index)
    # distancia del rusher más cercano en el instante del lanzamiento
    ult = dmin.merge(lanz.rename("lanz"), left_on="playId", right_index=True)
    ult = ult[ult["frameId"] == ult["lanz"]].groupby("playId")["d"].min()
    res["dist_al_lanzar"] = ult.reindex(res.index)
    res["gameId"] = game_id
    return res.reset_index().rename(columns={"index": "playId"})


# ---- Resumen de todos los partidos (segundo plano) ----
_estado = {"estado": "pendiente", "hechos": 0, "total": 0, "tabla": None, "error": None}
_candado = threading.Lock()


def _calcular_todo():
    try:
        ids = sorted(D.cargar().plays["gameId"].unique().tolist())
        with _candado:
            _estado.update(estado="calculando", total=len(ids), hechos=0, error=None)
        partes = []
        for gid in ids:
            ruta = D.DATOS / "tracking" / f"tracking_{int(gid)}.csv"
            if ruta.exists():
                partes.append(resumen_juego(int(gid), (1.5, 2.0, 3.0)))
                _juego.cache_clear()  # no guardar 122 partidos en memoria
            with _candado:
                _estado["hechos"] += 1
        tabla = pd.concat(partes, ignore_index=True) if partes else pd.DataFrame()
        p = D.cargar().plays[["gameId", "playId", "possessionTeam", "defensiveTeam", "passResult", "presion", "playResult"]]
        tabla = tabla.merge(p, on=["gameId", "playId"], how="inner")
        with _candado:
            _estado.update(estado="listo", tabla=tabla)
    except Exception as e:  # la app sigue funcionando sin esta vista
        with _candado:
            _estado.update(estado="error", error=f"{type(e).__name__}: {e}")


def iniciar_calculo():
    """Lanza el cálculo global en un hilo (una sola vez)."""
    with _candado:
        if _estado["estado"] != "pendiente":
            return
        _estado["estado"] = "calculando"
    threading.Thread(target=_calcular_todo, daemon=True, name="reloj-global").start()


def estado() -> dict:
    with _candado:
        return {k: _estado[k] for k in ("estado", "hechos", "total", "error")}


def tabla() -> pd.DataFrame | None:
    with _candado:
        return _estado["tabla"] if _estado["estado"] == "listo" else None


# ---- Estadísticas para la vista "Reloj" ----
CUBETAS = [(0, 2.0, "menos de 2.0 s"), (2.0, 2.5, "2.0 a 2.5 s"), (2.5, 3.0, "2.5 a 3.0 s"),
           (3.0, 3.5, "3.0 a 3.5 s"), (3.5, 99, "más de 3.5 s")]


def _mediana(s: pd.Series):
    s = s.dropna()
    return round(float(s.median()), 2) if len(s) else None


def curvas(equipo: str | None = None) -> dict | None:
    tb = tabla()
    if tb is None:
        return None
    base = tb[tb["passResult"].isin(["C", "I", "IN", "S"]) & tb["snap"].notna()].copy()
    liga = base
    if equipo:
        base = base[base["possessionTeam"] == equipo]
    col = f"t_contacto_{UMBRAL_CONTACTO:g}"
    base["t_res"] = base["t_lanzamiento"].fillna(base["t_sack"])

    rejilla = np.round(np.arange(0.5, 5.01, 0.25), 2)

    def cdf(s: pd.Series, total: int):
        s = s.dropna()
        return [round(float((s <= t).sum() / total), 4) if total else 0.0 for t in rejilla]

    def curva(df):
        n = len(df)
        return {
            "n": int(n),
            "balon_soltado": cdf(df["t_lanzamiento"], n),
            "rusher_cerca": cdf(df[col], n),
        }

    por_tiempo = []
    for lo, hi, nombre in CUBETAS:
        g = liga[(liga["t_lanzamiento"].fillna(liga["t_sack"]) >= lo) & (liga["t_lanzamiento"].fillna(liga["t_sack"]) < hi)]
        n = len(g)
        por_tiempo.append({
            "tramo": nombre, "n": int(n),
            "completo": round(float((g["passResult"] == "C").mean()), 4) if n else None,
            "sack": round(float((g["passResult"] == "S").mean()), 4) if n else None,
            "intercepcion": round(float((g["passResult"] == "IN").mean()), 4) if n else None,
            "presion": round(float(g["presion"].mean()), 4) if n else None,
        })

    # momento en que la mitad de las jugadas ya tiene un rusher cerca
    c_liga = cdf(liga[col], len(liga))
    t50 = next((float(t) for t, v in zip(rejilla, c_liga) if v >= 0.5), None)
    t25 = next((float(t) for t, v in zip(rejilla, c_liga) if v >= 0.25), None)

    return {
        "umbral_yardas": UMBRAL_CONTACTO,
        "tiempos": [float(x) for x in rejilla],
        "liga": curva(liga),
        "equipo": curva(base) if equipo else None,
        "por_tiempo": por_tiempo,
        "zonas": {"verde_hasta": t25, "amarilla_hasta": t50},
        "mediana_lanzamiento": {"liga": _mediana(liga["t_lanzamiento"]),
                                "equipo": _mediana(base["t_lanzamiento"]) if equipo else None},
        "mediana_rusher_cerca": {"liga": _mediana(liga[col]),
                                 "equipo": _mediana(base[col]) if equipo else None},
    }


# ---- Una jugada para la cancha interactiva ----
def _rol(pff_role: str) -> str:
    return {"Pass": "QB", "Pass Block": "Bloqueador", "Pass Rush": "Rusher",
            "Coverage": "Cobertura", "Pass Route": "Receptor"}.get(pff_role, "Otro")


def jugada(game_id: int, play_id: int) -> dict | None:
    d = D.cargar()
    fila = d.plays[(d.plays["gameId"] == game_id) & (d.plays["playId"] == play_id)]
    if fila.empty:
        return None
    fila = fila.iloc[0]
    t = _juego(game_id)
    t = t[t["playId"] == play_id]
    if t.empty:
        return None
    f = _pff()
    f = f[(f["gameId"] == game_id) & (f["playId"] == play_id)].set_index("nflId")

    frames_ids = sorted(t["frameId"].unique().tolist())
    snap_f = _primer_evento(t, SNAP)
    snap = int(snap_f.iloc[0]) if len(snap_f) else frames_ids[0]

    jug = t[t["nflId"].notna()].drop_duplicates("nflId")
    jugadores = []
    for r in jug.itertuples():
        nid = int(r.nflId)
        rol = _rol(f.loc[nid, "pff_role"]) if nid in f.index else "Otro"
        pos = f.loc[nid, "pff_positionLinedUp"] if nid in f.index else ""
        jugadores.append({
            "id": nid, "nombre": d.nombres.get(nid, str(nid)), "dorsal": None if pd.isna(r.jerseyNumber) else int(r.jerseyNumber),
            "pos": "" if pd.isna(pos) else str(pos), "rol": rol,
            "equipo": "ataque" if r.team == fila["possessionTeam"] else "defensa",
        })
    orden = {j["id"]: i for i, j in enumerate(jugadores)}

    puntos = t[t["nflId"].notna()].copy()
    puntos["i"] = puntos["nflId"].astype(int).map(orden)
    balon = t[t["nflId"].isna()].set_index("frameId")

    qb_id = next((j["id"] for j in jugadores if j["rol"] == "QB"), None)
    rush_ids = [j["id"] for j in jugadores if j["rol"] == "Rusher"]
    frames, reloj = [], []
    por_frame = {k: g for k, g in puntos.groupby("frameId")}
    dist_prev = []
    for fid in frames_ids:
        g = por_frame.get(fid)
        if g is None:
            continue
        pos = [None] * len(jugadores)
        for r in g.itertuples():
            pos[r.i] = [round(float(r.x), 2), round(float(r.y), 2), round(float(r.o), 0) if pd.notna(r.o) else None]
        b = balon.loc[fid] if fid in balon.index else None
        tt = round((fid - snap) / FPS, 2)
        frames.append({"t": tt, "p": pos, "balon": [round(float(b["x"]), 2), round(float(b["y"]), 2)] if b is not None else None})

        dmin, quien = None, None
        if qb_id is not None and pos[orden[qb_id]] is not None:
            qx, qy = pos[orden[qb_id]][0], pos[orden[qb_id]][1]
            for rid in rush_ids:
                p = pos[orden[rid]]
                if p is None:
                    continue
                dd = float(np.hypot(p[0] - qx, p[1] - qy))
                if dmin is None or dd < dmin:
                    dmin, quien = dd, rid
        dist_prev.append(dmin)
        cierre = None
        if len(dist_prev) >= 3 and dist_prev[-1] is not None and dist_prev[-3] is not None:
            cierre = (dist_prev[-3] - dist_prev[-1]) / (2 / FPS)  # yardas por segundo
        tti = None
        if dmin is not None and cierre is not None and cierre > 0.5:
            tti = max(0.0, (dmin - 1.0) / cierre)
        reloj.append({
            "t": tt, "dist": None if dmin is None else round(dmin, 2), "rusher": quien,
            "cierre": None if cierre is None else round(float(cierre), 2),
            "tti": None if tti is None else round(float(tti), 2),
        })

    eventos = []
    ev = t[t["event"].notna()].drop_duplicates(["frameId", "event"])
    vistos = set()
    for r in ev.itertuples():
        nombre = NOMBRE_EVENTO.get(r.event)
        if nombre is None or nombre in vistos:
            continue
        vistos.add(nombre)
        eventos.append({"t": round((r.frameId - snap) / FPS, 2), "evento": nombre})

    return {
        "gameId": int(game_id), "playId": int(play_id),
        "descripcion": str(fila["playDescription"]),
        "ataque": fila["possessionTeam"], "defensa": fila["defensiveTeam"],
        "down": int(fila["down"]), "distancia": int(fila["yardsToGo"]), "cuarto": int(fila["quarter"]),
        "resultado": str(fila["passResult"]), "yardas": int(fila["playResult"]),
        "hubo_presion": bool(fila["presion"]),
        "rushers": None if pd.isna(fila["rushers"]) else int(fila["rushers"]),
        "cobertura": None if pd.isna(fila["pff_passCoverage"]) else str(fila["pff_passCoverage"]),
        "jugadores": jugadores, "frames": frames, "eventos": eventos, "reloj": reloj,
        "campo": {"largo": ANCHO, "ancho": ALTO, "linea_scrimmage": _linea_scrimmage(frames, jugadores, snap, t)},
        "fps": FPS,
    }


def _linea_scrimmage(frames, jugadores, snap, t) -> float | None:
    """x del balón en el snap (donde empieza la jugada)."""
    for fr in frames:
        if fr["t"] == 0 and fr["balon"]:
            return fr["balon"][0]
    return None
