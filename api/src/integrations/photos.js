// Verificación de la foto de la factura (en producción: el almacenamiento de archivos + un lector OCR, en segundo plano).
// La foto es EVIDENCIA, no la fuente de los números: si no se lee, la factura cuenta igual con lo que escribió la persona.

export const PHOTO_STATUS = { NONE: 'none', READABLE: 'readable', UNREADABLE: 'unreadable' };

/** Lector falso para dev/demo: una foto "borrosa" o "ilegible" no se puede leer. */
export function createFakePhotoChecker() {
  return {
    async check(fileName) {
      return /borrosa|ilegible|blurry/i.test(fileName) ? PHOTO_STATUS.UNREADABLE : PHOTO_STATUS.READABLE;
    },
  };
}

/** Estado de la foto de una factura (las facturas viejas con foto y sin estado se consideran legibles). */
export function photoStatusOf(bill) {
  if (!bill.uploadedFiles?.length) return PHOTO_STATUS.NONE;
  return bill.photoStatus ?? PHOTO_STATUS.READABLE;
}
