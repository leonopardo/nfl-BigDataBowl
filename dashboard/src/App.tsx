import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { obtenerEquipos, obtenerReporte, obtenerResumen, USAR_DATOS_FALSOS } from './api'
import type { ReporteRival } from './tipos'

// Colores NFL. Sobre fondo negro, el azul marino se usa como fondo (con texto blanco)
// y no como color de texto, porque casi no se ve sobre negro.
const MARINO = '#013369'
const ROJO = '#D50A0A'
const BLANCO = '#FFFFFF'
const TEXTO_SUAVE = '#D1D5DB' // gris claro: contraste alto sobre negro

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

function Tarjeta({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border-t-4 border-rojo bg-marino p-4 shadow">
      <p className="text-sm text-gray-200">{titulo}</p>
      <p className="text-3xl font-bold text-white">{valor}</p>
    </div>
  )
}

export default function App() {
  const [equipos, setEquipos] = useState<string[]>([])
  const [equipo, setEquipo] = useState('')
  const [reporte, setReporte] = useState<ReporteRival | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [resumen, setResumen] = useState('')
  const [fuente, setFuente] = useState('')
  const [errorResumen, setErrorResumen] = useState('')
  const [cargandoResumen, setCargandoResumen] = useState(false)

  useEffect(() => {
    obtenerEquipos()
      .then((lista) => {
        setEquipos(lista)
        if (lista.length > 0) setEquipo(lista[0])
      })
      .catch(() => setError('No se pudo cargar la lista de equipos.'))
  }, [])

  useEffect(() => {
    if (!equipo) return
    let vigente = true // evita que una respuesta lenta pise a la del equipo actual
    setCargando(true)
    setError('')
    setResumen('')
    setFuente('')
    setErrorResumen('')
    obtenerReporte(equipo)
      .then((r) => {
        if (vigente) setReporte(r)
      })
      .catch(() => {
        if (vigente) {
          setReporte(null)
          setError('No se pudo cargar el reporte de este equipo.')
        }
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [equipo])

  async function pedirResumen() {
    const objetivo = equipo
    setCargandoResumen(true)
    setErrorResumen('')
    setResumen('')
    setFuente('')
    try {
      const r = await obtenerResumen(objetivo)
      if (objetivo === equipo) {
        setResumen(r.resumen)
        setFuente(r.fuente ?? 'nova')
      }
    } catch {
      setErrorResumen('No se pudo generar el resumen. El reporte de arriba sigue siendo válido.')
    } finally {
      setCargandoResumen(false)
    }
  }

  const datosGrafica = (reporte?.por_posicion ?? []).map((p) => ({ ...p, tasaPct: Number((p.tasa * 100).toFixed(1)) }))
  // Se resalta en rojo el punto más débil (solo grupos con al menos 15 snaps o jugadas).
  const maxTasa = Math.max(0, ...datosGrafica.filter((p) => p.snaps >= 15).map((p) => p.tasaPct))
  const maxSituacion = Math.max(0, ...(reporte?.por_situacion ?? []).filter((f) => f.jugadas >= 15).map((f) => f.tasa_presion))

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <header className="flex flex-wrap items-end justify-between gap-4 rounded-lg border-b-4 border-rojo bg-marino p-5 shadow">
          <div>
            <h1 className="text-2xl font-bold text-white">Reporte del rival: protección del mariscal</h1>
            <p className="text-gray-200">Presiones permitidas por la línea ofensiva rival, semanas 1 a 8 de 2021.</p>
          </div>
          <label className="text-sm font-medium text-white">
            Equipo rival
            <select
              className="ml-2 rounded border-2 border-white bg-white px-3 py-2 text-base font-semibold text-marino"
              style={{ backgroundColor: BLANCO, color: MARINO, colorScheme: 'light' }}
              value={equipo}
              onChange={(e) => setEquipo(e.target.value)}
            >
              {equipos.map((e) => (
                <option key={e} value={e} style={{ backgroundColor: BLANCO, color: MARINO }}>{e}</option>
              ))}
            </select>
          </label>
        </header>

        {USAR_DATOS_FALSOS && (
          <p className="rounded bg-yellow-100 px-3 py-2 text-sm text-yellow-900">Mostrando datos de ejemplo, no reales.</p>
        )}
        {error && <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>}
        {cargando && <p className="text-gray-300">Cargando…</p>}

        {reporte && !cargando && (
          <>
            <section className="grid grid-cols-2 gap-4">
              <Tarjeta titulo="Jugadas de pase" valor={String(reporte.jugadas_pase)} />
              <Tarjeta titulo="Tasa de presión" valor={pct(reporte.tasa_presion)} />
            </section>

            <section className="rounded-lg border border-gray-700 border-t-4 border-t-rojo bg-neutral-900 p-4">
              <h2 className="mb-1 text-lg font-semibold text-white">Tasa de presión permitida por posición</h2>
              <p className="mb-2 text-sm text-gray-300">En rojo, la posición que más presión permite.</p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosGrafica}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="posicion" tick={{ fill: BLANCO }} stroke={TEXTO_SUAVE} />
                    <YAxis unit="%" tick={{ fill: TEXTO_SUAVE }} stroke={TEXTO_SUAVE} />
                    <Tooltip
                      formatter={(v) => [`${v}%`, 'Tasa']}
                      contentStyle={{ backgroundColor: '#013369', border: `1px solid ${BLANCO}`, color: BLANCO }}
                      labelStyle={{ color: BLANCO }}
                      itemStyle={{ color: BLANCO }}
                      cursor={{ fill: 'rgba(255,255,255,0.08)' }}
                    />
                    <Bar dataKey="tasaPct">
                      {datosGrafica.map((p) => (
                        <Cell key={p.posicion} fill={p.tasaPct === maxTasa ? ROJO : BLANCO} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-lg border border-gray-700 border-t-4 border-t-rojo bg-neutral-900 p-4">
              <h2 className="mb-2 text-lg font-semibold text-white">Por situación</h2>
              <table className="w-full text-left text-sm">
                <thead className="bg-marino text-white">
                  <tr>
                    <th className="px-2 py-2">Situación</th>
                    <th className="px-2 py-2 text-right">Jugadas</th>
                    <th className="px-2 py-2 text-right">Tasa de presión</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.por_situacion.map((f) => (
                    <tr
                      key={f.situacion}
                      className={`border-b border-gray-700 last:border-0 ${
                        f.tasa_presion === maxSituacion ? 'bg-rojo font-bold text-white' : 'text-gray-100'
                      }`}
                    >
                      <td className="px-2 py-2">{f.situacion}</td>
                      <td className="px-2 py-2 text-right">{f.jugadas}</td>
                      <td className="px-2 py-2 text-right">{pct(f.tasa_presion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="rounded-lg border-t-4 border-rojo p-4 shadow" style={{ backgroundColor: MARINO }}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Resumen para el coach</h2>
                <button
                  className="rounded border-2 border-white bg-rojo px-4 py-2 font-semibold text-white hover:bg-white hover:text-marino disabled:opacity-50"
                  onClick={pedirResumen}
                  disabled={cargandoResumen}
                >
                  {cargandoResumen ? 'Generando…' : 'Resumen para el coach'}
                </button>
              </div>
              {errorResumen && <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-800">{errorResumen}</p>}
              {resumen && <p className="whitespace-pre-line text-gray-100">{resumen}</p>}
              {fuente === 'automatico' && (
                <p className="mt-2 text-xs text-gray-300">Resumen automático: Nova no estuvo disponible en este momento.</p>
              )}
              {fuente === 'nova' && <p className="mt-2 text-xs text-gray-300">Generado por Amazon Nova.</p>}
            </section>
          </>
        )}
      </main>
    </div>
  )
}