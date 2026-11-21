"""Análisis de decisiones: costo de la presión, blitz, jugadores, duelos y cara a cara."""
import pandas as pd

from . import datos as D
from .estadistica import encogida, log5, tasa

# Umbrales del veredicto sobre el blitz (descriptivo, no causal)
GANANCIA_YARDAS = -0.7   # el blitz "paga" si baja al menos 0.7 yardas por jugada
EMPEORA_YARDAS = 0.3     # "no conviene" si sube las yardas permitidas


def _equipo_en(df: pd.DataFrame, col: str, equipo: str | None) -> pd.DataFrame:
    return df if not equipo else df[df[col] == equipo]


def _metricas(df: pd.DataFrame) -> dict:
    n = len(df)
    if n == 0:
        return {"n": 0, "completo": None, "yardas": None, "sack": None, "intercepcion": None, "presion": None}
    return {
        "n": int(n),
        "completo": tasa(df["completo"].sum(), n),
        "yardas": round(float(df["playResult"].mean()), 2),
        "sack": tasa(df["sack"].sum(), n),
        "intercepcion": tasa(df["intercepcion"].sum(), n),
        "presion": tasa(df["presion"].sum(), n),
    }


def _plano(m: dict) -> dict:
    """Versión corta de las métricas para tablas: solo los números."""
    if m["n"] == 0:
        return m
    return {
        "n": m["n"], "yardas": m["yardas"],
        "completo": m["completo"]["tasa"], "sack": m["sack"]["tasa"],
        "intercepcion": m["intercepcion"]["tasa"], "presion": m["presion"]["tasa"],
        "completo_ic": [m["completo"]["ic_bajo"], m["completo"]["ic_alto"]],
    }


# ---------------------------------------------------------------- Costo de la presión
def costo_presion(equipo: str | None, f: D.Filtros) -> dict:
    d = D.cargar()
    liga = D.filtrar(d.plays, f)
    base = _equipo_en(liga, "possessionTeam", equipo)

    con, sin = base[base["presion"]], base[~base["presion"]]
    ns = base[~base["sack"]]
    con_ns, sin_ns = ns[ns["presion"]], ns[~ns["presion"]]

    m_con, m_sin = _metricas(con), _metricas(sin)
    dif = None
    if m_con["n"] and m_sin["n"]:
        dif = {
            "yardas": round(m_sin["yardas"] - m_con["yardas"], 2),
            "completo": round(m_sin["completo"]["tasa"] - m_con["completo"]["tasa"], 4),
        }
    mc, ms = _metricas(con_ns), _metricas(sin_ns)
    dif_ns = None
    if mc["n"] and ms["n"]:
        dif_ns = {
            "yardas": round(ms["yardas"] - mc["yardas"], 2),
            "completo": round(ms["completo"]["tasa"] - mc["completo"]["tasa"], 4),
        }

    por_sit = []
    for s in D.ORDEN_SITUACION:
        g = base[base["situacion"] == s]
        c, sn = _metricas(g[g["presion"]]), _metricas(g[~g["presion"]])
        por_sit.append({"situacion": s, "n": int(len(g)), "con_presion": _plano(c), "sin_presion": _plano(sn)})

    texto = None
    if dif and dif_ns:
        texto = (
            f"Cuando hay presión se ganan {m_con['yardas']:.1f} yardas por pase; sin presión, {m_sin['yardas']:.1f}. "
            f"Sin contar los sacks, la diferencia sigue siendo de {dif_ns['yardas']:.1f} yardas y de "
            f"{dif_ns['completo'] * 100:.0f} puntos de pases completos."
        )
    return {
        "equipo": equipo, "filtros": f.como_dict(), "jugadas": int(len(base)),
        "con_presion": m_con, "sin_presion": m_sin, "diferencia": dif,
        "sin_sacks": {"con_presion": mc, "sin_presion": ms, "diferencia": dif_ns},
        "por_situacion": por_sit, "texto": texto,
        "nota": "La presión incluye los sacks por definición; por eso se muestra también el cálculo sin sacks. "
                "Es una asociación, no una causa: el mariscal también suelta antes cuando siente presión.",
    }


# ---------------------------------------------------------------- Blitz
BINS = [(0, 3, "3 o menos"), (4, 4, "4"), (5, 5, "5"), (6, 6, "6"), (7, 99, "7 o más")]


def _veredicto(a: dict, b: dict) -> dict:
    """a = 4 rushers, b = 5 o más. Compara presión y yardas permitidas."""
    if a["n"] < 20 or b["n"] < 20:
        return {"texto": "Pocas jugadas para decidir", "codigo": "pocas"}
    dy = b["yardas"] - a["yardas"]
    dp = b["presion"] - a["presion"]
    if dy <= GANANCIA_YARDAS and dp > 0:
        return {"texto": "Sí vale la pena", "codigo": "si", "dy": round(dy, 2), "dp": round(dp, 3)}
    if dy >= EMPEORA_YARDAS:
        return {"texto": "No conviene", "codigo": "no", "dy": round(dy, 2), "dp": round(dp, 3)}
    return {"texto": "Poca diferencia", "codigo": "igual", "dy": round(dy, 2), "dp": round(dp, 3)}


def blitz(defensa: str | None, f: D.Filtros) -> dict:
    d = D.cargar()
    liga = D.filtrar(d.plays, f)
    liga = liga[liga["rushers"].notna()]
    base = _equipo_en(liga, "defensiveTeam", defensa)

    por_rushers = []
    for lo, hi, nombre in BINS:
        g = base[(base["rushers"] >= lo) & (base["rushers"] <= hi)]
        m = _metricas(g)
        por_rushers.append({"rushers": nombre, "n": m["n"], **({} if m["n"] == 0 else {
            "presion": m["presion"], "sack": m["sack"], "completo": m["completo"],
            "yardas": m["yardas"], "intercepcion": m["intercepcion"]})})

    por_sit = []
    for s in D.ORDEN_SITUACION:
        g = base[base["situacion"] == s]
        a = _plano(_metricas(g[g["rushers"] == 4]))
        b = _plano(_metricas(g[g["rushers"] >= 5]))
        if a["n"] and b["n"]:
            v = _veredicto(a, b)
        else:
            v = {"texto": "Pocas jugadas para decidir", "codigo": "pocas"}
        por_sit.append({"situacion": s, "cuatro": a, "cinco_o_mas": b, "veredicto": v})

    cob = []
    for tipo in ["Man", "Zone", "Other"]:
        g = base[base["pff_passCoverageType"] == tipo]
        cob.append({"cobertura": tipo, **_plano(_metricas(g))})

    n = len(base)
    frec = float((base["rushers"] >= 5).mean()) if n else None
    frec_liga = float((liga["rushers"] >= 5).mean()) if len(liga) else None
    return {
        "defensa": defensa, "filtros": f.como_dict(), "jugadas": int(n),
        "frecuencia_blitz": None if frec is None else round(frec, 3),
        "frecuencia_blitz_liga": None if frec_liga is None else round(frec_liga, 3),
        "por_rushers": por_rushers, "por_situacion": por_sit, "por_cobertura": cob,
        "nota": "Los equipos mandan blitz en momentos distintos, así que esto describe lo ocurrido y no prueba que el blitz cause el resultado.",
    }


# ---------------------------------------------------------------- Jugadores y duelos
def _nombre(d: D.Datos, nid) -> str:
    return d.nombres.get(int(nid), str(int(nid)))


def jugadores(equipo: str, f: D.Filtros, min_snaps: int = 30) -> dict | None:
    d = D.cargar()
    if equipo not in set(d.plays["possessionTeam"]):
        return None
    liga = D.filtrar(d.plays, f)

    bq = D.restringir(d.bloq, liga[liga["possessionTeam"] == equipo])
    bq = bq[bq["possessionTeam"] == equipo]
    g = bq.groupby("nflId").agg(snaps=("presiones", "size"), presiones=("presiones", "sum"),
                                sacks=("pff_sackAllowed", "sum"), posicion=("posicion", lambda s: s.mode().iat[0])).reset_index()
    bloqueadores = []
    for r in g[g["snaps"] >= min_snaps].itertuples():
        t = tasa(r.presiones, r.snaps)
        bloqueadores.append({"id": int(r.nflId), "nombre": _nombre(d, r.nflId), "posicion": r.posicion,
                             "snaps": int(r.snaps), "presiones": int(r.presiones), "sacks": int(r.sacks),
                             "tasa": round(float(r.presiones) / r.snaps, 3), "ic_bajo": t["ic_bajo"], "ic_alto": t["ic_alto"]})
    bloqueadores.sort(key=lambda x: x["tasa"], reverse=True)

    rs = D.restringir(d.rush, liga[liga["defensiveTeam"] == equipo])
    rs = rs[rs["defensiveTeam"] == equipo]
    g = rs.groupby("nflId").agg(snaps=("presion", "size"), presiones=("presion", "sum"), sacks=("pff_sack", "sum"),
                                posicion=("pff_positionLinedUp", lambda s: s.mode().iat[0]),
                                tipo=("tipo", lambda s: s.mode().iat[0])).reset_index()
    rushers = []
    for r in g[g["snaps"] >= min_snaps].itertuples():
        t = tasa(r.presiones, r.snaps)
        rushers.append({"id": int(r.nflId), "nombre": _nombre(d, r.nflId), "posicion": r.posicion, "tipo": r.tipo,
                        "snaps": int(r.snaps), "presiones": int(r.presiones), "sacks": int(r.sacks),
                        "tasa": round(float(r.presiones) / r.snaps, 3), "ic_bajo": t["ic_bajo"], "ic_alto": t["ic_alto"]})
    rushers.sort(key=lambda x: x["tasa"], reverse=True)
    return {"equipo": equipo, "filtros": f.como_dict(), "min_snaps": min_snaps,
            "bloqueadores": bloqueadores, "rushers": rushers}


def duelos(equipo: str, f: D.Filtros, min_n: int = 5) -> dict | None:
    """Qué tan seguido presiona cada tipo de defensor contra cada posición de la línea del equipo."""
    d = D.cargar()
    if equipo not in set(d.plays["possessionTeam"]):
        return None
    liga = D.filtrar(d.plays, f)
    bq = D.restringir(d.bloq, liga[liga["possessionTeam"] == equipo])
    bq = bq[(bq["possessionTeam"] == equipo) & bq["pff_nflIdBlockedPlayer"].notna()]
    rs = d.rush[["gameId", "playId", "nflId", "presion", "tipo", "pff_positionLinedUp"]].rename(
        columns={"nflId": "defensor", "presion": "def_presiono", "pff_positionLinedUp": "def_pos"})
    m = bq.merge(rs, left_on=["gameId", "playId", "pff_nflIdBlockedPlayer"], right_on=["gameId", "playId", "defensor"])

    matriz = []
    for (pos, tipo), g in m.groupby(["posicion", "tipo"]):
        t = tasa(g["def_presiono"].sum(), len(g))
        matriz.append({"posicion": pos, "tipo": tipo, "n": int(len(g)), "presiono": int(g["def_presiono"].sum()),
                       "tasa": t["tasa"], "ic_bajo": t["ic_bajo"], "ic_alto": t["ic_alto"], "muestra": t["muestra"]})

    pares = []
    for (bl, df_), g in m.groupby(["nflId", "defensor"]):
        if len(g) < min_n:
            continue
        pares.append({"bloqueador": _nombre(d, bl), "posicion": g["posicion"].iat[0],
                      "defensor": _nombre(d, df_), "def_pos": g["def_pos"].iat[0],
                      "n": int(len(g)), "presiono": int(g["def_presiono"].sum()),
                      "tasa": round(float(g["def_presiono"].mean()), 3)})
    pares.sort(key=lambda x: (x["tasa"], x["n"]), reverse=True)
    return {"equipo": equipo, "filtros": f.como_dict(), "matriz": matriz, "pares": pares[:12], "min_n": min_n,
            "nota": "Cada fila cuenta los snaps en que el defensor fue el primer rival asignado al bloqueador y si ese defensor logró presión."}


def plan_basico(c: dict, b: dict) -> str:
    """Plan de juego sin IA, con las mismas cifras (respaldo si Nova falla)."""
    l = []
    dif = c["esperada"] - c["tasa_liga"]
    lado = "más" if dif > 0 else "menos"
    l.append(
        f"• Presión esperada de {c['defensa']} contra {c['ataque']}: {c['esperada']:.1%}, "
        f"{abs(dif) * 100:.1f} puntos {lado} que el promedio de la liga ({c['tasa_liga']:.1%})."
    )
    sit = [s for s in c["por_situacion"] if s["jugadas_ataque"] >= 15]
    if sit:
        s = sit[0]
        l.append(f"• Mejor momento para atacar: {s['situacion']}, con {s['esperada']:.1%} de presión esperada.")
    if c["eslabones_debiles"]:
        w = c["eslabones_debiles"][0]
        l.append(f"• Eslabón débil de {c['ataque']}: {w['nombre']} ({w['posicion']}), presión en {w['tasa']:.1%} de {w['snaps']} snaps.")
    if c["mejores_rushers"]:
        r = c["mejores_rushers"][0]
        l.append(f"• Mejor arma de {c['defensa']}: {r['nombre']} ({r['posicion']}), presión en {r['tasa']:.1%} de {r['snaps']} snaps.")
    si = [s for s in b["por_situacion"] if s["veredicto"]["codigo"] == "si"]
    if si:
        l.append(f"• El blitz de 5 o más rindió en: {', '.join(s['situacion'] for s in si[:3])}.")
    else:
        l.append("• En los datos de esta defensa no hay una situación donde el blitz baje claramente las yardas permitidas.")
    return "\n".join(l)


# ---------------------------------------------------------------- Cara a cara
def cara_a_cara(ataque: str, defensa: str, f: D.Filtros) -> dict | None:
    d = D.cargar()
    ps = d.plays
    if ataque not in set(ps["possessionTeam"]) or defensa not in set(ps["defensiveTeam"]):
        return None
    liga = D.filtrar(ps, f)
    l = float(liga["presion"].mean()) if len(liga) else 0.0

    ja = liga[liga["possessionTeam"] == ataque]
    jd = liga[liga["defensiveTeam"] == defensa]
    a = encogida(ja["presion"].sum(), len(ja), l)
    b = encogida(jd["presion"].sum(), len(jd), l)
    esperada = log5(a, b, l)

    por_sit = []
    for s in D.ORDEN_SITUACION:
        gl, ga, gd = liga[liga["situacion"] == s], ja[ja["situacion"] == s], jd[jd["situacion"] == s]
        if len(gl) == 0:
            continue
        ls = float(gl["presion"].mean())
        sa = encogida(ga["presion"].sum(), len(ga), ls)
        sd = encogida(gd["presion"].sum(), len(gd), ls)
        por_sit.append({"situacion": s, "esperada": round(log5(sa, sd, ls), 3), "liga": round(ls, 3),
                        "ataque": round(sa, 3), "defensa": round(sd, 3),
                        "jugadas_ataque": int(len(ga)), "jugadas_defensa": int(len(gd))})
    por_sit.sort(key=lambda x: x["esperada"], reverse=True)

    jug_a = jugadores(ataque, f, min_snaps=40)
    jug_d = jugadores(defensa, f, min_snaps=40)
    return {
        "ataque": ataque, "defensa": defensa, "filtros": f.como_dict(),
        "tasa_liga": round(l, 3),
        "ataque_permite": round(a, 3), "defensa_genera": round(b, 3), "esperada": round(esperada, 3),
        "jugadas_ataque": int(len(ja)), "jugadas_defensa": int(len(jd)),
        "por_situacion": por_sit,
        "eslabones_debiles": (jug_a or {}).get("bloqueadores", [])[:3],
        "mejores_rushers": (jug_d or {}).get("rushers", [])[:3],
        "nota": "La presión esperada combina la tasa del ataque y la de la defensa (ajustadas hacia el promedio de la liga cuando hay pocas jugadas). Es una estimación, no un pronóstico.",
    }
