import Cancha, { type Linea, type Punto } from './Cancha'

const LOS = 50
const OL_Y = [31.0, 28.8, 26.6, 24.4, 22.2]
const OL_POS = ['LT', 'LG', 'C', 'RG', 'RT']

// 11 defensores. Para cada uno: dónde juega si presiona y dónde si cubre.
interface Espacio { base: [number, number]; cubre: [number, number] }
const DEFENSA: Espacio[] = [
  { base: [LOS + 1.2, 31.8], cubre: [LOS + 7, 33] },
  { base: [LOS + 1.2, 28.6], cubre: [LOS + 7, 29] },
  { base: [LOS + 1.2, 24.6], cubre: [LOS + 7, 24] },
  { base: [LOS + 1.2, 21.4], cubre: [LOS + 7, 20] },
  { base: [LOS + 4, 30.0], cubre: [LOS + 8, 36] },
  { base: [LOS + 4, 23.4], cubre: [LOS + 8, 17] },
  { base: [LOS + 4.5, 26.6], cubre: [LOS + 9, 26.6] },
  { base: [LOS + 3, 47.5], cubre: [LOS + 5, 47.5] },
  { base: [LOS + 3, 5.8], cubre: [LOS + 5, 5.8] },
  { base: [LOS + 12, 36.5], cubre: [LOS + 12, 36.5] },
  { base: [LOS + 12, 16.8], cubre: [LOS + 12, 16.8] },
]
const PRIORIDAD = [0, 1, 2, 3, 4, 5, 6] // quién presiona primero

// Receptores (5): orden en que quedan sin cubrir si faltan defensores
const RECEPTORES = [
  { id: 'wr1', x: LOS, y: 50, nombre: 'WR', ruta: [LOS + 16, 50] },
  { id: 'wr2', x: LOS, y: 3.5, nombre: 'WR', ruta: [LOS + 16, 3.5] },
  { id: 'slot', x: LOS - 0.5, y: 41, nombre: 'WR', ruta: [LOS + 11, 38] },
  { id: 'te', x: LOS, y: 19.2, nombre: 'TE', ruta: [LOS + 9, 15] },
  { id: 'rb', x: LOS - 6, y: 26.6, nombre: 'RB', ruta: [LOS - 3, 36] },
]
const SIN_CUBRIR = ['rb', 'te', 'slot'] // los primeros que quedan libres

export default function BlitzCampo({ rushers }: { rushers: number }) {
  const n = Math.max(3, Math.min(7, rushers))
  const presionan = new Set(PRIORIDAD.slice(0, n))
  const cubren = 11 - n
  const libres = Math.max(0, 5 - cubren)
  const libresIds = new Set(SIN_CUBRIR.slice(0, libres))

  const puntos: Punto[] = []
  OL_Y.forEach((y, i) => puntos.push({ id: `ol${i}`, x: LOS, y, r: 1.35, color: '#e5e7eb', etiqueta: OL_POS[i], colorTexto: '#013369', borde: '#013369' }))
  puntos.push({ id: 'qb', x: LOS - 3.5, y: 26.6, r: 1.3, color: '#facc15', etiqueta: 'QB', colorTexto: '#000' })
  for (const r of RECEPTORES) {
    puntos.push({
      id: r.id, x: r.x, y: r.y, r: 1.1, color: libresIds.has(r.id) ? '#22d3ee' : '#93c5fd', borde: libresIds.has(r.id) ? '#fff' : '#000',
      etiqueta: r.nombre, colorTexto: '#000', pulso: libresIds.has(r.id), texto: libresIds.has(r.id) ? 'libre' : undefined,
    })
  }

  const lineas: Linea[] = RECEPTORES.map((r) => ({
    x1: r.x, y1: r.y, x2: r.ruta[0], y2: r.ruta[1], color: '#93c5fd', grosor: 0.16, punteada: true, opacidad: 0.6,
  }))

  DEFENSA.forEach((d, i) => {
    const presiona = presionan.has(i)
    // Quien presiona se acerca al mariscal; quien cubre se aleja hacia la zona de cobertura.
    const pos: [number, number] = presiona ? [LOS - 1.4 + (d.base[0] - LOS) * 0.25, 26.6 + (d.base[1] - 26.6) * 0.38] : d.cubre
    puntos.push({
      id: `d${i}`, x: pos[0], y: pos[1], r: 1.0, forma: 'triangulo',
      color: presiona ? '#ef4444' : '#fb923c', borde: '#fff', opacidad: presiona ? 1 : 0.85,
    })
    if (presiona) {
      lineas.push({ x1: pos[0], y1: pos[1], x2: LOS - 3.5, y2: 26.6, color: '#fecaca', grosor: 0.18, animada: true, opacidad: 0.5 })
    }
  })

  return (
    <div className="relative">
      <Cancha x0={LOS - 8} x1={LOS + 17} puntos={puntos} lineas={lineas} scrimmage={LOS} suave alt={`Esquema del blitz con ${n} rushers`} />
      <div className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
        <span className="font-bold text-red-400">{n} presionan</span> · <span className="font-bold text-orange-300">{cubren} cubren</span> a 5 receptores
        {libres > 0 && <span className="ml-1 font-bold text-cyan-300">→ {libres} receptor{libres > 1 ? 'es' : ''} libre{libres > 1 ? 's' : ''}</span>}
      </div>
      <p className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-gray-300">Esquema ilustrativo</p>
    </div>
  )
}
