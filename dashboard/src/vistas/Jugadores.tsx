import { useState } from 'react'
import { api } from '../api'
import FormacionLinea, { type ValorPos } from '../componentes/FormacionLinea'
import { AvisoMuestra, BarraIC, Cargando, ErrorCaja, Explica, Pie, Seccion } from '../componentes/Piezas'
import { useCarga } from '../hooks'
import type { Duelos, Filtros, JugadorFila } from '../tipos'
import { ROJO, pct } from '../util'

const TIPOS = ['Borde', 'Interior', 'Linebacker'] as const
const EXPLICA_TIPO: Record<string, string> = {
  Borde: 'Defensores que se paran en las orillas de la línea (ends y linebackers de borde).',
  Interior: 'Defensores grandes que se paran en el centro de la línea (tackles interiores).',
  Linebacker: 'Linebackers que salen a presionar desde atrás de la línea.',
}

function Lista({ titulo, filas, color }: { titulo: string; filas: JugadorFila[]; color: string }) {
  const max = Math.max(0.1, ...filas.map((f) => f.ic_alto ?? f.tasa))
  return (
    <div>
      <h3 className="mb-2 font-semibold text-white">{titulo}</h3>
      {filas.length === 0 && <p className="text-sm text-gray-400">Sin jugadores con suficientes snaps.</p>}
      <div className="space-y-2">
        {filas.slice(0, 8).map((f) => (
          <div key={f.id} className="grid grid-cols-12 items-center gap-2 text-sm">
            <div className="col-span-5 truncate" title={f.nombre}>{f.nombre} <span className="text-xs text-gray-400">{f.posicion}</span></div>
            <div className="col-span-5"><BarraIC valor={f.tasa} bajo={f.ic_bajo} alto={f.ic_alto} max={Math.min(1, max * 1.1)} color={color} /></div>
            <div className="col-span-2 text-right"><strong>{pct(f.tasa)}</strong><br /><span className="text-[10px] text-gray-400">{f.snaps} snaps</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function mapaDuelo(d: Duelos, tipo: string): { valores: Record<string, ValorPos>; referencia: number } {
  const filas = d.matriz.filter((m) => m.tipo === tipo)
  const tot = filas.reduce((s, m) => s + m.n, 0)
  const pres = filas.reduce((s, m) => s + m.presiono, 0)
  const valores: Record<string, ValorPos> = {}
  for (const m of filas) valores[m.posicion] = { valor: m.tasa, muestra: m.muestra, texto: `${pct(m.tasa, 0)} (${m.n})` }
  return { valores, referencia: tot ? pres / tot : 0.1 }
}

export default function Jugadores({ equipo, filtros }: { equipo: string; filtros: Filtros }) {
  const f = JSON.stringify(filtros)
  const { datos: j, cargando, error } = useCarga(() => api.jugadores(equipo, filtros), [equipo, f], !!equipo)
  const { datos: d } = useCarga(() => api.duelos(equipo, filtros), [equipo, f], !!equipo)
  const [tipo, setTipo] = useState<string>('Borde')
  const [sel, setSel] = useState<string | null>(null)

  if (cargando && !j) return <Cargando />
  if (error) return <ErrorCaja texto={error} />
  if (!j) return null

  const mapa = d ? mapaDuelo(d, tipo) : null
  const celda = d?.matriz.find((m) => m.tipo === tipo && m.posicion === sel)

  return (
    <div className="space-y-5">
      <Explica titulo="Qué muestran las barras">
        <p>Cada barra es el porcentaje de jugadas en que ese jugador permitió presión (bloqueadores) o la logró (rushers). La línea blanca es el margen de error: si es larga, hay pocas jugadas y la cifra es poco estable.</p>
      </Explica>

      <Seccion titulo={`Jugadores de ${equipo}`} sub="Bloqueadores de su línea ofensiva (los que más presión permiten, arriba) y rushers de su defensa (los que más presión logran, arriba).">
        <div className="grid gap-6 md:grid-cols-2">
          <Lista titulo="Bloqueadores: más presión permitida" filas={j.bloqueadores} color={ROJO} />
          <Lista titulo="Rushers: más presión lograda" filas={j.rushers} color="#22c55e" />
        </div>
        <Pie>Solo jugadores con al menos {j.min_snaps} snaps con los filtros activos.</Pie>
      </Seccion>

      <Seccion titulo="Duelos: quién le gana a quién" sub={`Contra la línea de ${equipo}: cuántas veces presionó cada tipo de defensor al bloqueador que tenía enfrente.`}>
        <div className="no-imprimir mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Tipo de defensor">
          {TIPOS.map((t) => (
            <button key={t} role="tab" aria-selected={t === tipo} onClick={() => setTipo(t)}
              className={`rounded border px-3 py-1 text-sm font-semibold ${t === tipo ? 'border-white bg-rojo text-white' : 'border-gray-500 text-gray-200 hover:bg-gray-800'}`}>{t}</button>
          ))}
        </div>
        <p className="mb-3 text-sm text-gray-300">{EXPLICA_TIPO[tipo]}</p>
        {mapa ? (
          <div className="grid gap-4 md:grid-cols-5">
            <div className="md:col-span-3">
              <FormacionLinea valores={mapa.valores} referencia={mapa.referencia} seleccion={sel} onSeleccion={setSel} alt={`Presión de los defensores de tipo ${tipo} contra cada posición de ${equipo}`} />
              <Pie>En cada círculo: porcentaje de snaps en que el defensor presionó, y entre paréntesis el número de snaps. Rojo = le ganan más que a otras posiciones.</Pie>
            </div>
            <div className="md:col-span-2">
              {celda ? (
                <div className="aparece rounded-lg bg-marino p-4" key={`${tipo}${sel}`}>
                  <p className="text-sm text-gray-200">{tipo} contra {celda.posicion}<AvisoMuestra muestra={celda.muestra} /></p>
                  <p className="text-3xl font-bold">{pct(celda.tasa)}</p>
                  <p className="text-sm text-gray-100">presionó en {celda.presiono} de {celda.n} snaps</p>
                  <p className="mt-1 text-xs text-gray-300">Margen de error: {pct(celda.ic_bajo)} a {pct(celda.ic_alto)}</p>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-gray-600 p-4 text-sm text-gray-400">Toque una posición para ver el detalle.</p>
              )}
              {d && d.pares.length > 0 && (
                <div className="mt-3">
                  <h4 className="mb-1 text-sm font-semibold">Duelos más repetidos</h4>
                  <ul className="space-y-1 text-sm">
                    {d.pares.slice(0, 5).map((p) => (
                      <li key={`${p.bloqueador}${p.defensor}`} className="rounded bg-neutral-800 px-2 py-1">
                        <strong>{p.defensor}</strong> ({p.def_pos}) contra <strong>{p.bloqueador}</strong> ({p.posicion}): presionó {p.presiono} de {p.n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Cargando />
        )}
        {d && <Pie>{d.nota}</Pie>}
      </Seccion>
    </div>
  )
}
