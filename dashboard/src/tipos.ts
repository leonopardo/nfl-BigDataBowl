// Contrato de la API (backend/main.py).

export type Muestra = 'ok' | 'pequena' | 'insuficiente'

export interface Filtros {
  down?: number
  distancia?: string
  cuarto?: number
  marcador?: string
  formacion?: string
}

export interface Tasa {
  n: number
  k: number
  tasa: number | null
  ic_bajo: number | null
  ic_alto: number | null
  muestra: Muestra
}

// ---- Reporte del rival
export interface FilaPosicion {
  posicion: string
  snaps: number
  presiones: number
  sacks: number
  tasa: number
  ic_bajo: number | null
  ic_alto: number | null
  muestra: Muestra
  tasa_liga: number | null
}

export interface FilaSituacion {
  situacion: string
  jugadas: number
  tasa_presion: number
  ic_bajo: number | null
  ic_alto: number | null
  muestra: Muestra
  tasa_liga: number | null
}

export interface FilaFormacion {
  formacion: string
  jugadas: number
  tasa_presion: number
  ic_bajo: number | null
  ic_alto: number | null
  muestra: Muestra
  tasa_liga: number | null
}

export interface ReporteRival {
  equipo: string
  filtros: Record<string, string | number>
  jugadas_pase: number
  tasa_presion: number
  tasa_presion_liga: number
  por_posicion: FilaPosicion[]
  por_situacion: FilaSituacion[]
  por_formacion: FilaFormacion[]
}

export interface Resumen {
  resumen: string
  fuente?: string // 'nova' o 'automatico'
}

// ---- Costo de la presión y blitz
export interface Metricas {
  n: number
  completo?: Tasa | null
  yardas?: number | null
  sack?: Tasa | null
  intercepcion?: Tasa | null
  presion?: Tasa | null
}

export interface Plano {
  n: number
  yardas?: number | null
  completo?: number | null
  sack?: number | null
  intercepcion?: number | null
  presion?: number | null
}

export interface Diferencia {
  yardas: number
  completo: number
}

export interface CostoPresion {
  equipo: string | null
  filtros: Record<string, string | number>
  jugadas: number
  con_presion: Metricas
  sin_presion: Metricas
  diferencia: Diferencia | null
  sin_sacks: { con_presion: Metricas; sin_presion: Metricas; diferencia: Diferencia | null }
  por_situacion: { situacion: string; n: number; con_presion: Plano; sin_presion: Plano }[]
  texto: string | null
  nota: string
}

export interface Veredicto {
  texto: string
  codigo: 'si' | 'no' | 'igual' | 'pocas'
  dy?: number
  dp?: number
}

export interface Blitz {
  defensa: string | null
  filtros: Record<string, string | number>
  jugadas: number
  frecuencia_blitz: number | null
  frecuencia_blitz_liga: number | null
  por_rushers: (Metricas & { rushers: string })[]
  por_situacion: { situacion: string; cuatro: Plano; cinco_o_mas: Plano; veredicto: Veredicto }[]
  por_cobertura: (Plano & { cobertura: string })[]
  nota: string
}

// ---- Jugadores, duelos y cara a cara
export interface JugadorFila {
  id: number
  nombre: string
  posicion: string
  tipo?: string
  snaps: number
  presiones: number
  sacks: number
  tasa: number
  ic_bajo: number | null
  ic_alto: number | null
}

export interface Jugadores {
  equipo: string
  min_snaps: number
  bloqueadores: JugadorFila[]
  rushers: JugadorFila[]
}

export interface Duelos {
  equipo: string
  matriz: { posicion: string; tipo: string; n: number; presiono: number; tasa: number | null; ic_bajo: number | null; ic_alto: number | null; muestra: Muestra }[]
  pares: { bloqueador: string; posicion: string; defensor: string; def_pos: string; n: number; presiono: number; tasa: number }[]
  min_n: number
  nota: string
}

export interface CaraACara {
  ataque: string
  defensa: string
  tasa_liga: number
  ataque_permite: number
  defensa_genera: number
  esperada: number
  jugadas_ataque: number
  jugadas_defensa: number
  por_situacion: { situacion: string; esperada: number; liga: number; ataque: number; defensa: number; jugadas_ataque: number; jugadas_defensa: number }[]
  eslabones_debiles: JugadorFila[]
  mejores_rushers: JugadorFila[]
  nota: string
}

// ---- Tracking
export interface JugadaResumen {
  gameId: number
  playId: number
  down: number
  distancia: number
  cuarto: number
  resultado: string
  yardas: number
  presion: boolean
  descripcion: string
}

export type Rol = 'QB' | 'Bloqueador' | 'Rusher' | 'Cobertura' | 'Receptor' | 'Otro'

export interface JugadorCampo {
  id: number
  nombre: string
  dorsal: number | null
  pos: string
  rol: Rol
  equipo: 'ataque' | 'defensa'
}

export interface Cuadro {
  t: number
  p: ([number, number, number | null] | null)[]
  balon: [number, number] | null
}

export interface RelojCuadro {
  t: number
  dist: number | null
  rusher: number | null
  cierre: number | null
  tti: number | null
}

export interface Jugada {
  gameId: number
  playId: number
  descripcion: string
  ataque: string
  defensa: string
  down: number
  distancia: number
  cuarto: number
  resultado: string
  yardas: number
  hubo_presion: boolean
  rushers: number | null
  cobertura: string | null
  jugadores: JugadorCampo[]
  frames: Cuadro[]
  eventos: { t: number; evento: string }[]
  reloj: RelojCuadro[]
  campo: { largo: number; ancho: number; linea_scrimmage: number | null }
  fps: number
}

export interface Curva {
  n: number
  balon_soltado: number[]
  rusher_cerca: number[]
}

export interface Reloj {
  umbral_yardas: number
  tiempos: number[]
  liga: Curva
  equipo: Curva | null
  por_tiempo: { tramo: string; n: number; completo: number | null; sack: number | null; intercepcion: number | null; presion: number | null }[]
  zonas: { verde_hasta: number | null; amarilla_hasta: number | null }
  mediana_lanzamiento: { liga: number | null; equipo: number | null }
  mediana_rusher_cerca: { liga: number | null; equipo: number | null }
}

export interface EstadoReloj {
  estado: 'pendiente' | 'calculando' | 'listo' | 'error'
  hechos: number
  total: number
  error: string | null
}

export interface RespuestaIA {
  respuesta: string
  modelo: string
}
