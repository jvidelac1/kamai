/**
 * "¿Dónde encuentro estos datos?": una factura de luz de ejemplo con los 3 datos marcados.
 * Números de ejemplo (ficticios). Cada empresa eléctrica usa nombres un poco distintos: los listamos.
 */
function Mark({ n }: { n: number }) {
  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground" aria-hidden>
      {n}
    </span>
  )
}

export function BillGuide() {
  return (
    <div className="space-y-4">
      <figure className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm" aria-label="Factura de luz de ejemplo">
        <div className="flex items-center justify-between bg-muted px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span>Empresa eléctrica</span>
          <span>Recibo N° 000123</span>
        </div>
        <div className="space-y-2 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 rounded-lg bg-accent/70 px-2 py-1.5 ring-2 ring-primary">
            <Mark n={1} />
            <span className="flex-1">Periodo de consumo</span>
            <span className="font-bold">01/06 – 30/06</span>
          </div>
          <div className="flex items-center gap-2 px-2 text-muted-foreground">
            <span className="w-6" />
            <span className="flex-1">Lectura anterior / actual</span>
            <span>45.210 / 46.930</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-accent/70 px-2 py-1.5 ring-2 ring-primary">
            <Mark n={2} />
            <span className="flex-1">Consumo (energía activa)</span>
            <span className="font-bold">1.720 kWh</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-accent/70 px-2 py-1.5 ring-2 ring-primary">
            <Mark n={3} />
            <span className="flex-1">Precio unitario</span>
            <span className="font-bold">S/ 0,84 por kWh</span>
          </div>
          <div className="flex items-center gap-2 border-t px-2 pt-2 font-bold">
            <span className="w-6" />
            <span className="flex-1">Total a pagar</span>
            <span>S/ 1.445</span>
          </div>
        </div>
      </figure>

      <ol className="space-y-3 text-sm leading-snug">
        <li className="flex gap-3">
          <Mark n={1} />
          <span>
            <strong>Las fechas</strong> están arriba, como “periodo”, “desde/hasta” o “fecha de lectura”. Ya te sugerimos las del mes que sigue a tu última factura.
          </span>
        </li>
        <li className="flex gap-3">
          <Mark n={2} />
          <span>
            <strong>Los kWh</strong> aparecen como “consumo”, “energía activa” o “consumo del mes”. Es un número de cientos o miles, con “kWh” al lado. No uses las lecturas del medidor.
          </span>
        </li>
        <li className="flex gap-3">
          <Mark n={3} />
          <span>
            <strong>El precio por kWh</strong> puede decir “precio unitario” o “cargo por energía”. Si no lo encuentras, divide el cargo por energía entre los kWh. Por ejemplo, 1.445 ÷ 1.720 = 0,84.
          </span>
        </li>
      </ol>
    </div>
  )
}
