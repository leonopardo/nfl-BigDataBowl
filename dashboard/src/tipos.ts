// Contrato de la API acordado con el backend (Persona A).

export interface FilaPosicion {
  posicion: string
  snaps: number
  presiones: number
  sacks: number
  tasa: number
}

export interface FilaSituacion {
  situacion: string
  jugadas: number
  tasa_presion: number
}

export interface ReporteRival {
  equipo: string
  jugadas_pase: number
  tasa_presion: number
  por_posicion: FilaPosicion[]
  por_situacion: FilaSituacion[]
}

export interface ResumenNova {
  resumen: string
  fuente?: string // 'nova' o 'automatico'
}
