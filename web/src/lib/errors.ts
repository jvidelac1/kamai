import { ApiError } from './api'

export type ErrorKind = 'fixable' | 'network' | 'ours'

export interface FriendlyError {
  kind: ErrorKind
  title: string
  message: string
  hint?: string
  /** Campo del formulario al que apunta (para marcarlo en rojo). */
  field?: string
  fields?: Record<string, string>
  code: string
  details: Record<string, unknown>
}

/**
 * Traduce cualquier error a algo que una persona entienda:
 * qué pasó, qué hacer, y si lo puede arreglar ella, es la señal, o es un problema nuestro.
 */
export function friendlyError(e: unknown): FriendlyError {
  if (e instanceof ApiError) {
    if (e.status === 0) {
      return {
        kind: 'network',
        code: 'NETWORK',
        title: 'Sin conexión',
        message: 'No pudimos conectarnos. Puede ser la señal o los datos móviles.',
        hint: 'Lo que escribiste sigue aquí. Intenta de nuevo cuando tengas señal.',
        details: {},
      }
    }
    if (e.status >= 500) {
      return {
        kind: 'ours',
        code: e.code,
        title: 'Algo falló de nuestro lado',
        message: 'Es un problema nuestro, no tuyo.',
        hint: e.hint ?? 'Intenta de nuevo en unos minutos. Lo que escribiste no se perdió.',
        details: e.details,
      }
    }
    return {
      kind: 'fixable',
      code: e.code,
      title: 'Revisa esto',
      message: e.message,
      hint: e.hint,
      field: e.field,
      fields: e.fields,
      details: e.details,
    }
  }
  return {
    kind: 'ours',
    code: 'UNKNOWN',
    title: 'Algo falló',
    message: 'No sabemos bien qué pasó.',
    hint: 'Intenta de nuevo. Si vuelve a pasar, cierra y abre Kamai.',
    details: {},
  }
}

/** Una línea para toasts: mensaje + qué hacer. */
export const errorLine = (e: unknown) => {
  const f = friendlyError(e)
  return { title: f.kind === 'fixable' ? f.message : f.title, description: f.kind === 'fixable' ? f.hint : `${f.message} ${f.hint ?? ''}`.trim() }
}
