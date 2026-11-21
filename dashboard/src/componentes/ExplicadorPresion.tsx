import { useEffect, useState } from 'react'
import Cancha, { type Linea, type Punto } from './Cancha'

const LOS = 50
const OL = [
  { pos: 'LT', y: 31.0 }, { pos: 'LG', y: 28.8 }, { pos: 'C', y: 26.6 }, { pos: 'RG', y: 24.4 }, { pos: 'RT', y: 22.2 },
]

interface Paso {
  titulo: string
  texto: string
  rusher: [number, number] // posición del rusher que llega primero
  otros: number // cuánto avanzan los otros tres rushers
  qb: [number, number]
  balon: [number, number] | null
  alerta?: string
}

// Posiciones en yardas del campo (x a lo largo, y a lo ancho).
const PASOS: Paso[] = [
  { titulo: '1. Antes de la jugada', texto: 'Cinco bloqueadores forman un muro frente al mariscal. La defensa se alinea al frente.',
    rusher: [LOS + 3.2, 21.0], otros: 0, qb: [LOS - 3.2, 26.6], balon: [LOS, 26.6] },
  { titulo: '2. Empieza la jugada', texto: 'Los defensores que buscan al mariscal (pass rushers) salen corriendo. El mariscal retrocede.',
    rusher: [LOS + 0.9, 22.0], otros: 1.2, qb: [LOS - 6, 26.6], balon: [LOS - 6, 26.6] },
  { titulo: '3. Hurry: lo apuran', texto: 'Un rusher pasa al bloqueador y llega cerca. No lo toca, pero el mariscal tiene que lanzar con prisa.',
    rusher: [LOS - 2.6, 24.0], otros: 2.2, qb: [LOS - 7, 26.6], balon: [LOS - 7, 26.6], alerta: 'HURRY' },
  { titulo: '4. Hit: lo golpean', texto: 'El rusher llega justo cuando el mariscal suelta el balón y lo golpea.',
    rusher: [LOS - 6.2, 26.0], otros: 2.8, qb: [LOS - 7, 26.6], balon: [LOS - 2, 31], alerta: 'HIT' },
  { titulo: '5. Sack: lo derriban', texto: 'El rusher derriba al mariscal antes de que pueda lanzar. El equipo pierde yardas.',
    rusher: [LOS - 7.1, 26.6], otros: 2.8, qb: [LOS - 7.4, 26.6], balon: [LOS - 7.4, 26.6], alerta: 'SACK' },
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
    id: o.pos, x: LOS, y: o.y, r: 1.4, color: '#e5e7eb', etiqueta: o.pos, colorTexto: '#013369', borde: '#013369',
    opacidad: paso >= 2 && o.pos === 'RT' ? 0.55 : 1,
  }))
  puntos.push({ id: 'qb', x: p.qb[0], y: p.qb[1], r: 1.35, color: paso === 4 ? '#7f1d1d' : '#facc15', etiqueta: 'QB', colorTexto: paso === 4 ? '#fff' : '#000', pulso: paso >= 2 })
  const otrosY = [31.8, 28.0, 24.6]
  otrosY.forEach((y, i) =>
    puntos.push({ id: `o${i}`, x: LOS + 3.2 - p.otros, y: y + (i === 2 ? 0 : 0), r: 1.0, color: '#ef4444', forma: 'triangulo', opacidad: 0.6 }),
  )
  puntos.push({ id: 'rusher', x: p.rusher[0], y: p.rusher[1], r: 1.2, color: '#ef4444', forma: 'triangulo', borde: '#fff', texto: 'Rusher', pulso: paso >= 2 })

  const lineas: Linea[] = []
  if (paso >= 1) {
    lineas.push({ x1: p.rusher[0], y1: p.rusher[1], x2: p.qb[0], y2: p.qb[1], color: '#fde047', grosor: 0.25, punteada: true, etiqueta: paso >= 2 ? `${Math.hypot(p.rusher[0] - p.qb[0], p.rusher[1] - p.qb[1]).toFixed(1)} yd` : undefined })
  }
  if (paso === 3) lineas.push({ x1: p.qb[0], y1: p.qb[1], x2: p.balon![0], y2: p.balon![1], color: '#fff', grosor: 0.2, flecha: true, animada: true })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="relative">
        <Cancha x0={LOS - 12} x1={LOS + 7} puntos={puntos} lineas={lineas} balon={paso === 3 || paso === 4 ? null : p.balon} scrimmage={LOS} suave alt="Animación: cómo un rusher llega al mariscal" />
        {p.alerta && (
          <span className="aparece absolute right-3 top-3 rounded bg-rojo px-3 py-1 text-sm font-extrabold tracking-wide text-white shadow" key={p.alerta}>
            {p.alerta}
          </span>
        )}
      </div>
      <div className="flex flex-col justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">{p.titulo}</h3>
          <p className="mt-1 text-gray-200">{p.texto}</p>
          <p className="mt-3 text-sm text-gray-400">
            En el proyecto, una jugada cuenta como <strong className="text-white">con presión</strong> si ocurre alguna de las tres cosas (hurry, hit o sack).
          </p>
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
          <div className="mt-2 flex gap-2 text-sm">
            <button className="rounded border border-gray-500 px-3 py-1 hover:bg-gray-800" onClick={() => { setAuto(false); setPaso((paso + PASOS.length - 1) % PASOS.length) }}>◀ Anterior</button>
            <button className="rounded border border-gray-500 px-3 py-1 hover:bg-gray-800" onClick={() => setAuto(!auto)}>{auto ? '⏸ Pausar' : '▶ Reproducir'}</button>
            <button className="rounded border border-gray-500 px-3 py-1 hover:bg-gray-800" onClick={() => { setAuto(false); setPaso((paso + 1) % PASOS.length) }}>Siguiente ▶</button>
          </div>
        </div>
      </div>
    </div>
  )
}
