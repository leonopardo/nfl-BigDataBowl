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
// Coordenadas en el campo (x a lo largo, y a lo ancho). El lado izquierdo del mariscal es y grande.
const POS: Record<string, { x: number; y: number; r: number }> = {
  LT: { x: LOS, y: 31.0, r: 1.55 },
  LG: { x: LOS, y: 28.8, r: 1.55 },
  C: { x: LOS, y: 26.6, r: 1.55 },
  RG: { x: LOS, y: 24.4, r: 1.55 },
  RT: { x: LOS, y: 22.2, r: 1.55 },
  TE: { x: LOS, y: 19.6, r: 1.3 },
  RB: { x: LOS - 6, y: 26.6, r: 1.3 },
}

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

  // Mariscal (referencia visual)
  puntos.push({ id: 'qb', x: LOS - 3.2, y: 26.6, r: 1.3, color: '#facc15', etiqueta: 'QB', colorTexto: '#000' })

  // Defensa decorativa: cuatro rushers que llegan hacia la línea
  const defY = [31.6, 28.2, 25.0, 21.6]
  defY.forEach((y, i) => puntos.push({ id: `d${i}`, x: LOS + 3, y, r: 0.9, color: '#ef4444', forma: 'triangulo', opacidad: 0.55 }))
  puntos.push(...extra)

  const lineas: Linea[] = defY.map((y, i) => ({
    x1: LOS + 3, y1: y, x2: LOS + 0.9, y2: y + (26.6 - y) * 0.15, color: '#ef4444', grosor: 0.2, animada: true, flecha: true, opacidad: 0.5,
  }))
  for (const f of flechas) {
    const d = defY[f.desde % defY.length]
    const h = POS[f.hasta]
    if (!h) continue
    lineas.push({ x1: LOS + 3, y1: d, x2: h.x + 1.4, y2: h.y, color: '#fde047', grosor: 0.35, animada: true, flecha: true, etiqueta: f.etiqueta })
  }

  return <Cancha x0={LOS - 8} x1={LOS + 7} puntos={puntos} lineas={lineas} scrimmage={LOS} alt={alt} suave />
}
