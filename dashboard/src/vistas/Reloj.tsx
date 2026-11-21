import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import { Cargando, ErrorCaja, Explica, Pie, Seccion, Tarjeta } from '../componentes/Piezas'
import { useCarga, useReloj } from '../hooks'
import type { EstadoReloj } from '../tipos'
import { BLANCO, TEXTO_SUAVE, num, pct } from '../util'

const TOOLTIP = { backgroundColor: '#013369', border: `1px solid ${BLANCO}`, color: BLANCO }

export default function RelojVista({ equipo }: { equipo: string }) {
  const [estado, setEstado] = useState<EstadoReloj | null>(null)

  // Mientras el servidor calcula el tracking, se consulta el avance.
  useEffect(() => {
    let vivo = true
    let id: ReturnType<typeof setTimeout>
    const preguntar = async () => {
      try {
        const e = await api.relojEstado()
        if (!vivo) return
        setEstado(e)
        if (e.estado === 'calculando' || e.estado === 'pendiente') id = setTimeout(preguntar, 1500)
      } catch {
        if (vivo) id = setTimeout(preguntar, 3000)
      }
    }
    preguntar()
    return () => { vivo = false; clearTimeout(id) }
  }, [])

  if (!estado) return <Cargando />
  if (estado.estado === 'error') return <ErrorCaja texto={`No se pudo procesar el tracking: ${estado.error ?? ''}`} />
  if (estado.estado !== 'listo') {
    const p = estado.total ? (estado.hechos / estado.total) * 100 : 0
    return (
      <Seccion titulo="Preparando el reloj del mariscal" sub="El servidor está leyendo los 122 partidos de tracking. Toma menos de un minuto, solo al arrancar.">
        <div className="h-4 rounded bg-neutral-800"><div className="barra h-4 rounded bg-rojo" style={{ width: `${p}%` }} /></div>
        <p className="mt-2 text-sm text-gray-300">{estado.hechos} de {estado.total} partidos</p>
      </Seccion>
    )
  }
  return <RelojListo equipo={equipo} />
}

export function RelojListo({ equipo }: { equipo: string }) {
  const [soloEquipo, setSoloEquipo] = useState(false)
  const [juega, setJuega] = useState(false)
  const [t, setT] = useReloj(juega, 0.5, 5, 0.8, () => setJuega(false))
  const { datos: r, error } = useCarga(() => api.reloj(soloEquipo ? equipo : ''), [soloEquipo, equipo])

  if (error) return <ErrorCaja texto={error} />
  if (!r) return <Cargando />

  const i = r.tiempos.findIndex((x) => x >= t - 1e-6)
  const k = i < 0 ? r.tiempos.length - 1 : i
  const soltado = r.liga.balon_soltado[k]
  const cerca = r.liga.rusher_cerca[k]
  const luz = cerca < 0.25 ? { c: '#22c55e', n: 'Zona segura' } : cerca < 0.5 ? { c: '#facc15', n: 'Zona de alerta' } : { c: '#ef4444', n: 'Zona roja' }
  const verde = r.zonas.verde_hasta ?? 2.5
  const amarilla = r.zonas.amarilla_hasta ?? 3.5

  const datos = r.tiempos.map((tt, j) => ({
    t: tt,
    soltado: Number((r.liga.balon_soltado[j] * 100).toFixed(1)),
    cerca: Number((r.liga.rusher_cerca[j] * 100).toFixed(1)),
    soltadoEq: r.equipo ? Number((r.equipo.balon_soltado[j] * 100).toFixed(1)) : undefined,
    cercaEq: r.equipo ? Number((r.equipo.rusher_cerca[j] * 100).toFixed(1)) : undefined,
  }))
  const tramos = r.por_tiempo.map((x) => ({ tramo: x.tramo.replace(' s', ''), completo: x.completo == null ? 0 : Number((x.completo * 100).toFixed(1)), sack: x.sack == null ? 0 : Number((x.sack * 100).toFixed(1)), n: x.n }))

  return (
    <div className="space-y-5">
      <Explica titulo="Qué es el reloj del mariscal">
        <p>Un mariscal tiene poco tiempo: la mitad de los pases salen alrededor de los <strong>{num(r.mediana_lanzamiento.liga)} segundos</strong> después del snap. En esos segundos, los defensores corren hacia él. Aquí medimos <strong>cuándo llega el primer defensor a menos de {r.umbral_yardas} yardas</strong> y qué pasa con el pase según cuánto tarda.</p>
      </Explica>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tarjeta titulo="Se lanza a los (mediana)" valor={`${num(r.mediana_lanzamiento.liga)} s`} detalle={r.equipo ? `${equipo}: ${num(r.mediana_lanzamiento.equipo)} s` : 'toda la liga'} />
        <Tarjeta titulo="Llega el 1.er rusher (mediana)" valor={`${num(r.mediana_rusher_cerca.liga)} s`} detalle={r.equipo ? `${equipo}: ${num(r.mediana_rusher_cerca.equipo)} s` : 'a menos de 2 yardas'} />
        <Tarjeta titulo="Zona segura hasta" valor={`${num(verde, 2)} s`} detalle="menos de 1 de cada 4 jugadas con rusher cerca" />
        <Tarjeta titulo="Zona roja desde" valor={`${num(amarilla, 2)} s`} detalle="la mitad de las jugadas ya tiene un rusher cerca" />
      </div>

      <Seccion titulo="El reloj en marcha" sub="Presione reproducir y mire cómo cambia la situación del mariscal con cada segundo.">
        <div className="grid items-center gap-4 md:grid-cols-3">
          <div className="flex flex-col items-center rounded-lg bg-neutral-800 p-4">
            <div className="flex h-36 w-36 items-center justify-center rounded-full border-8 text-4xl font-extrabold transition-colors duration-500" style={{ borderColor: luz.c }}>{t.toFixed(1)} s</div>
            <p className="mt-2 text-lg font-bold" style={{ color: luz.c }}>{luz.n}</p>
            <div className="no-imprimir mt-3 flex gap-2 text-sm">
              <button className="rounded border-2 border-white bg-rojo px-3 py-1 font-semibold" onClick={() => { if (t >= 4.95) setT(0.5); setJuega(!juega) }}>{juega ? '⏸ Pausar' : '▶ Reproducir'}</button>
            </div>
          </div>
          <div className="space-y-3 md:col-span-2">
            <div>
              <div className="flex justify-between text-sm"><span>Pases que ya salieron</span><strong>{pct(soltado, 0)}</strong></div>
              <div className="h-5 rounded bg-neutral-800"><div className="barra h-5 rounded bg-sky-500" style={{ width: `${soltado * 100}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-sm"><span>Jugadas con un rusher a menos de {r.umbral_yardas} yardas</span><strong>{pct(cerca, 0)}</strong></div>
              <div className="h-5 rounded bg-neutral-800"><div className="barra h-5 rounded" style={{ width: `${cerca * 100}%`, background: luz.c }} /></div>
            </div>
            <input type="range" className="no-imprimir w-full accent-red-600" min={0.5} max={5} step={0.25} value={t} onChange={(e) => { setJuega(false); setT(Number(e.target.value)) }} aria-label="Segundos desde el snap" />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Quién gana la carrera: el balón o el rusher" sub="Dos curvas acumuladas. Donde la curva roja va por delante de la azul, los pases salen ya con presión encima.">
        <label className="no-imprimir mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={soloEquipo} onChange={(e) => setSoloEquipo(e.target.checked)} /> Comparar con {equipo || 'el equipo elegido'}</label>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <ReferenceArea x1={0.5} x2={verde} fill="#22c55e" fillOpacity={0.12} />
              <ReferenceArea x1={verde} x2={amarilla} fill="#facc15" fillOpacity={0.1} />
              <ReferenceArea x1={amarilla} x2={5} fill="#ef4444" fillOpacity={0.12} />
              <XAxis dataKey="t" type="number" domain={[0.5, 5]} unit=" s" tick={{ fill: TEXTO_SUAVE }} />
              <YAxis unit="%" tick={{ fill: TEXTO_SUAVE }} domain={[0, 100]} />
              <Tooltip contentStyle={TOOLTIP} labelFormatter={(l) => `${l} s`} formatter={(v) => `${v}%`} />
              <Legend />
              <ReferenceLine x={t} stroke={BLANCO} />
              <Line name="Balón ya lanzado (liga)" dataKey="soltado" stroke="#38bdf8" strokeWidth={3} dot={false} isAnimationActive={false} />
              <Line name="Rusher cerca (liga)" dataKey="cerca" stroke="#ef4444" strokeWidth={3} dot={false} isAnimationActive={false} />
              {r.equipo && <Line name={`Balón lanzado (${equipo})`} dataKey="soltadoEq" stroke="#38bdf8" strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
              {r.equipo && <Line name={`Rusher cerca (${equipo})`} dataKey="cercaEq" stroke="#ef4444" strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Pie>Fondo verde, amarillo y rojo: zonas según cuántas jugadas ya tienen un rusher cerca (menos de 25 %, hasta 50 %, más de 50 %). Base: {r.liga.n.toLocaleString('es-MX')} jugadas de pase.</Pie>
      </Seccion>

      <Seccion titulo="Cuánto tarda el mariscal y cómo le va" sub="Mientras más se tarda en soltar el balón, menos pases se completan y más sacks hay.">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tramos} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="tramo" tick={{ fill: BLANCO, fontSize: 12 }} />
              <YAxis unit="%" tick={{ fill: TEXTO_SUAVE }} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v) => `${v}%`} />
              <Legend />
              <Bar name="Pases completos" dataKey="completo" fill="#f3f4f6" />
              <Bar name="Sacks" dataKey="sack" fill="#D50A0A" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Pie>Atención: un mariscal presionado también suelta antes o falla más, y a veces espera porque nadie está libre. Esta gráfica muestra una asociación, no una causa.</Pie>
      </Seccion>
    </div>
  )
}
