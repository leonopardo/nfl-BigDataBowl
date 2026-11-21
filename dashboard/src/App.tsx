import { useEffect, useState } from 'react'
import { api } from './api'
import FiltrosBarra from './componentes/FiltrosBarra'
import { ErrorCaja } from './componentes/Piezas'
import type { Filtros } from './tipos'
import Blitz from './vistas/Blitz'
import CaraACara from './vistas/CaraACara'
import Costo from './vistas/Costo'
import JugadaVista from './vistas/JugadaVista'
import Jugadores from './vistas/Jugadores'
import Plan from './vistas/Plan'
import Reloj from './vistas/Reloj'
import Rival from './vistas/Rival'

const MARINO = '#013369'

const VISTAS = [
  { id: 'rival', texto: 'Rival', ayuda: 'Dónde se rompe su línea' },
  { id: 'costo', texto: 'Costo de la presión', ayuda: 'Qué le quita al ataque' },
  { id: 'blitz', texto: 'Blitz', ayuda: '¿Cuántos rushers mandar?' },
  { id: 'jugadores', texto: 'Jugadores y duelos', ayuda: 'Quién le gana a quién' },
  { id: 'cara', texto: 'Cara a cara', ayuda: 'Mi defensa contra su línea' },
  { id: 'cancha', texto: 'Cancha en vivo', ayuda: 'Jugadas reales' },
  { id: 'reloj', texto: 'Reloj', ayuda: 'Cuánto tiempo tiene el mariscal' },
  { id: 'plan', texto: 'Plan de juego', ayuda: 'Resumen e imprimir' },
] as const
type VistaId = (typeof VISTAS)[number]['id']

const SELECT = 'ml-2 rounded border-2 border-white bg-white px-3 py-1.5 text-base font-semibold text-marino'

export default function App() {
  const [equipos, setEquipos] = useState<string[]>([])
  const [equipo, setEquipo] = useState('')
  const [defensa, setDefensa] = useState('')
  const [vista, setVista] = useState<VistaId>('rival')
  const [filtros, setFiltros] = useState<Filtros>({})
  const [error, setError] = useState('')

  useEffect(() => {
    api.equipos()
      .then((l) => {
        setEquipos(l)
        if (l.length) setEquipo(l.includes('KC') ? 'KC' : l[0])
      })
      .catch(() => setError('No se pudo cargar la lista de equipos. Revise que el backend esté corriendo y que los datos estén en data/.'))
  }, [])

  const necesitaDefensa = vista === 'cara' || vista === 'plan'
  const verDefensa = vista === 'blitz' || necesitaDefensa

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        <header className="no-imprimir rounded-lg border-b-4 border-rojo bg-marino p-5 shadow">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white md:text-3xl">Plan de juego: presión sobre el mariscal</h1>
              <p className="text-gray-200">Datos de la NFL, semanas 1 a 8 de 2021. Elija un rival y recorra las pantallas.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm font-medium text-white">
                Rival
                <select className={SELECT} style={{ backgroundColor: '#fff', color: MARINO, colorScheme: 'light' }} value={equipo} onChange={(e) => setEquipo(e.target.value)} aria-label="Equipo rival">
                  {equipos.map((e) => <option key={e} value={e} style={{ backgroundColor: '#fff', color: MARINO }}>{e}</option>)}
                </select>
              </label>
              {verDefensa && (
                <label className="aparece text-sm font-medium text-white">
                  Nuestra defensa
                  <select className={SELECT} style={{ backgroundColor: '#fff', color: MARINO, colorScheme: 'light' }} value={defensa} onChange={(e) => setDefensa(e.target.value)} aria-label="Nuestra defensa">
                    <option value="" style={{ backgroundColor: '#fff', color: MARINO }}>{necesitaDefensa ? 'Elegir…' : 'Toda la liga'}</option>
                    {equipos.map((e) => <option key={e} value={e} style={{ backgroundColor: '#fff', color: MARINO }}>{e}</option>)}
                  </select>
                </label>
              )}
            </div>
          </div>
          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Pantallas">
            {VISTAS.map((v) => (
              <button
                key={v.id}
                onClick={() => setVista(v.id)}
                title={v.ayuda}
                aria-current={v.id === vista ? 'page' : undefined}
                className={`rounded border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${v.id === vista ? 'border-white bg-rojo text-white' : 'border-white/40 text-gray-100 hover:border-white hover:bg-white/10'}`}
              >
                {v.texto}
              </button>
            ))}
          </nav>
        </header>

        <ErrorCaja texto={error} />
        {vista !== 'cancha' && vista !== 'reloj' && <FiltrosBarra filtros={filtros} onChange={setFiltros} />}

        {equipo && (
          <>
            {vista === 'rival' && <Rival equipo={equipo} filtros={filtros} />}
            {vista === 'costo' && <Costo equipo={equipo} filtros={filtros} />}
            {vista === 'blitz' && <Blitz defensa={defensa} filtros={filtros} />}
            {vista === 'jugadores' && <Jugadores equipo={equipo} filtros={filtros} />}
            {vista === 'cara' && <CaraACara ataque={equipo} defensa={defensa} filtros={filtros} />}
            {vista === 'cancha' && <JugadaVista equipo={equipo} />}
            {vista === 'reloj' && <Reloj equipo={equipo} />}
            {vista === 'plan' && <Plan ataque={equipo} defensa={defensa} filtros={filtros} />}
          </>
        )}
      </main>
    </div>
  )
}
