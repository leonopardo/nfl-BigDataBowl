import { useState } from 'react'
import { api } from '../api'
import BlitzCampo from '../componentes/BlitzCampo'
import { Cargando, ErrorCaja, Explica, Insignia, Pie, Seccion } from '../componentes/Piezas'
import { useCarga, useContador } from '../hooks'
import type { Filtros } from '../tipos'
import { NOMBRE_SITUACION_CORTO, pct } from '../util'

const OPCIONES = [
  { n: 3, clave: '3 o menos' },
  { n: 4, clave: '4' },
  { n: 5, clave: '5' },
  { n: 6, clave: '6' },
  { n: 7, clave: '7 o más' },
]

function Dato({ etiqueta, valor, sufijo = '', dec = 1 }: { etiqueta: string; valor: number; sufijo?: string; dec?: number }) {
  const v = useContador(valor)
  return (
    <div className="rounded-lg bg-marino p-3 text-center">
      <p className="text-3xl font-extrabold text-white">{v.toFixed(dec)}{sufijo}</p>
      <p className="text-xs text-gray-200">{etiqueta}</p>
    </div>
  )
}

export default function Blitz({ defensa, filtros }: { defensa: string; filtros: Filtros }) {
  const [n, setN] = useState(4)
  const { datos: b, cargando, error } = useCarga(() => api.blitz(defensa, filtros), [defensa, JSON.stringify(filtros)])

  const fila = b?.por_rushers.find((r) => r.rushers === OPCIONES.find((o) => o.n === n)?.clave)
  const base = b?.por_rushers.find((r) => r.rushers === '4')
  const poco = !fila || fila.n < 30

  return (
    <div className="space-y-5">
      <Explica titulo="¿Qué es un blitz?">
        <p>Normalmente la defensa manda <strong>4</strong> jugadores a buscar al mariscal. En un <strong>blitz</strong> manda 5 o más. Presionan más, pero quedan menos defensores cubriendo a los receptores.</p>
        <p>Mueva el control para ver qué pasa en la cancha y qué dicen los datos de cada caso.</p>
      </Explica>

      <Seccion titulo="¿Cuántos rushers conviene mandar?" sub={defensa ? `Datos de la defensa de ${defensa}.` : 'Datos de toda la liga. Elija una defensa arriba para ver la de un equipo.'}>
        {cargando && !b && <Cargando />}
        <ErrorCaja texto={error} />
        <div className="grid gap-4 md:grid-cols-5">
          <div className="md:col-span-3">
            <BlitzCampo rushers={n} />
            <div className="no-imprimir mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Número de rushers">
              <span className="text-sm text-gray-300">Rushers:</span>
              {OPCIONES.map((o) => (
                <button key={o.n} role="radio" aria-checked={o.n === n} onClick={() => setN(o.n)}
                  className={`h-10 w-10 rounded-full border-2 text-lg font-bold ${o.n === n ? 'border-white bg-rojo text-white' : 'border-gray-500 text-gray-200 hover:bg-gray-800'}`}>
                  {o.n}{o.n === 7 ? '+' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            {fila && fila.n > 0 ? (
              <>
                <p className="mb-2 text-sm text-gray-300">{fila.n.toLocaleString('es-MX')} jugadas con {fila.rushers} rushers{poco && <em className="ml-1 text-yellow-300">(pocas jugadas)</em>}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Dato etiqueta="jugadas con presión" valor={(fila.presion?.tasa ?? 0) * 100} sufijo="%" />
                  <Dato etiqueta="yardas permitidas por pase" valor={fila.yardas ?? 0} />
                  <Dato etiqueta="pases completos" valor={(fila.completo?.tasa ?? 0) * 100} sufijo="%" />
                  <Dato etiqueta="sacks" valor={(fila.sack?.tasa ?? 0) * 100} sufijo="%" />
                </div>
                {base && n !== 4 && base.n > 0 && (
                  <p className="aparece mt-3 rounded bg-neutral-800 p-3 text-sm text-gray-100">
                    Comparado con mandar 4: presión {(((fila.presion?.tasa ?? 0) - (base.presion?.tasa ?? 0)) * 100).toFixed(1)} puntos {((fila.presion?.tasa ?? 0) >= (base.presion?.tasa ?? 0)) ? 'más' : 'menos'}, y {Math.abs((fila.yardas ?? 0) - (base.yardas ?? 0)).toFixed(1)} yardas {((fila.yardas ?? 0) <= (base.yardas ?? 0)) ? 'menos' : 'más'} permitidas por pase.
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-300">No hay jugadas con {n} rushers y estos filtros.</p>
            )}
            {b && b.frecuencia_blitz != null && (
              <p className="mt-3 text-sm text-gray-300">{defensa || 'La liga'} manda 5 o más rushers en el <strong className="text-white">{pct(b.frecuencia_blitz)}</strong> de los pases{defensa ? ` (la liga: ${pct(b.frecuencia_blitz_liga)})` : ''}.</p>
            )}
          </div>
        </div>
      </Seccion>

      {b && (
        <Seccion titulo="¿En qué situación vale la pena?" sub="Se compara mandar 4 con mandar 5 o más, en cada situación. Se decide por las yardas que permite la defensa.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-marino text-white">
                <tr>
                  <th className="px-2 py-2">Situación</th>
                  <th className="px-2 py-2 text-right">Presión con 4</th>
                  <th className="px-2 py-2 text-right">Presión con 5+</th>
                  <th className="px-2 py-2 text-right">Yardas con 4</th>
                  <th className="px-2 py-2 text-right">Yardas con 5+</th>
                  <th className="px-2 py-2">Veredicto</th>
                </tr>
              </thead>
              <tbody>
                {b.por_situacion.map((s) => (
                  <tr key={s.situacion} className="border-b border-gray-700">
                    <td className="px-2 py-2">{NOMBRE_SITUACION_CORTO[s.situacion] ?? s.situacion}</td>
                    <td className="px-2 py-2 text-right">{pct(s.cuatro.presion)} <span className="text-xs text-gray-400">({s.cuatro.n})</span></td>
                    <td className="px-2 py-2 text-right">{pct(s.cinco_o_mas.presion)} <span className="text-xs text-gray-400">({s.cinco_o_mas.n})</span></td>
                    <td className="px-2 py-2 text-right">{s.cuatro.yardas?.toFixed(1) ?? '—'}</td>
                    <td className="px-2 py-2 text-right">{s.cinco_o_mas.yardas?.toFixed(1) ?? '—'}</td>
                    <td className="px-2 py-2"><Insignia codigo={s.veredicto.codigo} texto={s.veredicto.texto} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pie>Entre paréntesis, el número de jugadas. "Sí vale la pena" significa que con 5 o más rushers la defensa permitió al menos 0.7 yardas menos por pase y hubo más presión. {b.nota}</Pie>
        </Seccion>
      )}

      {b && b.por_cobertura.length > 0 && (
        <Seccion titulo="Según el tipo de cobertura" sub="Hombre a hombre (Man) contra zona (Zone): en zona, cada defensor cuida un espacio; en hombre, a un receptor.">
          <div className="grid gap-3 sm:grid-cols-3">
            {b.por_cobertura.map((c) => (
              <div key={c.cobertura} className="rounded-lg bg-neutral-800 p-3">
                <p className="font-semibold">{c.cobertura === 'Man' ? 'Hombre a hombre' : c.cobertura === 'Zone' ? 'Zona' : 'Otra'}</p>
                <p className="text-xs text-gray-400">{c.n} jugadas</p>
                <p className="mt-1 text-sm">Pases completos: <strong>{pct(c.completo)}</strong></p>
                <p className="text-sm">Presión: <strong>{pct(c.presion)}</strong></p>
                <p className="text-sm">Yardas por pase: <strong>{c.yardas?.toFixed(1) ?? '—'}</strong></p>
              </div>
            ))}
          </div>
        </Seccion>
      )}
    </div>
  )
}
