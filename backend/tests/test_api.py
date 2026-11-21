"""Pruebas de la API con los datos reales (requieren data/ en su lugar)."""
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend import main
from backend.estadistica import encogida, log5, wilson

cliente = TestClient(main.app)


# ---- estadística pura
def test_wilson_contiene_la_proporcion():
    lo, hi = wilson(30, 100)
    assert lo < 0.30 < hi
    assert 0 <= lo and hi <= 1


def test_wilson_es_mas_ancho_con_menos_datos():
    a = wilson(3, 10)
    b = wilson(300, 1000)
    assert (a[1] - a[0]) > (b[1] - b[0])


def test_log5_con_equipos_promedio_da_el_promedio():
    assert log5(0.37, 0.37, 0.37) == pytest.approx(0.37)


def test_log5_suma_efectos():
    assert log5(0.45, 0.45, 0.37) > 0.45


def test_encogida_con_pocos_datos_se_parece_a_la_liga():
    assert abs(encogida(1, 2, 0.37) - 0.37) < abs(1 / 2 - 0.37)


# ---- API
def test_health():
    assert cliente.get("/health").json() == {"status": "ok"}


def test_equipos():
    e = cliente.get("/api/equipos").json()
    assert len(e) == 32 and "KC" in e


def test_reporte_tiene_el_contrato_original():
    r = cliente.get("/api/rival/KC").json()
    assert r["equipo"] == "KC" and r["jugadas_pase"] == 339
    assert r["tasa_presion"] == pytest.approx(0.363, abs=0.001)
    for campo in ("por_posicion", "por_situacion", "por_formacion", "tasa_presion_liga"):
        assert campo in r
    p = r["por_posicion"][0]
    assert {"posicion", "snaps", "presiones", "sacks", "tasa", "ic_bajo", "ic_alto", "muestra", "tasa_liga"} <= p.keys()


def test_filtro_reduce_las_jugadas():
    todas = cliente.get("/api/rival/KC").json()["jugadas_pase"]
    tercera = cliente.get("/api/rival/KC", params={"down": 3}).json()["jugadas_pase"]
    assert 0 < tercera < todas


def test_equipo_desconocido_da_404_y_filtro_malo_da_422():
    assert cliente.get("/api/rival/XXX").status_code == 404
    assert cliente.get("/api/rival/KC", params={"distancia": "enorme"}).status_code == 422


def test_costo_de_la_presion():
    r = cliente.get("/api/costo-presion").json()
    assert r["con_presion"]["yardas"] < r["sin_presion"]["yardas"]
    assert r["con_presion"]["completo"]["tasa"] < r["sin_presion"]["completo"]["tasa"]
    assert r["sin_sacks"]["diferencia"]["yardas"] > 0
    assert r["con_presion"]["n"] + r["sin_presion"]["n"] == r["jugadas"]


def test_blitz_cubre_todos_los_rushers():
    r = cliente.get("/api/blitz").json()
    assert sum(g["n"] for g in r["por_rushers"]) == r["jugadas"]
    assert {s["veredicto"]["codigo"] for s in r["por_situacion"]} <= {"si", "no", "igual", "pocas"}
    por = {g["rushers"]: g for g in r["por_rushers"]}
    assert por["5"]["presion"]["tasa"] > por["4"]["presion"]["tasa"]


def test_jugadores_con_nombre():
    r = cliente.get("/api/jugadores/KC", params={"min_snaps": 50}).json()
    assert r["bloqueadores"] and r["rushers"]
    assert isinstance(r["bloqueadores"][0]["nombre"], str)
    assert r["bloqueadores"] == sorted(r["bloqueadores"], key=lambda x: x["tasa"], reverse=True)


def test_duelos():
    r = cliente.get("/api/duelos/KC").json()
    assert r["matriz"]
    assert all(0 <= m["tasa"] <= 1 for m in r["matriz"])


def test_cara_a_cara():
    r = cliente.get("/api/cara-a-cara", params={"ataque": "KC", "defensa": "TB"}).json()
    assert 0 < r["esperada"] < 1
    assert r["por_situacion"] == sorted(r["por_situacion"], key=lambda x: x["esperada"], reverse=True)


def test_plan_usa_respaldo_si_nova_falla(monkeypatch):
    def falla(*a, **k):
        raise HTTPException(status_code=503, detail="sin IA")

    monkeypatch.setattr(main, "consultar_nova", falla)
    r = cliente.post("/api/plan", json={"ataque": "KC", "defensa": "TB"}).json()
    assert r["fuente"] == "automatico" and "KC" in r["resumen"]


def test_jugada_para_la_cancha():
    lista = cliente.get("/api/jugadas/KC", params={"tipo": "presion", "limite": 3}).json()
    assert lista
    j = cliente.get(f"/api/jugada/{lista[0]['gameId']}/{lista[0]['playId']}").json()
    assert len(j["frames"]) > 20
    roles = {x["rol"] for x in j["jugadores"]}
    assert {"QB", "Bloqueador", "Rusher", "Cobertura"} <= roles
    assert any(e["evento"] == "snap" for e in j["eventos"])
    assert len(j["reloj"]) == len(j["frames"])
    # el campo está orientado: el ataque avanza hacia la derecha, así que el QB queda a la izquierda de la línea de scrimmage
    ls = j["campo"]["linea_scrimmage"]
    qb = next(i for i, x in enumerate(j["jugadores"]) if x["rol"] == "QB")
    snap = next(fr for fr in j["frames"] if fr["t"] == 0)
    assert snap["p"][qb][0] <= ls + 1
