import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import FormacionLinea, { type ValorPos } from '../componentes/FormacionLinea'
import { AvisoMuestra, BarraIC, Cargando, ErrorCaja, Explica, Pie, Seccion, Tarjeta } from '../componentes/Piezas'
import { useCarga } from '../hooks'
import type { Filtros, Resumen } from '../tipos'
import { BLANCO, ROJO, TEXTO_SUAVE, pct } from '../util'

export default function Rival({ equipo, filtros }: { equipo: string; filtros: Filtros }) {
  const { datos: r, cargando, error } = useCarga(() => api.reporte(equipo, filtros), [equipo, JSON.stringify(filtros)], !!equipo)
  const [sel, setSel] = useState<string | null>(null)
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [errorRes, setErrorRes] = useState('')
  const [pidiendo, setPidiendo] = useState(false)

  async function pedirResumen() {
    setPidiendo(true)
    setErrorRes('')
    setResumen(null)
    try {
      setResumen(await api.resumen(equipo))
    } catch {
      setErrorRes('No se pudo generar el resumen. El reporte de arriba sigue siendo válido.')
    } finally {
      setPidiendo(false)
    }
  }

  if (cargando && !r) return <Cargando />
  if (error) return <ErrorCaja texto={error} />
  if (!r) return null

  const valores: Record<string, ValorPos> = {}
  for (const p of r.por_posicion) valores[p.posicion] = { valor: p.tasa, muestra: p.muestra }
  const lineaMax = Math.max(0, ...r.por_posicion.filter((p) => ['LT', 'LG', 'C', 'RG', 'RT'].includes(p.posicion) && p.muestra !== 'insuficiente').map((p) => p.tasa))
  const refPos = r.por_posicion.filter((p) => p.tasa_liga != null && ['LT', 'LG', 'C', 'RG', 'RT'].includes(p.posicion))
  const refMedia = refPos.length ? refPos.reduce((s, p) => s + (p.tasa_liga as number), 0) / refPos.length : 0.06
  const elegido = r.por_posicion.find((p) => p.posicion === sel)
  const dif = r.tasa_presion - r.tasa_presion_liga
  const grafica = r.por_posicion.filter((p) => p.muestra !== 'insuficiente').map((p) => ({ ...p, pctTasa: Number((p.tasa * 100).toFixed(1)), pctLiga: p.tasa_liga == null ? null : Number((p.tasa_liga * 100).toFixed(1)) }))
  const maxSit = Math.max(0.01, ...r.por_situacion.map((s) => s.ic_alto ?? s.tasa_presion))
  const peorSit = Math.max(0, ...r.por_situacion.filter((s) => s.muestra !== 'insuficiente').map((s) => s.tasa_presion))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tarjeta titulo="Jugadas de pase" valor={String(r.jugadas_pase)} detalle={Object.keys(r.filtros).length ? 'con los filtros activos' : 'semanas 1 a 8'} />
        <Tarjeta titulo="Tasa de presión" valor={pct(r.tasa_presion)} detalle={`${dif >= 0 ? '+' : ''}${(dif * 100).toFixed(1)} puntos vs. la liga (${pct(r.tasa_presion_liga)})`} />
        <Tarjeta titulo="Posición más débil" valor={lineaMax ? (r.por_posicion.find((p) => p.tasa === lineaMax)?.posicion ?? '—') : '—'} detalle={lineaMax ? `${pct(lineaMax)} de sus snaps con presión` : undefined} />
        <Tarjeta titulo="Peor situación" valor={peorSit ? (r.por_situacion.find((s) => s.tasa_presion === peorSit)?.situacion.replace('3ª/4ª', '3ª/4ª').split(' (')[0] ?? '—') : '—'} detalle={peorSit ? `${pct(peorSit)} de presión` : undefined} />
      </div>

      <Explica titulo="Cómo leer esta pantalla">
        <p>Cada círculo es un bloqueador de la línea ofensiva rival. Su color muestra cuánta presión permite comparado con el promedio de la liga: <strong>verde</strong> protege mejor, <strong>rojo</strong> peor. Toque un círculo para ver el detalle.</p>
      </Explica>

      <Seccion titulo="La línea ofensiva rival" sub="Presión permitida por posición. Los círculos tenues tienen muy pocas jugadas.">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="md:col-span-3">
            <FormacionLinea valores={valores} referencia={refMedia} seleccion={sel} onSeleccion={setSel} alt={`Línea ofensiva de ${equipo} coloreada por presión permitida`} />
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-300">
              <span>Mejor que la liga</span>
              <div className="h-2 flex-1 rounded" style={{ background: 'linear-gradient(90deg, hsl(135,78%,48%), hsl(65,78%,45%), hsl(0,78%,42%))' }} />
              <span>Peor que la liga</span>
            </div>
          </div>
          <div className="md:col-span-2">
            {elegido ? (
              <div className="aparece rounded-lg bg-marino p-4" key={elegido.posicion}>
                <p className="text-sm text-gray-200">Posición</p>
                <p className="text-3xl font-bold">{elegido.posicion}<AvisoMuestra muestra={elegido.muestra} /></p>
                <p className="mt-2 text-gray-100">Permitió presión en <strong>{pct(elegido.tasa)}</strong> de {elegido.snaps} snaps ({elegido.presiones} presiones, {elegido.sacks} sacks).</p>
                <p className="mt-1 text-sm text-gray-300">La liga: {pct(elegido.tasa_liga)}. Margen de error (95 %): {pct(elegido.ic_bajo)} a {pct(elegido.ic_alto)}.</p>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-gray-600 p-4 text-sm text-gray-400">Toque una posición de la cancha para ver su detalle.</p>
            )}
            <div className="mt-3 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafica} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="posicion" tick={{ fill: BLANCO }} stroke={TEXTO_SUAVE} />
                  <YAxis unit="%" tick={{ fill: TEXTO_SUAVE }} stroke={TEXTO_SUAVE} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Tasa']} contentStyle={{ backgroundColor: '#013369', border: `1px solid ${BLANCO}`, color: BLANCO }} labelStyle={{ color: BLANCO }} itemStyle={{ color: BLANCO }} cursor={{ fill: 'rgba(255,255,255,0.08)' }} />
                  <Bar dataKey="pctTasa" onClick={(d) => setSel((d as unknown as { posicion: string }).posicion)}>
                    {grafica.map((p) => <Cell key={p.posicion} fill={p.tasa === lineaMax ? ROJO : BLANCO} />)}
                  </Bar>
                  {refMedia > 0 && <ReferenceLine y={refMedia * 100} stroke="#fde047" strokeDasharray="4 3" />}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Pie>Línea amarilla: promedio de la liga en la línea ofensiva. Se ocultan las posiciones con menos de 15 snaps.</Pie>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Presión por situación" sub="La barra es la tasa de presión; la línea blanca, el margen de error; la marca amarilla, el promedio de la liga.">
        <div className="space-y-2">
          {r.por_situacion.map((s) => (
            <div key={s.situacion} className={`grid grid-cols-12 items-center gap-2 rounded px-2 py-1 ${s.tasa_presion === peorSit && s.muestra !== 'insuficiente' ? 'bg-rojo/30' : ''}`}>
              <div className="col-span-4 text-sm">{s.situacion}<AvisoMuestra muestra={s.muestra} /></div>
              <div className="col-span-5"><BarraIC valor={s.tasa_presion} bajo={s.ic_bajo} alto={s.ic_alto} liga={s.tasa_liga} max={Math.min(1, maxSit * 1.05)} color={s.muestra === 'insuficiente' ? '#6b7280' : s.tasa_presion === peorSit ? ROJO : '#f3f4f6'} /></div>
              <div className="col-span-1 text-right text-xs text-gray-300">{s.jugadas}</div>
              <div className="col-span-2 text-right text-sm font-semibold">{pct(s.tasa_presion)}</div>
            </div>
          ))}
        </div>
        <Pie>La columna pequeña es el número de jugadas.</Pie>
      </Seccion>

      {r.por_formacion.length > 0 && (
        <Seccion titulo="Por formación">
          <div className="grid gap-2 sm:grid-cols-2">
            {r.por_formacion.map((f) => (
              <div key={f.formacion} className="grid grid-cols-12 items-center gap-2 text-sm">
                <div className="col-span-4">{f.formacion}<AvisoMuestra muestra={f.muestra} /></div>
                <div className="col-span-6"><BarraIC valor={f.tasa_presion} bajo={f.ic_bajo} alto={f.ic_alto} liga={f.tasa_liga} max={0.8} color="#f3f4f6" /></div>
                <div className="col-span-2 text-right">{pct(f.tasa_presion)}</div>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      <section className="tarjeta-imprimir rounded-lg border-t-4 border-rojo bg-marino p-4 shadow">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">Resumen para el coach</h2>
          <button className="no-imprimir rounded border-2 border-white bg-rojo px-4 py-2 font-semibold text-white hover:bg-white hover:text-marino disabled:opacity-50" onClick={pedirResumen} disabled={pidiendo}>
            {pidiendo ? 'Generando…' : 'Generar resumen'}
          </button>
        </div>
        <ErrorCaja texto={errorRes} />
        {resumen && <p className="whitespace-pre-line text-gray-100">{resumen.resumen}</p>}
        {resumen?.fuente === 'automatico' && <p className="mt-2 text-xs text-gray-300">Resumen automático: Nova no estuvo disponible en este momento.</p>}
        {resumen?.fuente === 'nova' && <p className="mt-2 text-xs text-gray-300">Generado por Amazon Nova.</p>}
      </section>
    </div>
  )
}
