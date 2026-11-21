import type { Filtros } from '../tipos'

interface Props {
  filtros: Filtros
  onChange: (f: Filtros) => void
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col text-xs font-medium text-gray-300">
      {etiqueta}
      {children}
    </label>
  )
}

const ESTILO = 'mt-1 rounded border border-gray-500 bg-white px-2 py-1.5 text-sm font-semibold text-marino'

export default function FiltrosBarra({ filtros, onChange }: Props) {
  const activos = Object.values(filtros).filter((v) => v !== undefined).length
  const poner = (k: keyof Filtros, v: string, numero = false) =>
    onChange({ ...filtros, [k]: v === '' ? undefined : numero ? Number(v) : v })

  return (
    <div className="no-imprimir flex flex-wrap items-end gap-3 rounded-lg border border-gray-700 bg-neutral-900 p-3">
      <Campo etiqueta="Down">
        <select className={ESTILO} style={{ colorScheme: 'light' }} value={filtros.down ?? ''} onChange={(e) => poner('down', e.target.value, true)}>
          <option value="">Todos</option>
          <option value="1">1ª</option>
          <option value="2">2ª</option>
          <option value="3">3ª y 4ª</option>
        </select>
      </Campo>
      <Campo etiqueta="Distancia para el first down">
        <select className={ESTILO} style={{ colorScheme: 'light' }} value={filtros.distancia ?? ''} onChange={(e) => poner('distancia', e.target.value)}>
          <option value="">Todas</option>
          <option value="corta">Corta (1-3 yardas)</option>
          <option value="media">Media (4-6)</option>
          <option value="larga">Larga (7 o más)</option>
        </select>
      </Campo>
      <Campo etiqueta="Cuarto">
        <select className={ESTILO} style={{ colorScheme: 'light' }} value={filtros.cuarto ?? ''} onChange={(e) => poner('cuarto', e.target.value, true)}>
          <option value="">Todos</option>
          <option value="1">1.º</option>
          <option value="2">2.º</option>
          <option value="3">3.º</option>
          <option value="4">4.º</option>
          <option value="5">Tiempo extra</option>
        </select>
      </Campo>
      <Campo etiqueta="Marcador del equipo con el balón">
        <select className={ESTILO} style={{ colorScheme: 'light' }} value={filtros.marcador ?? ''} onChange={(e) => poner('marcador', e.target.value)}>
          <option value="">Cualquiera</option>
          <option value="ganando">Ganando</option>
          <option value="empatado">Empatado</option>
          <option value="perdiendo">Perdiendo</option>
        </select>
      </Campo>
      {activos > 0 && (
        <button className="rounded border border-white px-3 py-1.5 text-sm text-white hover:bg-white hover:text-marino" onClick={() => onChange({})}>
          Quitar filtros ({activos})
        </button>
      )}
      <p className="ml-auto max-w-xs text-xs text-gray-400">Los filtros se aplican a todas las vistas. Con pocas jugadas, las cifras se vuelven poco estables.</p>
    </div>
  )
}
