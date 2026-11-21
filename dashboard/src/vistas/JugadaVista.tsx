import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import Cancha, { ANCHO, px, py, type Linea, type Punto } from '../componentes/Cancha'
import { Cargando, ErrorCaja, Explica, Seccion } from '../componentes/Piezas'
import { useCarga, useReloj } from '../hooks'
import type { Jugada } from '../tipos'
import { BLANCO, RESULTADO, TEXTO_SUAVE } from '../util'

const TIPOS = [
  { id: 'presion', texto: 'Con presión' },
  { id: 'sack', texto: 'Sacks' },
  { id: 'limpia', texto: 'Sin presión' },
]

const ALTO_MAX_VH = 78

type Zona = { color: string; nombre: string }
function zona(dist: number | null): Zona {
  if (dist === null) return { color: '#6b7280', nombre: 'Sin dato' }
  if (dist <= 2) return { color: '#ef4444', nombre: 'Zona roja' }
  if (dist <= 4) return { color: '#facc15', nombre: 'Zona de alerta' }
  return { color: '#22c55e', nombre: 'Zona segura' }
}

function apellido(n: string): string {
  const p = n.trim().split(' ')
  return p[p.length - 1] ?? n
}

function narrar(j: Jugada, t: number, dist: number | null): string {
  const lanz = j.eventos.find((e) => e.evento === 'lanzamiento')
  const sack = j.eventos.find((e) => e.evento === 'sack')
  if (t < 0) return 'Antes del snap: la ofensiva y la defensa se acomodan.'
  if (sack && t >= sack.t) return `Sack a los ${sack.t.toFixed(1)} s: el mariscal fue derribado y la ofensiva pierde yardas.`
  if (lanz && t >= lanz.t) return `El mariscal soltó el balón a los ${lanz.t.toFixed(1)} s. Resultado: ${RESULTADO[j.resultado] ?? j.resultado}${j.yardas ? ` (${j.yardas > 0 ? '+' : ''}${j.yardas} yardas)` : ''}.`
  if (dist !== null && dist <= 2) return `¡Presión! Un rusher está a ${dist.toFixed(1)} yardas del mariscal, ${t.toFixed(1)} s después del snap.`
  if (dist !== null && dist <= 4) return `Se acerca la presión: el rusher más cercano está a ${dist.toFixed(1)} yardas. El mariscal busca a su receptor.`
  return `El mariscal retrocede y busca a un receptor. El rusher más cercano aún está a ${dist?.toFixed(1) ?? '—'} yardas.`
}

// Tamaños a escala real: los linieros se paran a ~1.6 yardas entre sí, así que su círculo mide menos que eso.
function estilo(j: Jugada['jugadores'][number]): Pick<Punto, 'color' | 'forma' | 'r' | 'colorTexto'> {
  switch (j.rol) {
    case 'QB': return { color: '#facc15', r: 0.95, colorTexto: '#000' }
    case 'Bloqueador': return { color: '#e5e7eb', r: 0.7, colorTexto: '#013369' }
    case 'Receptor': return { color: '#38bdf8', r: 0.8, colorTexto: '#000' }
    case 'Rusher': return { color: '#ef4444', forma: 'triangulo', r: 0.8, colorTexto: '#fff' }
    case 'Cobertura': return { color: '#fb923c', forma: 'triangulo', r: 0.8, colorTexto: '#000' }
    default: return { color: '#9ca3af', r: 0.75 }
  }
}

function ampliar(a: number, b: number, minimo: number, lo: number, hi: number): [number, number] {
  if (b - a < minimo) {
    const c = (a + b) / 2
    a = c - minimo / 2
    b = c + minimo / 2
  }
  if (a < lo) { b += lo - a; a = lo }
  if (b > hi) { a -= b - hi; b = hi }
  return [Math.max(lo, a), Math.min(hi, b)]
}

/** Ventana de la cancha: se acerca a donde ocurre la acción durante toda la jugada. */
function ventanaDe(j: Jugada) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const fr of j.frames) {
    for (const p of fr.p) {
      if (!p) continue
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0])
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1])
    }
  }
  const ls = j.campo.linea_scrimmage ?? 50
  const [x0, x1] = ampliar(Math.max(minX - 3, ls - 16), Math.min(maxX + 3, ls + 32), 24, 0, 120)
  const [y0, y1] = ampliar(Math.max(0, minY - 3), Math.min(ANCHO, maxY + 3), 36, 0, ANCHO)
  return { x0, x1, y0, y1, ls }
}

export function Reproductor({ j }: { j: Jugada }) {
  const tmin = j.frames[0].t
  const tmax = j.frames[j.frames.length - 1].t
  const [juega, setJuega] = useState(true)
  const [vel, setVel] = useState(0.5)
  const [nombres, setNombres] = useState(false)
  const [orientaciones, setOrientaciones] = useState(false)
  const [t, setT] = useReloj(juega, tmin, tmax, vel, () => setJuega(false))

  const { x0, x1, y0, y1, ls } = useMemo(() => ventanaDe(j), [j])
  const ratio = (y1 - y0) / (x1 - x0)

  const fps = j.fps
  const i0 = Math.max(0, Math.min(j.frames.length - 2, Math.floor((t - tmin) * fps)))
  const a = j.frames[i0]
  const b = j.frames[Math.min(i0 + 1, j.frames.length - 1)]
  const alfa = Math.max(0, Math.min(1, (t - a.t) * fps))
  const r = j.reloj[Math.min(i0, j.reloj.length - 1)]

  const idx = useMemo(() => new Map(j.jugadores.map((p, k) => [p.id, k])), [j])
  const qbK = j.jugadores.findIndex((p) => p.rol === 'QB')

  const interp = (k: number): [number, number] | null => {
    const pa = a.p[k]
    const pb = b.p[k]
    if (pa && pb) return [pa[0] + (pb[0] - pa[0]) * alfa, pa[1] + (pb[1] - pa[1]) * alfa]
    const u = pa ?? pb
    return u ? [u[0], u[1]] : null
  }

  const puntos: Punto[] = []
  j.jugadores.forEach((p, k) => {
    const pos = interp(k)
    if (!pos) return
    const cercano = r?.rusher === p.id
    const esQB = p.rol === 'QB'
    puntos.push({
      id: p.id, x: pos[0], y: pos[1], ...estilo(p),
      etiqueta: p.dorsal != null ? String(p.dorsal) : undefined,
      borde: cercano ? '#fff' : '#000', pulso: cercano && (r?.dist ?? 99) <= 4,
      orient: orientaciones ? (a.p[k]?.[2] ?? null) : null,
      texto: nombres || esQB || (cercano && t >= 0) ? apellido(p.nombre) : undefined,
      tamTexto: 1.1,
      titulo: `${p.nombre} (${p.pos || p.rol})`,
    })
  })

  const dist = r?.dist ?? null
  const z = zona(dist)
  const lineas: Linea[] = []
  const anot: React.ReactNode[] = []
  const qb = qbK >= 0 ? interp(qbK) : null
  if (qb && r?.rusher != null && t >= 0) {
    const kr = idx.get(r.rusher)
    const rp = kr != null ? interp(kr) : null
    if (rp) lineas.push({ x1: rp[0], y1: rp[1], x2: qb[0], y2: qb[1], color: z.color, grosor: 0.22, punteada: true, etiqueta: dist != null ? `${dist.toFixed(1)} yd` : undefined })
    anot.push(<circle key="aro" cx={px(qb[1], y1)} cy={py(qb[0], x1)} r={1.9} fill="none" stroke={z.color} strokeWidth={0.3} />)
  }
  const balon = a.balon && b.balon ? ([a.balon[0] + (b.balon[0] - a.balon[0]) * alfa, a.balon[1] + (b.balon[1] - a.balon[1]) * alfa] as [number, number]) : (a.balon ?? null)

  const serie = j.reloj.filter((p) => p.t >= 0 && p.dist != null).map((p) => ({ t: p.t, dist: p.dist }))
  const tPresion = j.reloj.find((p) => p.t >= 0 && p.dist != null && p.dist <= 2)?.t ?? null
  const tLanz = j.eventos.find((e) => e.evento === 'lanzamiento')?.t ?? null
  const relato = narrar(j, t, dist)

  return (
    <div className="space-y-4">
      <div className="relative mx-auto" style={{ maxWidth: `calc(${ALTO_MAX_VH}vh * ${ratio})` }}>
        <Cancha x0={x0} x1={x1} y0={y0} y1={y1} puntos={puntos} lineas={lineas} balon={balon} scrimmage={ls} anotaciones={anot} maxVh={ALTO_MAX_VH}
          alt={`Jugada real de ${j.ataque}: ${j.descripcion}`} />
        <div className="absolute left-2 top-2 rounded bg-black/75 px-2 py-1 text-xs text-white md:text-sm">{t < 0 ? `Antes del snap (${t.toFixed(1)} s)` : `${t.toFixed(1)} s desde el snap`}</div>
        <div className="absolute right-2 top-2 flex items-center gap-2 rounded bg-black/75 px-2 py-1 text-xs font-bold md:text-sm" style={{ color: z.color }}>
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: z.color }} /> {t >= 0 ? z.nombre : 'Antes del snap'}
        </div>
      </div>

      <p className="aparece mx-auto min-h-[3rem] rounded bg-marino p-3 text-white" style={{ maxWidth: `calc(${ALTO_MAX_VH}vh * ${Math.max(ratio, 1)})` }} key={relato.slice(0, 14)}>{relato}</p>

      <div className="no-imprimir space-y-2 rounded-lg bg-neutral-900 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button className="rounded border-2 border-white bg-rojo px-4 py-1.5 font-semibold" onClick={() => { if (t >= tmax - 0.05) setT(tmin); setJuega(!juega) }}>{juega ? '⏸ Pausar' : t >= tmax - 0.05 ? '↺ Repetir' : '▶ Reproducir'}</button>
          <span className="text-gray-300">Velocidad</span>
          {[0.25, 0.5, 1].map((v) => (
            <button key={v} onClick={() => setVel(v)} className={`rounded border px-2 py-1 ${vel === v ? 'border-white bg-gray-700' : 'border-gray-600 text-gray-300'}`}>{v}x</button>
          ))}
          <label className="ml-2 flex items-center gap-1 text-gray-200"><input type="checkbox" checked={nombres} onChange={(e) => setNombres(e.target.checked)} /> Nombres de todos</label>
          <label className="flex items-center gap-1 text-gray-200"><input type="checkbox" checked={orientaciones} onChange={(e) => setOrientaciones(e.target.checked)} /> Hacia dónde mira cada jugador</label>
        </div>
        <div className="relative pt-4">
          <input type="range" className="w-full accent-red-600" min={tmin} max={tmax} step={0.05} value={t} onChange={(e) => { setJuega(false); setT(Number(e.target.value)) }} aria-label="Momento de la jugada" />
          {j.eventos.map((e) => (
            <span key={e.evento} className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] text-gray-300" style={{ left: `${((e.t - tmin) / (tmax - tmin)) * 100}%` }}>▼ {e.evento}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-300">
          <span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-yellow-400" />Mariscal</span>
          <span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-gray-200" />Bloqueadores</span>
          <span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-sky-400" />Receptores</span>
          <span><i className="mr-1 inline-block h-3 w-3 bg-red-500" />Rushers</span>
          <span><i className="mr-1 inline-block h-3 w-3 bg-orange-400" />Cobertura</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-neutral-800 p-3 text-sm">
          <p className="font-semibold text-white">{j.ataque} contra {j.defensa}</p>
          <p className="text-gray-300">{j.down}ª y {j.distancia} · cuarto {j.cuarto} · {RESULTADO[j.resultado] ?? j.resultado}</p>
          <p className="mt-1 text-xs text-gray-400">{j.rushers != null && `${j.rushers} rushers · `}{j.cobertura ? `cobertura ${j.cobertura}` : ''}</p>
          <p className="mt-2 text-xs text-gray-300">{j.descripcion}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-sm">
          <div className="rounded-lg bg-marino p-2"><p className="text-xs text-gray-200">Tiempo hasta lanzar</p><p className="text-2xl font-extrabold">{tLanz != null ? `${tLanz.toFixed(1)} s` : '—'}</p></div>
          <div className="rounded-lg bg-marino p-2"><p className="text-xs text-gray-200">Rusher a menos de 2 yd</p><p className="text-2xl font-extrabold">{tPresion != null ? `${tPresion.toFixed(1)} s` : 'nunca'}</p></div>
        </div>
        <div className="h-44 rounded-lg bg-neutral-900 p-2">
          <p className="text-xs text-gray-300">Distancia del rusher más cercano al mariscal</p>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={serie} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="t" type="number" domain={[0, Math.max(3, tmax)]} tick={{ fill: TEXTO_SUAVE, fontSize: 10 }} unit="s" />
              <YAxis tick={{ fill: TEXTO_SUAVE, fontSize: 10 }} unit="yd" />
              <ReferenceArea y1={0} y2={2} fill="#ef4444" fillOpacity={0.18} />
              <ReferenceArea y1={2} y2={4} fill="#facc15" fillOpacity={0.1} />
              <ReferenceLine x={Math.max(0, t)} stroke={BLANCO} />
              <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} yd`, 'Distancia']} labelFormatter={(l) => `${l} s`} contentStyle={{ backgroundColor: '#013369', border: `1px solid ${BLANCO}` }} />
              <Line type="monotone" dataKey="dist" stroke="#fde047" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default function JugadaVista({ equipo }: { equipo: string }) {
  const [tipo, setTipo] = useState('presion')
  const [sel, setSel] = useState(0)
  const { datos: lista, cargando, error } = useCarga(() => api.jugadas(equipo, tipo), [equipo, tipo], !!equipo)
  const elegida = lista?.[sel]
  const { datos: j, cargando: cargandoJ, error: errorJ } = useCarga(
    () => api.jugada(elegida!.gameId, elegida!.playId), [elegida?.gameId, elegida?.playId], !!elegida,
  )

  useEffect(() => setSel(0), [equipo, tipo])

  return (
    <div className="space-y-5">
      <Explica titulo="Una jugada real, cuadro por cuadro">
        <p>Cada punto es un jugador real, tomado de los sensores de la NFL (10 mediciones por segundo). El <strong>círculo alrededor del mariscal</strong> es un semáforo: verde si el rusher más cercano está a más de 4 yardas, amarillo entre 2 y 4, rojo si está a 2 yardas o menos (ya lo presiona). La cancha se acerca sola a donde ocurre la acción.</p>
      </Explica>

      <Seccion titulo={`Jugadas de ${equipo}`} sub="Elija una jugada de la lista. Se reproduce sola.">
        <div className="no-imprimir mb-3 flex flex-wrap gap-2" role="tablist">
          {TIPOS.map((t) => (
            <button key={t.id} role="tab" aria-selected={t.id === tipo} onClick={() => setTipo(t.id)} className={`rounded border px-3 py-1 text-sm font-semibold ${t.id === tipo ? 'border-white bg-rojo' : 'border-gray-500 text-gray-200 hover:bg-gray-800'}`}>{t.texto}</button>
          ))}
        </div>
        {cargando && <Cargando />}
        <ErrorCaja texto={error} />
        {lista && lista.length === 0 && <p className="text-gray-300">No hay jugadas de este tipo.</p>}
        {lista && lista.length > 0 && (
          <div className="no-imprimir flex gap-2 overflow-x-auto pb-2">
            {lista.map((p, i) => (
              <button key={`${p.gameId}-${p.playId}`} onClick={() => setSel(i)} className={`min-w-[150px] rounded border px-2 py-1 text-left text-xs ${i === sel ? 'border-white bg-marino' : 'border-gray-600 bg-neutral-800 hover:bg-neutral-700'}`}>
                <strong>{p.down}ª y {p.distancia}</strong> · {RESULTADO[p.resultado] ?? p.resultado}<br />
                <span className="text-gray-400">{p.yardas > 0 ? '+' : ''}{p.yardas} yd · cuarto {p.cuarto}</span>
              </button>
            ))}
          </div>
        )}
      </Seccion>

      {cargandoJ && <Cargando texto="Cargando la jugada…" />}
      <ErrorCaja texto={errorJ} />
      {j && j.frames.length > 2 && <Reproductor key={`${j.gameId}-${j.playId}`} j={j} />}
    </div>
  )
}
