import { useEffect, useState } from 'react'
import Cancha, { type Linea, type Punto } from './Cancha'

const LOS = 50
const C = 26.65
const SEP = 4.4 // diagrama a escala ampliada, para que nada se encime
const OL = [
  { pos: 'LT', y: C + 2 * SEP }, { pos: 'LG', y: C + SEP }, { pos: 'C', y: C }, { pos: 'RG', y: C - SEP }, { pos: 'RT', y: C - 2 * SEP },
]
const OTROS_Y = [C + 1.5 * SEP, C + 0.5 * SEP, C - 0.5 * SEP] // rushers bloqueados, en los huecos de la línea

interface Paso {
  titulo: string
  texto: string
  rusher: [number, number] // posición del rusher que llega primero
  otros: number // cuánto avanzan los otros tres rushers
  qb: [number, number]
  alerta?: string
}

// Posiciones en yardas del campo (x a lo largo, y a lo ancho).
const PASOS: Paso[] = [
  { titulo: '1. Antes de la jugada', texto: 'Cinco bloqueadores forman un muro frente al mariscal. La defensa se alinea al frente.',
    rusher: [LOS + 4.4, 14.2], otros: 0, qb: [LOS - 5.8, C] },
  { titulo: '2. Empieza la jugada', texto: 'Los defensores que buscan al mariscal (pass rushers) salen corriendo. El mariscal retrocede.',
    rusher: [LOS + 2.4, 14.6], otros: 1.2, qb: [LOS - 7.5, C] },
  { titulo: '3. Hurry: lo apuran', texto: 'Un rusher pasa al bloqueador y llega cerca. No lo toca, pero el mariscal tiene que lanzar con prisa.',
    rusher: [LOS - 6.8, 23.8], otros: 1.8, qb: [LOS - 9, C], alerta: 'HURRY' },
  { titulo: '4. Hit: lo golpean', texto: 'El rusher llega justo cuando el mariscal suelta el balón y lo golpea.',
    rusher: [LOS - 8.6, 25.6], otros: 1.8, qb: [LOS - 9, C], alerta: 'HIT' },
  { titulo: '5. Sack: lo derriban', texto: 'El rusher derriba al mariscal antes de que pueda lanzar. El equipo pierde yardas.',
    rusher: [LOS - 9.2, C], otros: 1.8, qb: [LOS - 9.4, C], alerta: 'SACK' },
]

export default function ExplicadorPresion() {
  const [paso, setPaso] = useState(0)
  const [auto, setAuto] = useState(true)

  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => setPaso((p) => (p + 1) % PASOS.length), 2800)
    return () => clearInterval(id)
  }, [auto])

  const p = PASOS[paso]
  const puntos: Punto[] = OL.map((o) => ({
    id: o.pos, x: LOS, y: o.y, r: 1.7, color: '#e5e7eb', etiqueta: o.pos, colorTexto: '#013369', borde: '#013369',
    opacidad: paso >= 2 && o.pos === 'RT' ? 0.55 : 1,
  }))
  puntos.push({ id: 'qb', x: p.qb[0], y: p.qb[1], r: 1.5, color: paso === 4 ? '#7f1d1d' : '#facc15', etiqueta: 'QB', colorTexto: paso === 4 ? '#fff' : '#000', pulso: paso >= 2 })
  OTROS_Y.forEach((y, i) => puntos.push({ id: `o${i}`, x: LOS + 4.4 - p.otros, y, r: 1.0, color: '#ef4444', forma: 'triangulo', opacidad: 0.6 }))
  puntos.push({ id: 'rusher', x: p.rusher[0], y: p.rusher[1], r: 1.2, color: '#ef4444', forma: 'triangulo', borde: '#fff', texto: 'Rusher', pulso: paso >= 2 })

  const lineas: Linea[] = []
  const dist = Math.hypot(p.rusher[0] - p.qb[0], p.rusher[1] - p.qb[1])
  if (paso >= 1) {
    lineas.push({ x1: p.rusher[0], y1: p.rusher[1], x2: p.qb[0], y2: p.qb[1], color: '#fde047', grosor: 0.25, punteada: true, etiqueta: paso >= 2 ? `${dist.toFixed(1)} yd` : undefined })
  }
  if (paso === 3) lineas.push({ x1: p.qb[0], y1: p.qb[1], x2: LOS - 3.5, y2: C + 10, color: '#fff', grosor: 0.25, flecha: true, animada: true })

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <div className="relative md:col-span-3">
        <Cancha x0={LOS - 14} x1={LOS + 8} y0={6} y1={47.3} puntos={puntos} lineas={lineas}
          balon={paso === 0 ? [LOS, C] : null} scrimmage={LOS} suave maxVh={65} alt="Animación: cómo un rusher llega al mariscal" />
        {p.alerta && (
          <span className="aparece absolute right-3 top-3 rounded bg-rojo px-3 py-1 text-sm font-extrabold tracking-wide text-white shadow" key={p.alerta}>
            {p.alerta}
          </span>
        )}
      </div>
      <div className="flex flex-col justify-between gap-3 md:col-span-2">
        <div>
          <h3 className="text-lg font-bold text-white">{p.titulo}</h3>
          <p className="mt-1 text-gray-200">{p.texto}</p>
          <p className="mt-3 text-sm text-gray-400">
            En el proyecto, una jugada cuenta como <strong className="text-white">con presión</strong> si ocurre alguna de las tres cosas (hurry, hit o sack).
          </p>
          <p className="mt-1 text-xs text-gray-500">Diagrama ilustrativo: las distancias están ampliadas para que se vea con claridad.</p>
        </div>
        <div>
          <div className="flex gap-1" role="tablist" aria-label="Pasos">
            {PASOS.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === paso}
                onClick={() => { setPaso(i); setAuto(false) }}
                className={`h-2 flex-1 rounded ${i === paso ? 'bg-rojo' : i < paso ? 'bg-gray-400' : 'bg-gray-700'}`}
                title={PASOS[i].titulo}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <button className="rounded border border-gray-500 px-3 py-1 hover:bg-gray-800" onClick={() => { setAuto(false); setPaso((paso + PASOS.length - 1) % PASOS.length) }}>◀ Anterior</button>
            <button className="rounded border border-gray-500 px-3 py-1 hover:bg-gray-800" onClick={() => setAuto(!auto)}>{auto ? '⏸ Pausar' : '▶ Reproducir'}</button>
            <button className="rounded border border-gray-500 px-3 py-1 hover:bg-gray-800" onClick={() => { setAuto(false); setPaso((paso + 1) % PASOS.length) }}>Siguiente ▶</button>
          </div>
        </div>
      </div>
    </div>
  )
}
