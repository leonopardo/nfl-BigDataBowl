import Cancha, { type Linea, type Punto } from './Cancha'

const LOS = 50
const C = 26.65
const SEP = 4.4 // diagrama ampliado: no está a escala real, para que nada se encime
const OL_Y = [C + 2 * SEP, C + SEP, C, C - SEP, C - 2 * SEP]
const OL_POS = ['LT', 'LG', 'C', 'RG', 'RT']
const QB: [number, number] = [LOS - 5, C]

// 11 defensores. Para cada uno: de dónde sale si presiona, y dónde se para si cubre.
interface Espacio { sale: [number, number]; cubre: [number, number] }
const DEFENSA: Espacio[] = [
  { sale: [LOS + 3.0, C + 6.6], cubre: [LOS + 9, C + 13] },
  { sale: [LOS + 3.0, C + 2.2], cubre: [LOS + 7, C + 5] },
  { sale: [LOS + 3.0, C - 2.2], cubre: [LOS + 7, C - 5] },
  { sale: [LOS + 3.0, C - 6.6], cubre: [LOS + 9, C - 13] },
  { sale: [LOS + 5.0, C + 5], cubre: [LOS + 10, C + 8.5] },
  { sale: [LOS + 5.0, C - 5], cubre: [LOS + 10, C - 8.5] },
  { sale: [LOS + 5.0, C], cubre: [LOS + 8, C] },
  { sale: [LOS + 4.5, 49.5], cubre: [LOS + 6, 49.5] },
  { sale: [LOS + 4.5, 4.0], cubre: [LOS + 6, 4.0] },
  { sale: [LOS + 12, C + 10], cubre: [LOS + 14, C + 10] },
  { sale: [LOS + 12, C - 10], cubre: [LOS + 14, C - 10] },
]
const PRIORIDAD = [0, 1, 2, 3, 4, 5, 6] // quién presiona primero

// Receptores (5): en este orden quedan libres si faltan defensores en cobertura
const RECEPTORES = [
  { id: 'wr1', x: LOS, y: 48, nombre: 'WR', ruta: [LOS + 16, 48] },
  { id: 'wr2', x: LOS, y: 5.5, nombre: 'WR', ruta: [LOS + 16, 5.5] },
  { id: 'slot', x: LOS - 1, y: 40, nombre: 'WR', ruta: [LOS + 12, 35] },
  { id: 'te', x: LOS, y: C - 3 * SEP, nombre: 'TE', ruta: [LOS + 9, 10] },
  { id: 'rb', x: LOS - 8, y: C + 6, nombre: 'RB', ruta: [LOS - 3, 38] },
]
const SIN_CUBRIR = ['rb', 'te', 'slot'] // los primeros que quedan libres

export default function BlitzCampo({ rushers }: { rushers: number }) {
  const n = Math.max(3, Math.min(7, rushers))
  const presionan = PRIORIDAD.slice(0, n)
  const cubren = 11 - n
  const libres = Math.max(0, 5 - cubren)
  const libresIds = new Set(SIN_CUBRIR.slice(0, libres))

  // Los rushers se reparten parejo a lo ancho, de izquierda a derecha, para no encimarse.
  const orden = [...presionan].sort((a, b) => DEFENSA[b].sale[1] - DEFENSA[a].sale[1])
  const separacion = n > 1 ? Math.min(4.4, 18 / (n - 1)) : 0
  const posRusher = new Map<number, [number, number]>()
  orden.forEach((e, j) => posRusher.set(e, [DEFENSA[e].sale[0], C + (separacion * (n - 1)) / 2 - separacion * j]))

  const puntos: Punto[] = []
  OL_Y.forEach((y, i) => puntos.push({ id: `ol${i}`, x: LOS, y, r: 1.5, color: '#e5e7eb', etiqueta: OL_POS[i], colorTexto: '#013369', borde: '#013369' }))
  puntos.push({ id: 'qb', x: QB[0], y: QB[1], r: 1.4, color: '#facc15', etiqueta: 'QB', colorTexto: '#000' })
  for (const r of RECEPTORES) {
    const libre = libresIds.has(r.id)
    puntos.push({
      id: r.id, x: r.x, y: r.y, r: 1.2, color: libre ? '#22d3ee' : '#93c5fd', borde: libre ? '#fff' : '#000',
      etiqueta: r.nombre, colorTexto: '#000', pulso: libre, texto: libre ? 'libre' : undefined,
    })
  }

  const lineas: Linea[] = RECEPTORES.map((r) => ({
    x1: r.x, y1: r.y, x2: r.ruta[0], y2: r.ruta[1], color: '#93c5fd', grosor: 0.18, punteada: true, opacidad: 0.6,
  }))

  DEFENSA.forEach((d, i) => {
    const presiona = posRusher.has(i)
    const pos = presiona ? (posRusher.get(i) as [number, number]) : d.cubre
    puntos.push({
      id: `d${i}`, x: pos[0], y: pos[1], r: 1.05, forma: 'triangulo',
      color: presiona ? '#ef4444' : '#fb923c', borde: '#fff', opacidad: presiona ? 1 : 0.85,
    })
    if (presiona) lineas.push({ x1: pos[0], y1: pos[1], x2: QB[0], y2: QB[1], color: '#fecaca', grosor: 0.2, animada: true, opacidad: 0.55 })
  })

  return (
    <div className="relative">
      <Cancha x0={LOS - 11} x1={LOS + 17} puntos={puntos} lineas={lineas} scrimmage={LOS} suave maxVh={72} alt={`Esquema del blitz con ${n} rushers`} />
      <div className="absolute left-2 top-2 rounded bg-black/75 px-2 py-1 text-xs text-white md:text-sm">
        <span className="font-bold text-red-400">{n} presionan</span> · <span className="font-bold text-orange-300">{cubren} cubren</span> a 5 receptores
        {libres > 0 && <span className="ml-1 font-bold text-cyan-300">→ {libres} receptor{libres > 1 ? 'es' : ''} libre{libres > 1 ? 's' : ''}</span>}
      </div>
      <p className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-gray-300">Esquema ilustrativo</p>
    </div>
  )
}
