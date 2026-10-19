// Errores para personas: qué pasó (con sus datos), qué hacer, y en qué campo.
// Contrato: { error: CODE, message, hint?, field?, fields?: { [campo]: mensaje }, ...detalles }
import { z } from 'zod';

export class HttpError extends Error {
  constructor(status, code, message, { hint, field, details } = {}) {
    super(message);
    Object.assign(this, { status, code, hint, field, details });
  }
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "2026-07-01" → "1 de julio" */
export const dayMonth = (iso) => {
  const [, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
};
export const monthName = (iso) => MONTHS[Number(String(iso).slice(5, 7)) - 1];

/** Mensaje humano para cada problema de validación, según el campo. */
function fieldMessage(issue) {
  const field = issue.path.join('.');
  const tooSmall = issue.code === 'too_small';
  const tooBig = issue.code === 'too_big';
  const notNumber = issue.code === 'invalid_type';
  switch (field) {
    case 'kwhConsumed':
      if (notNumber) return 'Escribe los kWh solo con números, por ejemplo 1720.';
      if (tooSmall) return 'Los kWh tienen que ser más que cero.';
      if (tooBig) return 'Ese número es demasiado grande para una factura de luz. Revisa que no sobren ceros.';
      break;
    case 'costPerKwh':
      if (notNumber) return 'Escribe el precio por kWh con números, por ejemplo 0,84.';
      if (tooSmall) return 'El precio por kWh tiene que ser más que cero.';
      if (tooBig) return 'Ese precio por kWh es muy alto. ¿Quisiste poner 0,84 en vez de 84?';
      break;
    case 'billingStartDate':
    case 'billingEndDate':
      if (issue.params?.reason === 'END_BEFORE_START') return 'La fecha “hasta” tiene que ser después de la fecha “desde”.';
      if (issue.params?.reason === 'TOO_LONG') return `El periodo dura ${issue.params.days} días. Una factura de luz suele cubrir un mes: revisa las fechas.`;
      return 'Elige la fecha en el calendario.';
    case 'completedAt':
      return 'Elige en el calendario el día en que lo terminaste.';
    case 'uploadedFiles':
      return 'Puedes subir hasta 2 fotos por factura.';
    case 'status':
      return 'Ese estado no existe.';
    default:
      break;
  }
  return 'Revisa este dato.';
}

export function toErrorResponse(err) {
  if (err instanceof z.ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const f = issue.path.join('.') || '_';
      fields[f] ??= fieldMessage(issue);
    }
    const [field, message] = Object.entries(fields)[0];
    return {
      status: 400,
      body: {
        error: 'VALIDATION',
        message,
        hint: Object.keys(fields).length > 1 ? 'Hay más de un dato para revisar: están marcados en rojo.' : undefined,
        field,
        fields,
      },
    };
  }
  if (err instanceof HttpError) {
    return { status: err.status, body: { error: err.code, message: err.message, hint: err.hint, field: err.field, ...err.details } };
  }
  if (err?.type === 'entity.parse.failed') {
    return { status: 400, body: { error: 'BAD_JSON', message: 'No entendimos lo que se envió.', hint: 'Intenta de nuevo.' } };
  }
  return {
    status: 500,
    body: { error: 'INTERNAL', message: 'Es un problema nuestro, no tuyo.', hint: 'Intenta de nuevo en unos minutos. Lo que escribiste no se perdió.' },
  };
}
