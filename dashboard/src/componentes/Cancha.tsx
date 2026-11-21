import type { ReactNode } from 'react'

export const ANCHO = 53.3

/**
 * Cancha en SVG. Se trabaja con coordenadas del campo (x = a lo largo, y = a lo ancho, en yardas).
 * La ofensiva avanza hacia ARRIBA, como en un diagrama de entrenador:
 * el lado izquierdo de la pantalla es el lado izquierdo del mariscal (LT, LG...).
 * La ventana (x0..x1, y0..y1) permite acercar la vista; por omisión se ve todo el ancho.
 */
export const px = (y: number, y1 = ANCHO) => y1 - y
export const py = (x: number, x1: number) => x1 - x

export interface Punto {
  id: string | number
  x: number
  y: number
  color: string
  r?: number
  etiqueta?: string
  borde?: string
  titulo?: string
  orient?: number | null // grados, ya en el campo orientado
  pulso?: boolean
  forma?: 'circulo' | 'cuadro' | 'triangulo'
  opacidad?: number
  texto?: string // texto debajo del punto (por ejemplo un nombre)
  tamTexto?: number
  colorTexto?: string
  onClick?: () => void
}

export interface Linea {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  grosor?: number
  punteada?: boolean
  animada?: boolean
  flecha?: boolean
  etiqueta?: string
  opacidad?: number
}

interface Props {
  x0: number // yarda inferior visible
  x1: number // yarda superior visible
  y0?: number // borde derecho visible (a lo ancho)
  y1?: number // borde izquierdo visible (a lo ancho)
  puntos: Punto[]
  lineas?: Linea[]
  balon?: [number, number] | null
  scrimmage?: number | null
  suave?: boolean // transiciones CSS entre posiciones
  anotaciones?: ReactNode // SVG extra, en unidades de pantalla (use px/py con y1 y x1)
  alt: string
  className?: string
  maxVh?: number // alto máximo como porcentaje de la altura de la ventana
}

function numeroYarda(x: number): number | null {
  if (x < 10 || x > 110 || (x - 10) % 10 !== 0) return null
  const v = x - 10
  return v <= 50 ? v : 100 - v
}

export default function Cancha({
  x0, x1, y0 = 0, y1 = ANCHO, puntos, lineas = [], balon, scrimmage, suave, anotaciones, alt, className, maxVh = 80,
}: Props) {
  const W = y1 - y0
  const H = x1 - x0
  const X = (y: number) => y1 - y
  const Y = (x: number) => x1 - x
  const yardas: number[] = []
  for (let x = Math.ceil(x0); x <= Math.floor(x1); x++) yardas.push(x)
  const dentro = (v: number) => v >= -0.01 && v <= W + 0.01

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={alt}
      className={className ?? 'rounded-lg border border-gray-700'}
      style={{ background: '#0b3a1f', display: 'block', width: '100%', height: 'auto', maxWidth: `calc(${maxVh}vh * ${W / H})`, margin: '0 auto' }}
    >
      <defs>
        <marker id="flecha" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" />
        </marker>
      </defs>

      {/* franjas de césped cada 5 yardas */}
      {yardas.filter((x) => x % 10 < 5).map((x) => (
        <rect key={`f${x}`} x={0} y={Y(x + 1)} width={W} height={1} fill="#0e4524" opacity={0.55} />
      ))}

      {/* zonas de anotación */}
      {x0 < 10 && <rect x={0} y={Y(10)} width={W} height={Math.min(10, 10 - x0)} fill="#013369" opacity={0.8} />}
      {x1 > 110 && <rect x={0} y={0} width={W} height={Math.min(10, x1 - 110)} fill="#013369" opacity={0.8} />}

      {/* líneas de yardas */}
      {yardas.map((x) => {
        const cinco = x % 5 === 0
        const num = numeroYarda(x)
        return (
          <g key={`y${x}`}>
            <line x1={0} x2={W} y1={Y(x)} y2={Y(x)} stroke="#fff" strokeWidth={cinco ? 0.14 : 0.05} opacity={cinco ? 0.55 : 0.22} />
            {[23.4, 29.9].filter((hy) => hy >= y0 && hy <= y1).map((hy) => (
              <line key={hy} x1={X(hy) - 0.5} x2={X(hy) + 0.5} y1={Y(x)} y2={Y(x)} stroke="#fff" strokeWidth={0.07} opacity={0.4} />
            ))}
            {num !== null && W >= 20 && (
              <>
                <text x={4} y={Y(x) + 0.8} fontSize={2.6} fill="#fff" opacity={0.2} textAnchor="middle" fontWeight={700}>{num}</text>
                <text x={W - 4} y={Y(x) + 0.8} fontSize={2.6} fill="#fff" opacity={0.2} textAnchor="middle" fontWeight={700}>{num}</text>
              </>
            )}
          </g>
        )
      })}

      {/* bandas */}
      {dentro(X(0)) && <line x1={X(0) - 0.1} x2={X(0) - 0.1} y1={0} y2={H} stroke="#fff" strokeWidth={0.25} opacity={0.7} />}
      {dentro(X(ANCHO)) && <line x1={X(ANCHO) + 0.1} x2={X(ANCHO) + 0.1} y1={0} y2={H} stroke="#fff" strokeWidth={0.25} opacity={0.7} />}

      {/* línea de golpeo */}
      {scrimmage != null && (
        <line x1={0} x2={W} y1={Y(scrimmage)} y2={Y(scrimmage)} stroke="#38bdf8" strokeWidth={0.18} strokeDasharray="0.8 0.5" opacity={0.9} />
      )}

      {/* líneas (flechas, distancias) */}
      {lineas.map((l, i) => (
        <g key={`l${i}`} opacity={l.opacidad ?? 1}>
          <line
            x1={X(l.y1)} y1={Y(l.x1)} x2={X(l.y2)} y2={Y(l.x2)}
            stroke={l.color} strokeWidth={l.grosor ?? 0.25}
            strokeDasharray={l.punteada || l.animada ? '0.9 0.6' : undefined}
            className={l.animada ? 'trazo-animado' : undefined}
            markerEnd={l.flecha ? 'url(#flecha)' : undefined}
            strokeLinecap="round"
          />
          {l.etiqueta && (
            <text
              x={(X(l.y1) + X(l.y2)) / 2 + 0.7} y={(Y(l.x1) + Y(l.x2)) / 2}
              fontSize={1.5} fill="#fff" fontWeight={700} stroke="#000" strokeWidth={0.3} paintOrder="stroke"
            >
              {l.etiqueta}
            </text>
          )}
        </g>
      ))}

      {/* jugadores */}
      {puntos.map((p) => {
        const r = p.r ?? 1.15
        const dx = p.orient != null ? -Math.cos((p.orient * Math.PI) / 180) : 0
        const dy = p.orient != null ? -Math.sin((p.orient * Math.PI) / 180) : 0
        return (
          <g
            key={p.id}
            style={{
              transform: `translate(${X(p.y)}px, ${Y(p.x)}px)`,
              transition: suave ? 'transform 0.7s cubic-bezier(.4,0,.2,1)' : undefined,
              cursor: p.onClick ? 'pointer' : undefined,
              opacity: p.opacidad ?? 1,
            }}
            onClick={p.onClick}
          >
            {p.titulo && <title>{p.titulo}</title>}
            {p.pulso && <circle r={r * 1.9} fill="none" stroke={p.color} strokeWidth={0.2} className="pulso-anillo" />}
            {p.orient != null && (
              <line x1={0} y1={0} x2={dx * r * 2.3} y2={dy * r * 2.3} stroke="#fff" strokeWidth={0.18} strokeLinecap="round" opacity={0.85} />
            )}
            {p.forma === 'cuadro' ? (
              <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={0.25} fill={p.color} stroke={p.borde ?? '#000'} strokeWidth={0.16} />
            ) : p.forma === 'triangulo' ? (
              <path d={`M 0 ${-r * 1.2} L ${r * 1.1} ${r * 0.9} L ${-r * 1.1} ${r * 0.9} Z`} fill={p.color} stroke={p.borde ?? '#000'} strokeWidth={0.16} />
            ) : (
              <circle r={r} fill={p.color} stroke={p.borde ?? '#000'} strokeWidth={0.16} />
            )}
            {p.etiqueta && (
              <text y={r * 0.36} fontSize={r * 0.95} textAnchor="middle" fill={p.colorTexto ?? '#000'} fontWeight={800}>
                {p.etiqueta}
              </text>
            )}
            {p.texto && (
              <text y={r + (p.tamTexto ?? 1.35) + 0.2} fontSize={p.tamTexto ?? 1.35} textAnchor="middle" fill="#fff" fontWeight={700} stroke="#000" strokeWidth={0.28} paintOrder="stroke">
                {p.texto}
              </text>
            )}
          </g>
        )
      })}

      {/* balón */}
      {balon && <ellipse cx={X(balon[1])} cy={Y(balon[0])} rx={0.45} ry={0.75} fill="#8b4513" stroke="#fff" strokeWidth={0.12} />}

      {anotaciones}
    </svg>
  )
}
