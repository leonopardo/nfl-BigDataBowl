export const MARINO = '#013369'
export const ROJO = '#D50A0A'
export const BLANCO = '#FFFFFF'
export const TEXTO_SUAVE = '#D1D5DB'

export const pct = (x: number | null | undefined, d = 1): string =>
  x === null || x === undefined ? '—' : `${(x * 100).toFixed(d)}%`

export const num = (x: number | null | undefined, d = 1): string =>
  x === null || x === undefined ? '—' : x.toFixed(d)

/** De verde (bien) a rojo (mal). `razon` = valor / promedio de la liga. */
export function colorCalor(razon: number): string {
  const k = Math.max(0, Math.min(1, (razon - 0.6) / 1.0))
  const h = 135 - 135 * k // 135 = verde, 0 = rojo
  return `hsl(${h.toFixed(0)}, 78%, ${48 - 6 * k}%)`
}

export const NOMBRE_SITUACION_CORTO: Record<string, string> = {
  '1ª down': '1ª down',
  '2ª y corta (1-3)': '2ª corta',
  '2ª y media (4-6)': '2ª media',
  '2ª y larga (7+)': '2ª larga',
  '3ª/4ª y corta (1-3)': '3ª corta',
  '3ª/4ª y media (4-6)': '3ª media',
  '3ª/4ª y larga (7+)': '3ª larga',
}

export const RESULTADO: Record<string, string> = {
  C: 'Pase completo',
  I: 'Pase incompleto',
  S: 'Sack',
  IN: 'Intercepción',
  R: 'El mariscal corre',
}
