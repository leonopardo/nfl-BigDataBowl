"""Utilidades estadísticas pequeñas (sin librerías extra): intervalo de Wilson y etiquetas de muestra."""
from math import sqrt

MUESTRA_INSUFICIENTE = 15  # menos que esto: no se interpreta
MUESTRA_PEQUENA = 30       # menos que esto: se muestra con aviso


def wilson(k: float, n: int, z: float = 1.96) -> tuple[float, float]:
    """Intervalo de confianza (95 %) para una proporción k/n."""
    if n <= 0:
        return (0.0, 1.0)
    k = max(0.0, min(float(k), float(n)))
    p = k / n
    d = 1 + z * z / n
    centro = (p + z * z / (2 * n)) / d
    margen = z * sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, centro - margen), min(1.0, centro + margen))


def etiqueta_muestra(n: int) -> str:
    if n < MUESTRA_INSUFICIENTE:
        return "insuficiente"
    if n < MUESTRA_PEQUENA:
        return "pequena"
    return "ok"


def tasa(k: float, n: int) -> dict:
    """Tasa k/n con intervalo de confianza y etiqueta de tamaño de muestra."""
    n = int(n)
    lo, hi = wilson(k, n)
    return {
        "n": n,
        "k": int(round(float(k))),
        "tasa": round(float(k) / n, 4) if n else None,
        "ic_bajo": round(lo, 4) if n else None,
        "ic_alto": round(hi, 4) if n else None,
        "muestra": etiqueta_muestra(n),
    }


def log5(a: float, b: float, liga: float) -> float:
    """Tasa esperada cuando se enfrentan un ataque con tasa a y una defensa con tasa b (liga = promedio)."""
    liga = min(max(liga, 1e-6), 1 - 1e-6)
    a = min(max(a, 1e-6), 1 - 1e-6)
    b = min(max(b, 1e-6), 1 - 1e-6)
    x = a * b / liga
    y = (1 - a) * (1 - b) / (1 - liga)
    return x / (x + y)


def encogida(k: float, n: int, liga: float, peso: int = 20) -> float:
    """Tasa suavizada hacia el promedio de la liga: con pocas jugadas se parece a la liga."""
    return (float(k) + peso * liga) / (n + peso)
