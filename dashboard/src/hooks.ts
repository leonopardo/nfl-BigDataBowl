import { useEffect, useRef, useState } from 'react'

export interface Carga<T> {
  datos: T | null
  cargando: boolean
  error: string
}

/** Pide datos y descarta las respuestas viejas si cambian las dependencias. */
export function useCarga<T>(pedir: () => Promise<T>, deps: unknown[], activo = true): Carga<T> {
  const [datos, setDatos] = useState<T | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activo) {
      setDatos(null)
      return
    }
    let vigente = true
    setCargando(true)
    setError('')
    pedir()
      .then((d) => {
        if (vigente) setDatos(d)
      })
      .catch((e: unknown) => {
        if (vigente) {
          setDatos(null)
          setError(e instanceof Error && e.message ? e.message : 'No se pudieron cargar los datos.')
        }
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, activo])

  return { datos, cargando, error }
}

/** Número que "cuenta" hasta su valor nuevo (animación suave). */
export function useContador(objetivo: number, ms = 700): number {
  const [valor, setValor] = useState(objetivo)
  const desde = useRef(objetivo)

  useEffect(() => {
    const ini = desde.current
    const t0 = performance.now()
    let id = 0
    const paso = (ahora: number) => {
      const k = Math.min(1, (ahora - t0) / ms)
      const suave = 1 - Math.pow(1 - k, 3)
      const v = ini + (objetivo - ini) * suave
      setValor(v)
      desde.current = v
      if (k < 1) id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [objetivo, ms])

  return valor
}

/** Reloj que avanza solo mientras `activo` es verdadero. Devuelve el tiempo en segundos. */
export function useReloj(activo: boolean, inicio: number, fin: number, velocidad: number, alTerminar: () => void) {
  const [t, setT] = useState(inicio)
  const ref = useRef(t)
  ref.current = t

  useEffect(() => {
    setT(inicio)
  }, [inicio, fin])

  useEffect(() => {
    if (!activo) return
    let id = 0
    let previo = performance.now()
    const paso = (ahora: number) => {
      const dt = (ahora - previo) / 1000
      previo = ahora
      const sig = ref.current + dt * velocidad
      if (sig >= fin) {
        setT(fin)
        alTerminar()
        return
      }
      setT(sig)
      id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, fin, velocidad])

  return [t, setT] as const
}
