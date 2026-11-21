import Cancha, { type Linea, type Punto } from './Cancha'
import { colorCalor, pct } from '../util'
import type { Muestra } from '../tipos'

export interface ValorPos {
  valor: number | null
  muestra?: Muestra
  texto?: string
}

interface Props {
  valores: Record<string, ValorPos> // LT, LG, C, RG, RT, TE, RB
  referencia: number // promedio con el que se compara (verde = mejor, rojo = peor)
  seleccion?: string | null
  onSeleccion?: (pos: string) => void
  flechas?: { desde: number; hasta: string; etiqueta?: string }[] // rushers hacia una posición (ilustrativo)
  extra?: Punto[]
  alt: string
}

const LOS = 50
const CENTRO = 26.65
const SEP = 4.4 // separación entre bloqueadores: es un diagrama, no está a escala real
// Coordenadas en el campo (x a lo largo, y a lo ancho). El lado izquierdo del mariscal es y grande.
const POS: Record<string, { x: number; y: number; r: number }> = {
  LT: { x: LOS, y: CENTRO + 2 * SEP, r: 1.7 },
  LG: { x: LOS, y: CENTRO + SEP, r: 1.7 },
  C: { x: LOS, y: CENTRO, r: 1.7 },
  RG: { x: LOS, y: CENTRO - SEP, r: 1.7 },
  RT: { x: LOS, y: CENTRO - 2 * SEP, r: 1.7 },
  TE: { x: LOS, y: CENTRO - 3 * SEP, r: 1.5 },
  RB: { x: LOS - 9.8, y: CENTRO, r: 1.5 },
}
const DEF_Y = [CENTRO + 1.5 * SEP, CENTRO + 0.5 * SEP, CENTRO - 0.5 * SEP, CENTRO - 1.5 * SEP]
const DEF_X = LOS + 4.4

export const posCampo = (p: string) => POS[p]

export default function FormacionLinea({ valores, referencia, seleccion, onSeleccion, flechas = [], extra = [], alt }: Props) {
  const puntos: Punto[] = Object.entries(POS).map(([pos, c]) => {
    const v = valores[pos]
    const sinDato = !v || v.valor === null
    const dudoso = v?.muestra === 'insuficiente'
    const color = sinDato ? '#4b5563' : colorCalor((v!.valor as number) / Math.max(referencia, 1e-6))
    return {
      id: pos, x: c.x, y: c.y, r: c.r, color,
      borde: seleccion === pos ? '#fff' : '#000',
      etiqueta: pos, colorTexto: '#fff',
      texto: sinDato ? undefined : (v!.texto ?? pct(v!.valor)),
      opacidad: dudoso ? 0.45 : 1,
      pulso: seleccion === pos,
      titulo: sinDato ? `${pos}: sin datos` : `${pos}: ${v!.texto ?? pct(v!.valor)}${dudoso ? ' (muy pocas jugadas)' : ''}`,
      onClick: onSeleccion ? () => onSeleccion(pos) : undefined,
    }
  })

  // Mariscal (referencia visual), detrás del centro con espacio para el texto de éste
  puntos.push({ id: 'qb', x: LOS - 5.8, y: CENTRO, r: 1.5, color: '#facc15', etiqueta: 'QB', colorTexto: '#000' })

  // Defensa decorativa: cuatro rushers que llegan hacia la línea, por los huecos entre bloqueadores
  DEF_Y.forEach((y, i) => puntos.push({ id: `d${i}`, x: DEF_X, y, r: 1.0, color: '#ef4444', forma: 'triangulo', opacidad: 0.55 }))
  puntos.push(...extra)

  const lineas: Linea[] = DEF_Y.map((y) => ({
    x1: DEF_X, y1: y, x2: LOS + 2.4, y2: y + (CENTRO - y) * 0.1, color: '#ef4444', grosor: 0.2, animada: true, flecha: true, opacidad: 0.5,
  }))
  for (const f of flechas) {
    const d = DEF_Y[f.desde % DEF_Y.length]
    const h = POS[f.hasta]
    if (!h) continue
    lineas.push({ x1: DEF_X, y1: d, x2: h.x + h.r + 0.9, y2: h.y, color: '#fde047', grosor: 0.35, animada: true, flecha: true, etiqueta: f.etiqueta })
  }

  return <Cancha x0={LOS - 14} x1={LOS + 10} y0={6} y1={47.3} puntos={puntos} lineas={lineas} scrimmage={LOS} alt={alt} suave maxVh={70} />
}
