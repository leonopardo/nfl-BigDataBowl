// Datos falsos que siguen el contrato de la API. Se usan mientras el backend no esté listo.
import type { ReporteRival, ResumenNova } from './tipos'

export const EQUIPOS_FALSOS: string[] = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET',
  'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LA', 'LV', 'MIA', 'MIN', 'NE', 'NO',
  'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
]

const POSICIONES = ['LT', 'LG', 'C', 'RG', 'RT', 'TE', 'RB']
const SITUACIONES = ['1ª y corta (1-3)', '2ª y media (4-6)', '3ª y corta (1-3)', '3ª y media (4-6)', '3ª y larga (7+)']

// Número pseudoaleatorio estable por equipo, para que cada uno se vea distinto.
function semilla(texto: string, i: number): number {
  let h = 17 + i * 31
  for (const c of texto) h = (h * 33 + c.charCodeAt(0)) % 9973
  return (h % 1000) / 1000
}

export function reporteFalso(equipo: string): ReporteRival {
  const por_posicion = POSICIONES.map((posicion, i) => {
    const snaps = 250 + Math.round(semilla(equipo, i) * 60)
    const tasa = 0.04 + semilla(equipo, i + 10) * 0.12
    const presiones = Math.round(snaps * tasa)
    return { posicion, snaps, presiones, sacks: Math.round(presiones * 0.15), tasa: Number(tasa.toFixed(3)) }
  })
  const por_situacion = SITUACIONES.map((situacion, i) => ({
    situacion,
    jugadas: 30 + Math.round(semilla(equipo, i + 20) * 90),
    tasa_presion: Number((0.15 + semilla(equipo, i + 30) * 0.3).toFixed(3)),
  }))
  return {
    equipo,
    jugadas_pase: 280 + Math.round(semilla(equipo, 40) * 80),
    tasa_presion: Number((0.2 + semilla(equipo, 41) * 0.15).toFixed(3)),
    por_posicion,
    por_situacion,
  }
}

export function resumenFalso(equipo: string): ResumenNova {
  return {
    resumen:
      `• (Datos de ejemplo) Ataque el lado más débil de la línea de ${equipo}.\n` +
      '• En 3ª y larga, mande presión con cuatro hombres y cubra con siete.\n' +
      '• Use stunts contra el guardia con la tasa de presión más alta.\n' +
      '• Pida al apoyo del TE que no ayude en protección para forzar los 1 a 1.',
  }
}
