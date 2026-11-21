import type { ReactNode } from 'react'
import type { Muestra } from '../tipos'

export function Seccion({ titulo, sub, children, className = '' }: { titulo?: string; sub?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`tarjeta-imprimir aparece rounded-lg border border-gray-700 border-t-4 border-t-rojo bg-neutral-900 p-4 ${className}`}>
      {titulo && <h2 className="text-lg font-semibold text-white">{titulo}</h2>}
      {sub && <p className="mb-3 mt-1 text-sm text-gray-300">{sub}</p>}
      {children}
    </section>
  )
}

export function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="tarjeta-imprimir aparece rounded-lg border-t-4 border-rojo bg-marino p-4 shadow">
      <p className="text-sm text-gray-200">{titulo}</p>
      <p className="text-3xl font-bold text-white">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-gray-300">{detalle}</p>}
    </div>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-gray-300" role="status">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-white" />
      {texto}
    </div>
  )
}

export function ErrorCaja({ texto }: { texto: string }) {
  if (!texto) return null
  return <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-800">{texto}</p>
}

/** Explicación en lenguaje simple, con un ícono para que se note. */
export function Explica({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="no-imprimir rounded-lg border border-sky-700 bg-sky-950/60 p-3 text-sm text-sky-100">
      <p className="mb-1 font-semibold text-sky-300">💡 {titulo}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

export function AvisoMuestra({ muestra }: { muestra: Muestra }) {
  if (muestra === 'ok') return null
  const texto = muestra === 'insuficiente' ? 'muy pocas jugadas' : 'pocas jugadas'
  const color = muestra === 'insuficiente' ? 'bg-gray-700 text-gray-200' : 'bg-yellow-900 text-yellow-100'
  return <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${color}`}>{texto}</span>
}

const COLOR_VEREDICTO: Record<string, string> = {
  si: 'bg-green-700 text-white',
  no: 'bg-red-700 text-white',
  igual: 'bg-gray-600 text-white',
  pocas: 'bg-gray-800 text-gray-300',
}

export function Insignia({ codigo, texto }: { codigo: string; texto: string }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${COLOR_VEREDICTO[codigo] ?? COLOR_VEREDICTO.pocas}`}>{texto}</span>
}

/** Barra horizontal con intervalo de confianza (la línea blanca) y marca del promedio de la liga. */
export function BarraIC({ valor, bajo, alto, liga, max, color }: { valor: number; bajo?: number | null; alto?: number | null; liga?: number | null; max: number; color: string }) {
  const w = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`
  return (
    <div className="relative h-4 w-full rounded bg-neutral-800" role="img" aria-label={`${(valor * 100).toFixed(1)}%`}>
      <div className="barra absolute left-0 top-0 h-4 rounded" style={{ width: w(valor), background: color }} />
      {bajo != null && alto != null && (
        <div className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-white/80" style={{ left: w(bajo), width: `calc(${w(alto)} - ${w(bajo)})` }} />
      )}
      {liga != null && <div className="absolute top-0 h-4 w-0.5 bg-yellow-300" style={{ left: w(liga) }} title="Promedio de la liga" />}
    </div>
  )
}

export function Pie({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs text-gray-400">{children}</p>
}
