import { useState } from 'react'
import { api } from '../api'
import { Cargando, ErrorCaja, Seccion, Tarjeta } from '../componentes/Piezas'
import { useCarga } from '../hooks'
import type { Filtros, RespuestaIA, Resumen } from '../tipos'
import { pct } from '../util'

const EJEMPLOS = [
  '¿Qué posición de la línea ofensiva de KC permite más presión?',
  '¿Conviene mandar blitz en 3ª y larga?',
  '¿Cuánto cambian los pases completos cuando hay presión?',
]

export default function Plan({ ataque, defensa, filtros }: { ataque: string; defensa: string; filtros: Filtros }) {
  const activo = !!ataque && !!defensa
  const { datos: c, cargando, error } = useCarga(() => api.caraACara(ataque, defensa, filtros), [ataque, defensa, JSON.stringify(filtros)], activo)
  const [plan, setPlan] = useState<Resumen | null>(null)
  const [generando, setGenerando] = useState(false)
  const [errorPlan, setErrorPlan] = useState('')
  const [pregunta, setPregunta] = useState('')
  const [respuesta, setRespuesta] = useState<RespuestaIA | null>(null)
  const [errorIA, setErrorIA] = useState('')
  const [preguntando, setPreguntando] = useState(false)

  async function generar() {
    setGenerando(true)
    setErrorPlan('')
    setPlan(null)
    try {
      setPlan(await api.plan(ataque, defensa))
    } catch {
      setErrorPlan('No se pudo generar el plan. Los datos de abajo siguen siendo válidos.')
    } finally {
      setGenerando(false)
    }
  }

  async function preguntar(texto: string) {
    if (!texto.trim()) return
    setPreguntando(true)
    setErrorIA('')
    setRespuesta(null)
    try {
      setRespuesta(await api.analista(texto))
    } catch {
      setErrorIA('El analista de IA no está disponible en este momento. Las demás pantallas siguen funcionando con los datos.')
    } finally {
      setPreguntando(false)
    }
  }

  return (
    <div className="space-y-5">
      {!defensa ? (
        <p className="rounded-lg border border-dashed border-gray-600 p-6 text-gray-300">Elija arriba <strong>su defensa</strong> para armar el plan de juego contra {ataque || 'un rival'}.</p>
      ) : (
        <Seccion titulo={`Plan de juego: ${defensa} contra la línea de ${ataque}`} sub="Resumen en lenguaje simple, con las mismas cifras de las demás pantallas.">
          <div className="no-imprimir mb-3 flex flex-wrap gap-2">
            <button className="rounded border-2 border-white bg-rojo px-4 py-2 font-semibold hover:bg-white hover:text-marino disabled:opacity-50" onClick={generar} disabled={generando}>{generando ? 'Generando…' : 'Generar plan de juego'}</button>
            <button className="rounded border-2 border-white px-4 py-2 font-semibold hover:bg-white hover:text-marino" onClick={() => window.print()}>🖨 Imprimir</button>
          </div>
          <ErrorCaja texto={errorPlan} />
          {plan && (
            <div className="aparece rounded-lg bg-marino p-4">
              <p className="whitespace-pre-line text-white">{plan.resumen}</p>
              <p className="mt-2 text-xs text-gray-300">{plan.fuente === 'automatico' ? 'Plan automático calculado con los datos (la IA no estuvo disponible).' : 'Redactado por Amazon Nova a partir de los datos.'}</p>
            </div>
          )}
          {cargando && !c && <Cargando />}
          <ErrorCaja texto={error} />
          {c && (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Tarjeta titulo="Presión esperada" valor={pct(c.esperada)} detalle={`liga: ${pct(c.tasa_liga)}`} />
                <Tarjeta titulo={`${ataque} permite`} valor={pct(c.ataque_permite)} />
                <Tarjeta titulo={`${defensa} logra`} valor={pct(c.defensa_genera)} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <h3 className="mb-1 font-semibold">Mejores situaciones para atacar</h3>
                  <ol className="list-decimal pl-5 text-sm">
                    {c.por_situacion.slice(0, 3).map((s) => <li key={s.situacion}>{s.situacion}: <strong>{pct(s.esperada)}</strong></li>)}
                  </ol>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">Eslabones débiles de {ataque}</h3>
                  <ul className="list-disc pl-5 text-sm">
                    {c.eslabones_debiles.map((b) => <li key={b.id}>{b.nombre} ({b.posicion}): {pct(b.tasa)}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">Mejores rushers de {defensa}</h3>
                  <ul className="list-disc pl-5 text-sm">
                    {c.mejores_rushers.map((b) => <li key={b.id}>{b.nombre} ({b.posicion}): {pct(b.tasa)}</li>)}
                  </ul>
                </div>
              </div>
              <p className="text-xs text-gray-400">{c.nota}</p>
            </div>
          )}
        </Seccion>
      )}

      <Seccion titulo="Pregunte al analista" sub="Escriba una pregunta sobre los datos. La IA consulta funciones sobre los datos en lugar de inventar cifras. Es opcional: todo lo demás funciona sin ella.">
        <div className="no-imprimir">
          <div className="flex flex-wrap gap-2">
            {EJEMPLOS.map((e) => (
              <button key={e} className="rounded-full border border-gray-500 px-3 py-1 text-xs text-gray-200 hover:bg-gray-800" onClick={() => { setPregunta(e); preguntar(e) }}>{e}</button>
            ))}
          </div>
          <form className="mt-3 flex gap-2" onSubmit={(ev) => { ev.preventDefault(); preguntar(pregunta) }}>
            <input className="flex-1 rounded border border-gray-500 bg-white px-3 py-2 text-marino" style={{ colorScheme: 'light' }} placeholder="Ej.: ¿Qué equipo permite más presión en 3ª y larga?" value={pregunta} maxLength={500} onChange={(e) => setPregunta(e.target.value)} aria-label="Pregunta" />
            <button className="rounded border-2 border-white bg-rojo px-4 py-2 font-semibold disabled:opacity-50" disabled={preguntando || !pregunta.trim()}>{preguntando ? 'Pensando…' : 'Preguntar'}</button>
          </form>
        </div>
        <ErrorCaja texto={errorIA} />
        {respuesta && <p className="aparece mt-3 whitespace-pre-line rounded-lg bg-neutral-800 p-3 text-gray-100">{respuesta.respuesta}</p>}
      </Seccion>
    </div>
  )
}
