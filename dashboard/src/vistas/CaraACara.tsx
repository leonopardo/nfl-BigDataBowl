import { api } from '../api'
import FormacionLinea, { posCampo, type ValorPos } from '../componentes/FormacionLinea'
import { Cargando, ErrorCaja, Explica, Pie, Seccion, Tarjeta } from '../componentes/Piezas'
import { useCarga, useContador } from '../hooks'
import type { Filtros } from '../tipos'
import { pct } from '../util'

function Medidor({ etiqueta, valor, liga, color }: { etiqueta: string; valor: number; liga: number; color: string }) {
  const v = useContador(valor * 100)
  const max = 60
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span>{etiqueta}</span><strong>{v.toFixed(1)}%</strong></div>
      <div className="relative h-5 rounded bg-neutral-800">
        <div className="barra h-5 rounded" style={{ width: `${Math.min(100, (valor * 100 / max) * 100)}%`, background: color }} />
        <div className="absolute top-0 h-5 w-0.5 bg-yellow-300" style={{ left: `${(liga * 100 / max) * 100}%` }} title="Promedio de la liga" />
      </div>
    </div>
  )
}

export default function CaraACara({ ataque, defensa, filtros }: { ataque: string; defensa: string; filtros: Filtros }) {
  const f = JSON.stringify(filtros)
  const activo = !!ataque && !!defensa
  const { datos: c, cargando, error } = useCarga(() => api.caraACara(ataque, defensa, filtros), [ataque, defensa, f], activo)
  const { datos: r } = useCarga(() => api.reporte(ataque, filtros), [ataque, f], activo)

  if (!defensa) {
    return <p className="rounded-lg border border-dashed border-gray-600 p-6 text-gray-300">Elija arriba <strong>su defensa</strong> para compararla con la línea ofensiva de {ataque || 'un rival'}.</p>
  }
  if (cargando && !c) return <Cargando />
  if (error) return <ErrorCaja texto={error} />
  if (!c) return null

  const valores: Record<string, ValorPos> = {}
  if (r) for (const p of r.por_posicion) valores[p.posicion] = { valor: p.tasa, muestra: p.muestra }
  const refPos = r ? r.por_posicion.filter((p) => ['LT', 'LG', 'C', 'RG', 'RT'].includes(p.posicion) && p.tasa_liga != null) : []
  const referencia = refPos.length ? refPos.reduce((s, p) => s + (p.tasa_liga as number), 0) / refPos.length : 0.06

  // Ilustración: los mejores rushers apuntan a las posiciones de los eslabones más débiles.
  const flechas = c.mejores_rushers.slice(0, 3).flatMap((rs, i) => {
    const debil = c.eslabones_debiles[i]
    return debil && posCampo(debil.posicion) ? [{ desde: i, hasta: debil.posicion, etiqueta: rs.nombre.split(' ').slice(-1)[0] }] : []
  })

  const dif = c.esperada - c.tasa_liga
  return (
    <div className="space-y-5">
      <Explica titulo="Qué es la presión esperada">
        <p>Combinamos dos cosas: cuánta presión <strong>permite</strong> la línea de {ataque} y cuánta <strong>logra</strong> la defensa de {defensa}. Si las dos están por encima del promedio, la presión esperada sube más todavía. Es una estimación, no un pronóstico.</p>
      </Explica>

      <div className="grid gap-4 md:grid-cols-3">
        <Tarjeta titulo="Presión esperada del duelo" valor={pct(c.esperada)} detalle={`${dif >= 0 ? '+' : ''}${(dif * 100).toFixed(1)} puntos vs. la liga (${pct(c.tasa_liga)})`} />
        <Tarjeta titulo={`${ataque} permite`} valor={pct(c.ataque_permite)} detalle={`${c.jugadas_ataque} jugadas de pase`} />
        <Tarjeta titulo={`${defensa} logra`} valor={pct(c.defensa_genera)} detalle={`${c.jugadas_defensa} jugadas de pase rivales`} />
      </div>

      <Seccion titulo="Cada barra, comparada con la liga" sub="La marca amarilla es el promedio de la liga.">
        <div className="space-y-3">
          <Medidor etiqueta={`${ataque} permite (su línea ofensiva)`} valor={c.ataque_permite} liga={c.tasa_liga} color="#f3f4f6" />
          <Medidor etiqueta={`${defensa} logra (su defensa)`} valor={c.defensa_genera} liga={c.tasa_liga} color="#22c55e" />
          <Medidor etiqueta="Presión esperada en el duelo" valor={c.esperada} liga={c.tasa_liga} color="#D50A0A" />
        </div>
      </Seccion>

      <Seccion titulo="Dónde atacar" sub={`La línea de ${ataque} coloreada por presión permitida. Las flechas amarillas conectan a los mejores rushers de ${defensa} con los eslabones más débiles (idea de ataque, no el acomodo real).`}>
        <div className="grid gap-4 md:grid-cols-5">
          <div className="md:col-span-3">
            <FormacionLinea valores={valores} referencia={referencia} flechas={flechas} alt={`Línea de ${ataque} y rushers de ${defensa}`} />
          </div>
          <div className="space-y-3 md:col-span-2">
            <div>
              <h4 className="mb-1 text-sm font-semibold text-red-300">Eslabones débiles de {ataque}</h4>
              <ul className="space-y-1 text-sm">
                {c.eslabones_debiles.map((b) => <li key={b.id} className="rounded bg-neutral-800 px-2 py-1">{b.nombre} ({b.posicion}): presión en <strong>{pct(b.tasa)}</strong> de {b.snaps} snaps</li>)}
                {c.eslabones_debiles.length === 0 && <li className="text-gray-400">Sin datos suficientes.</li>}
              </ul>
            </div>
            <div>
              <h4 className="mb-1 text-sm font-semibold text-green-300">Mejores rushers de {defensa}</h4>
              <ul className="space-y-1 text-sm">
                {c.mejores_rushers.map((b) => <li key={b.id} className="rounded bg-neutral-800 px-2 py-1">{b.nombre} ({b.posicion}): presión en <strong>{pct(b.tasa)}</strong> de {b.snaps} snaps</li>)}
                {c.mejores_rushers.length === 0 && <li className="text-gray-400">Sin datos suficientes.</li>}
              </ul>
            </div>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="En qué situaciones se espera más presión" sub="De mayor a menor. Mientras más arriba, mejor momento para atacar.">
        <div className="space-y-2">
          {c.por_situacion.map((s, i) => (
            <div key={s.situacion} className="grid grid-cols-12 items-center gap-2 text-sm">
              <div className="col-span-4">{i === 0 && <span className="mr-1 text-yellow-300">★</span>}{s.situacion}</div>
              <div className="col-span-6">
                <div className="relative h-4 rounded bg-neutral-800">
                  <div className="barra h-4 rounded bg-rojo" style={{ width: `${Math.min(100, s.esperada * 100 / 0.8 * 1)}%` }} />
                  <div className="absolute top-0 h-4 w-0.5 bg-yellow-300" style={{ left: `${Math.min(100, s.liga * 100 / 0.8)}%` }} />
                </div>
              </div>
              <div className="col-span-2 text-right font-semibold">{pct(s.esperada)}</div>
            </div>
          ))}
        </div>
        <Pie>{c.nota}</Pie>
      </Seccion>
    </div>
  )
}
