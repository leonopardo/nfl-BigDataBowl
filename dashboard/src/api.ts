import type { ReporteRival, ResumenNova } from './tipos'
import { EQUIPOS_FALSOS, reporteFalso, resumenFalso } from './datosFalsos'

// true: usa datos falsos. false: llama al backend.
export const USAR_DATOS_FALSOS = false

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Las rutas son relativas y sin diagonal inicial: la app se publica en una subruta.
async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const r = await fetch(ruta, opciones)
  if (!r.ok) throw new Error(`Error ${r.status} en ${ruta}`)
  return (await r.json()) as T
}

export async function obtenerEquipos(): Promise<string[]> {
  if (USAR_DATOS_FALSOS) return EQUIPOS_FALSOS
  return pedir<string[]>('api/equipos')
}

export async function obtenerReporte(equipo: string): Promise<ReporteRival> {
  if (USAR_DATOS_FALSOS) {
    await pausa(200)
    return reporteFalso(equipo)
  }
  return pedir<ReporteRival>(`api/rival/${encodeURIComponent(equipo)}`)
}

export async function obtenerResumen(equipo: string): Promise<ResumenNova> {
  if (USAR_DATOS_FALSOS) {
    await pausa(800)
    return resumenFalso(equipo)
  }
  return pedir<ResumenNova>(`api/rival/${encodeURIComponent(equipo)}/resumen`, { method: 'POST' })
}
