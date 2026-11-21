import { useState } from 'react'
import { api } from '../api'
import ExplicadorPresion from '../componentes/ExplicadorPresion'
import { Cargando, ErrorCaja, Explica, Pie, Seccion } from '../componentes/Piezas'
import { useCarga, useContador } from '../hooks'
import type { Filtros, Metricas } from '../tipos'
import { pct } from '../util'

function Lado({ titulo, m, color, maxYardas }: { titulo: string; m: Metricas; color: string; maxYardas: number }) {
  const yardas = useContador(m.yardas ?? 0)
  const comp = useContador((m.completo?.tasa ?? 0) * 100)
  const sack = useContador((m.sack?.tasa ?? 0) * 100)
  const inter = useContador((m.intercepcion?.tasa ?? 0) * 100)
  return (
    <div className="rounded-lg p-4" style={{ background: color }}>
      <p className="text-sm font-semibold uppercase tracking-wide text-white/80">{titulo}</p>
      <p className="mt-1 text-xs text-white/70">{m.n.toLocaleString('es-MX')} jugadas</p>
      <p className="mt-3 text-5xl font-extrabold text-white">{yardas.toFixed(1)}</p>
      <p className="text-sm text-white/80">yardas por jugada de pase</p>
      <div className="mt-4 space-y-3">
        <Barra etiqueta="Pases completos" valor={comp} max={100} />
        <Barra etiqueta="Sacks" valor={sack} max={30} />
        <Barra etiqueta="Intercepciones" valor={inter} max={10} />
      </div>
      <div className="mt-4 h-3 rounded bg-black/30" title="Yardas por jugada">
        <div className="barra h-3 rounded bg-white" style={{ width: `${Math.max(0, (yardas / maxYardas) * 100)}%` }} />
      </div>
    </div>
  )
}

function Barra({ etiqueta, valor, max }: { etiqueta: string; valor: number; max: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm text-white"><span>{etiqueta}</span><span className="font-bold">{valor.toFixed(1)}%</span></div>
      <div className="h-2 rounded bg-black/30"><div className="barra h-2 rounded bg-white/90" style={{ width: `${Math.min(100, (valor / max) * 100)}%` }} /></div>
    </div>
  )
}

export default function Costo({ equipo, filtros }: { equipo: string; filtros: Filtros }) {
  const [soloEquipo, setSoloEquipo] = useState(false)
  const [sinSacks, setSinSacks] = useState(false)
  const objetivo = soloEquipo ? equipo : ''
  const { datos: c, cargando, error } = useCarga(() => api.costo(objetivo, filtros), [objetivo, JSON.stringify(filtros)])

  const con = c ? (sinSacks ? c.sin_sacks.con_presion : c.con_presion) : null
  const sin = c ? (sinSacks ? c.sin_sacks.sin_presion : c.sin_presion) : null
  const dif = c ? (sinSacks ? c.sin_sacks.diferencia : c.diferencia) : null

  return (
    <div className="space-y-5">
      <Seccion titulo="¿Qué es la presión?" sub="Mire la animación: tres niveles de presión, de menor a mayor.">
        <ExplicadorPresion />
      </Seccion>

      <Seccion titulo="¿Cuánto le cuesta la presión a un ataque?" sub="Mismas jugadas de pase, divididas según si el mariscal fue presionado o no.">
        <div className="no-imprimir mb-4 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={soloEquipo} onChange={(e) => setSoloEquipo(e.target.checked)} /> Solo {equipo || 'el equipo elegido'} (si no, toda la liga)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={sinSacks} onChange={(e) => setSinSacks(e.target.checked)} /> Quitar los sacks del cálculo</label>
        </div>
        {cargando && !c && <Cargando />}
        <ErrorCaja texto={error} />
        {c && con && sin && con.n > 0 && sin.n > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Lado titulo="Sin presión" m={sin} color="#14532d" maxYardas={10} />
              <Lado titulo="Con presión" m={con} color="#7f1d1d" maxYardas={10} />
            </div>
            {dif && (
              <p className="aparece mt-4 rounded-lg bg-marino p-4 text-lg text-white">
                La presión le quita <strong>{dif.yardas.toFixed(1)} yardas</strong> a cada pase y baja los pases completos en <strong>{(dif.completo * 100).toFixed(0)} puntos</strong>
                {sinSacks ? ' (sin contar los sacks).' : '.'}
              </p>
            )}
            <Pie>{c.nota}</Pie>
          </>
        )}
        {c && (con?.n === 0 || sin?.n === 0) && <p className="text-gray-300">No hay suficientes jugadas con estos filtros.</p>}
      </Seccion>

      {c && (
        <Seccion titulo="Por situación" sub="Yardas por pase con y sin presión. La brecha muestra en qué momento más duele la presión.">
          <div className="space-y-3">
            {c.por_situacion.map((s) => {
              const a = s.sin_presion.yardas ?? 0
              const b = s.con_presion.yardas ?? 0
              const poco = s.con_presion.n < 15 || s.sin_presion.n < 15
              return (
                <div key={s.situacion} className={poco ? 'opacity-50' : ''}>
                  <div className="mb-1 flex justify-between text-sm"><span>{s.situacion}{poco && <em className="ml-2 text-xs text-yellow-300">pocas jugadas</em>}</span><span className="text-gray-300">{s.n} jugadas · brecha {(a - b).toFixed(1)} yd</span></div>
                  <div className="space-y-1">
                    <div className="h-3 rounded bg-neutral-800"><div className="barra h-3 rounded bg-green-600" style={{ width: `${Math.max(0, Math.min(100, (a / 12) * 100))}%` }} /></div>
                    <div className="h-3 rounded bg-neutral-800"><div className="barra h-3 rounded bg-red-600" style={{ width: `${Math.max(0, Math.min(100, (b / 12) * 100))}%` }} /></div>
                  </div>
                </div>
              )
            })}
          </div>
          <Pie><span className="text-green-500">■</span> sin presión · <span className="text-red-500">■</span> con presión. Pases completos con presión: {pct(c.con_presion.completo?.tasa)}; sin presión: {pct(c.sin_presion.completo?.tasa)}.</Pie>
        </Seccion>
      )}

      <Explica titulo="Para leer con cuidado">
        <p>Las jugadas con presión terminan peor, pero parte de la diferencia viene de que un mariscal presionado suelta el balón antes o a un lugar más difícil. Por eso es una asociación, no una prueba de causa.</p>
      </Explica>
    </div>
  )
}
