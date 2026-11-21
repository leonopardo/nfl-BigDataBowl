import type {
  Blitz, CaraACara, CostoPresion, Duelos, EstadoReloj, Filtros, Jugada, JugadaResumen, Jugadores,
  Reloj, ReporteRival, RespuestaIA, Resumen,
} from './tipos'

type Params = Record<string, string | number | null | undefined>

function qs(p: Params): string {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v))
  const s = u.toString()
  return s ? `?${s}` : ''
}

const conFiltros = (f: Filtros, extra: Params = {}): string => qs({ ...f, ...extra })

// Las rutas son relativas y sin diagonal inicial: la app se publica en una subruta.
async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const r = await fetch(ruta, opciones)
  if (!r.ok) {
    let detalle = ''
    try {
      detalle = (await r.json()).detail ?? ''
    } catch {
      /* sin cuerpo */
    }
    throw new Error(detalle || `Error ${r.status}`)
  }
  return (await r.json()) as T
}

const post = <T,>(ruta: string, cuerpo: unknown) =>
  pedir<T>(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })

const enc = encodeURIComponent

export const api = {
  equipos: () => pedir<string[]>('api/equipos'),
  reporte: (e: string, f: Filtros) => pedir<ReporteRival>(`api/rival/${enc(e)}${conFiltros(f)}`),
  resumen: (e: string) => pedir<Resumen>(`api/rival/${enc(e)}/resumen`, { method: 'POST' }),
  costo: (e: string, f: Filtros) => pedir<CostoPresion>(`api/costo-presion${conFiltros(f, { equipo: e })}`),
  blitz: (d: string, f: Filtros) => pedir<Blitz>(`api/blitz${conFiltros(f, { defensa: d })}`),
  jugadores: (e: string, f: Filtros) => pedir<Jugadores>(`api/jugadores/${enc(e)}${conFiltros(f, { min_snaps: 40 })}`),
  duelos: (e: string, f: Filtros) => pedir<Duelos>(`api/duelos/${enc(e)}${conFiltros(f)}`),
  caraACara: (a: string, d: string, f: Filtros) => pedir<CaraACara>(`api/cara-a-cara${conFiltros(f, { ataque: a, defensa: d })}`),
  jugadas: (e: string, tipo: string) => pedir<JugadaResumen[]>(`api/jugadas/${enc(e)}${qs({ tipo, limite: 30 })}`),
  jugada: (g: number, p: number) => pedir<Jugada>(`api/jugada/${g}/${p}`),
  reloj: (e: string) => pedir<Reloj>(`api/reloj${qs({ equipo: e })}`),
  relojEstado: () => pedir<EstadoReloj>('api/reloj/estado'),
  plan: (ataque: string, defensa: string) => post<Resumen>('api/plan', { ataque, defensa }),
  analista: (pregunta: string) => post<RespuestaIA>('api/analista', { pregunta }),
}
