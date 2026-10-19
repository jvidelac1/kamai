import { Landmark, Route, ShieldCheck, Siren } from 'lucide-react'
import type { Tour, TourCtx } from './types'

const plusDays = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Sube una factura con el formulario, como lo haría Inés. */
async function uploadBill(c: TourCtx, opener: string, kwh: string, price?: string) {
  await c.click({ text: opener, selector: 'button' })
  await c.waitFor('#bill-kwh')
  await c.type('#bill-kwh', kwh)
  if (price) await c.type('#bill-price', price)
  await c.click({ text: 'Guardar factura', selector: '[data-slot="drawer-footer"] button' })
  await c.expectText('Factura guardada')
}

/** Deja a Inés con burletes ya empezado y terminado el 10/7 (atajo por la API para ir al grano). */
async function setupCompleted(c: TourCtx) {
  await c.reset()
  const rec = await c.api.recommendation()
  const plan = await c.api.startPlan('eco_118', rec.recommendationId)
  await c.api.completePlan(plan.id, '2026-07-10', 5)
  await c.refresh()
}

// ───────────────────────────────── 1. Camino feliz ─────────────────────────────────
const happy: Tour = {
  id: 'feliz',
  title: 'Camino feliz',
  subtitle: 'De la recomendación al ahorro medido',
  icon: Route,
  steps: [
    {
      title: 'Empezamos de cero',
      explain: 'Inés abre Kamai el 1 de julio. Tiene 6 facturas de luz (enero a junio) y el aislamiento del horno trabado hace 7 semanas.',
      async run(c) {
        await c.reset()
        await c.expectText('Tu primer paso')
      },
    },
    {
      title: 'Su primer paso y por qué',
      explain: 'El motor elige burletes y descongelamiento: entra en su presupuesto y su tiempo, ataca las refrigeradoras y 8 de cada 10 panaderías la terminan.',
      covers: 'Recomendación · "Primer paso de Inés" y "Cifra de completitud sí, cifra de ahorro no"',
      async run(c) {
        c.highlight({ text: 'Mantenimiento de burletes', selector: 'h2' })
        await c.expectText('Mantenimiento de burletes y descongelamiento de refrigeradoras')
        await c.expectText('8 de cada 10 panaderías')
        await c.expectText('pocas mediciones')
      },
    },
    {
      title: 'Lo mismo en los 4 lugares de Kamai',
      explain: 'Por detrás, pedimos la recomendación como lo harían el inicio, el catálogo, el diagnóstico y el correo de bienvenida. Las cuatro tienen que decir lo mismo.',
      covers: 'Recomendación · "Los cuatro lugares dicen lo mismo"',
      async run(c) {
        const ids = await Promise.all(
          ['home', 'catalog', 'diagnosis', 'email'].map((s) =>
            fetch(`/businesses/biz_ines/recommendations/first-step?surface=${s}&asOf=2026-07-01`).then((r) => r.json()),
          ),
        )
        c.check('Inicio, catálogo, diagnóstico y correo → burletes', ids.every((r) => r.recommendation.recommended.ecoId === 'eco_118'))
        c.check('Es una sola recomendación guardada', new Set(ids.map((r) => r.recommendationId)).size === 1)
      },
    },
    {
      title: '¿Y una panadería que recién llega?',
      explain: 'Por detrás, pedimos la recomendación para Rosa (Panadería La Espiga), que llegó hoy y no tiene facturas. Igual recibe su primer paso, pero le pedimos 3 facturas antes de empezar: sin ellas nunca podríamos medir su ahorro.',
      covers: 'Recomendación · "Negocio nuevo" (caso 1c del enunciado)',
      async run(c) {
        const r = await c.backstage<{ recommendation: { recommended: { title: string } | null; measurement: { billsNeeded: number } }; explanation: { beforeYouStart?: string } }>(
          '/businesses/biz_nueva/recommendations/first-step?surface=home&asOf=2026-07-01',
        )
        c.check(`Recibe un primer paso: ${r.recommendation.recommended?.title ?? 'ninguno'}`, Boolean(r.recommendation.recommended))
        c.check('Le pedimos 3 facturas antes de empezar', r.recommendation.measurement.billsNeeded === 3 && Boolean(r.explanation.beforeYouStart))
      },
    },
    {
      title: 'Lo que tenía trabado',
      explain: 'Kamai nota que el aislamiento lleva 7 semanas sin avanzar y sugiere pausarlo, sin culparla.',
      covers: 'Recomendación · "Aislamiento trabado"',
      async run(c) {
        c.highlight({ text: 'Sobre lo que ya tenías en marcha', selector: 'p', closest: '[role="note"]' })
        await c.expectText('lleva 7 semanas sin avanzar')
      },
    },
    {
      title: '¿Por qué este y no otro?',
      explain: 'Abrimos la explicación: lo que no entra en S/ 1.200 o ya está en su plan queda descartado, con un motivo en palabras simples.',
      covers: 'Recomendación · "Lo que no entra en S/ 1.200 queda fuera"',
      async run(c) {
        await c.click({ text: '¿Por qué este y no otro?', selector: 'button' })
        await c.expectText('Cuesta más que tu presupuesto de este trimestre')
        await c.expectText('Ya la tienes en tu plan')
        await c.sleep(1200)
        await c.closeDrawer()
      },
    },
    {
      title: 'Toca "Quiero empezar"',
      explain: 'Se crea su plan con la fecha de inicio y el id de la recomendación. Sin esa fecha, después no podríamos separar el antes del después.',
      covers: 'Recomendación · "El plan recuerda de qué recomendación vino"',
      async run(c) {
        await c.click({ text: 'Quiero empezar', selector: 'button' })
        await c.expectText('En marcha')
        await c.expectText('0 de 3 pasos')
      },
    },
    {
      title: 'Tacha sus pasos',
      explain: 'Va marcando lo que hace. El avance se guarda en el servidor, no solo en el celular.',
      async run(c) {
        for (let i = 0; i < 3; i++) await c.click(`#step-${i}`)
        await c.expectText('3 de 3 pasos')
      },
    },
    {
      title: 'Pide ayuda con un paso',
      explain: 'El botón "¿Cómo?" le pide subtareas al proveedor de IA. Aquí la IA responde bien.',
      covers: 'Integraciones · "IA disponible"',
      async run(c) {
        await c.click('[aria-label="¿Cómo hago \\"Revisar burletes\\"?"]')
        await c.expectText('Sugerencias para ti')
        await c.sleep(1200)
        await c.closeDrawer()
      },
    },
    {
      title: 'Ya lo terminé',
      explain: 'Marca que lo terminó el 10 de julio. Desde esa fecha medimos el después, pero todavía no hay ninguna factura posterior.',
      covers: 'Ahorro · "Recién completada"',
      async run(c) {
        await c.click({ text: 'Ya lo terminé', selector: 'button' })
        await c.waitFor('#done-date')
        await c.type('#done-date', '2026-07-10')
        await c.click({ text: 'Listo, lo terminé', selector: 'button' })
        await c.expectText('Todavía no podemos saberlo')
        await c.expectText('Tu consumo normal: 59,7 kWh por día')
      },
    },
    {
      title: 'Sube la factura de julio',
      explain: 'Escribe solo los kWh: el periodo y el precio se sugieren solos. Julio tiene días de antes y de después de terminar, así que no sirve para comparar, y se lo explicamos.',
      covers: 'Ahorro · "Periodo mixto"',
      async run(c) {
        await uploadBill(c, 'Subir mi factura', '1.800')
        await c.expectText('tiene días de antes y de después de terminar')
      },
    },
    {
      title: 'Sube agosto',
      explain: 'Bajó 4,5%, pero su consumo normal varía cerca de 2,6% de un mes a otro. Con una sola factura no alcanza para afirmar que ahorró.',
      covers: 'Ahorro · "Una sola factura posterior dentro del ruido"',
      async run(c) {
        await uploadBill(c, 'Subir mi factura', '1.767')
        await c.expectText('Tu consumo bajó 4,5%')
        await c.expectText('entre 1,1% más y 10,0% menos')
      },
    },
    {
      title: 'Sube septiembre (y sube la tarifa)',
      explain: 'Con dos facturas posteriores, el ahorro supera la variación normal: ahora sí podemos decirlo, con su rango.',
      covers: 'Ahorro · "Ahorro medido"',
      async run(c) {
        await uploadBill(c, 'Subir mi factura', '1.665', '0,86')
        c.highlight({ text: 'Estás ahorrando cerca de', selector: 'p', closest: '[data-slot="card"]' })
        await c.expectText('S/ 88')
        await c.expectText('entre S/ 23 y S/ 153 al mes')
      },
    },
    {
      title: 'Por qué la factura no baja tanto',
      explain: 'La tarifa subió 6,8%. Medimos en kWh para no culparla por eso, y se lo explicamos.',
      covers: 'Ahorro · "La tarifa esconde el ahorro"',
      async run(c) {
        c.highlight({ text: '¿Por qué mi factura no baja tanto?', selector: 'p', closest: '[role="note"]' })
        await c.expectText('La tarifa subió 6,8%')
        await c.expectText('no es culpa tuya')
      },
    },
    {
      title: '¿Cómo lo calculamos?',
      explain: 'Si quiere entender el número, lo explicamos sin fórmulas: por día, en kWh (no en soles) y solo si el cambio supera su variación normal. También le mostramos el CO₂ que deja de emitir.',
      covers: 'Ahorro · "Normalización por día", "Corrección por tarifa" y "Sin corrección estacional con poca historia"',
      async run(c) {
        await c.expectText('de CO₂ menos al mes')
        await c.click({ text: '¿Cómo lo calculamos?', selector: 'button' })
        await c.expectText('Comparamos tu consumo por día')
        await c.expectText('no es tu culpa')
        await c.expectText('Solo te decimos que ahorraste cuando el cambio es mayor que eso')
        await c.sleep(1500)
      },
    },
    {
      title: 'Su consumo, mes a mes',
      explain: 'En Facturas, el gráfico muestra los kWh por día: antes en lavanda, después en verde, y la línea de "tu normal".',
      async run(c) {
        await c.goTab('Facturas')
        c.highlight({ text: 'Tu consumo por día', selector: 'h2', closest: '[data-slot="card"]' })
        await c.expectText('Después')
        await c.expectText('tu normal')
      },
    },
  ],
}

// ───────────────────────────────── 2. Honestidad ─────────────────────────────────
const honesty: Tour = {
  id: 'honestidad',
  title: 'Honestidad',
  subtitle: 'Cuando los números engañan',
  icon: ShieldCheck,
  steps: [
    {
      title: 'Preparamos la escena',
      explain: 'Atajo: Inés ya empezó burletes el 1/7 y lo terminó el 10/7. Vamos directo a lo que importa: medir sin engañar.',
      async run(c) {
        await setupCompleted(c)
        await c.goTab('Facturas')
        await c.expectText('Tus facturas (6)')
      },
    },
    {
      title: 'El "ahorraste S/ 117" de febrero',
      explain: 'Antes Kamai restaba la última factura menos la anterior. Febrero tuvo 3 días menos, y por día consumió MÁS. Ahora lo decimos y comparamos siempre por día.',
      covers: 'Ahorro · "El ahorraste S/ 117 de febrero"',
      async run(c) {
        c.highlight({ text: 'Cambiamos cómo medimos', selector: 'p', closest: '[role="note"]' })
        await c.expectText('ahorraste S/ 117')
        await c.expectText('por día gastaste 1,7% más')
      },
    },
    {
      title: 'Su consumo normal',
      explain: 'La línea base son sus 6 facturas de antes: 59,7 kWh por día. Todavía no hay factura posterior, así que no inventamos un número.',
      covers: 'Ahorro · "Línea base de Inés"',
      async run(c) {
        await c.goTab('Mi ahorro')
        await c.expectText('Todavía no podemos saberlo')
        await c.expectText('59,7 kWh por día')
      },
    },
    {
      title: 'Julio no cuenta',
      explain: 'Julio mezcla días de antes y de después de terminar. Si lo usáramos, ensuciaría la comparación.',
      covers: 'Ahorro · "Periodo mixto"',
      async run(c) {
        await uploadBill(c, 'Subir mi factura', '1.800')
        await c.expectText('no sirve para comparar')
      },
    },
    {
      title: 'Agosto: todavía no sabemos',
      explain: 'El rango va de 1,1% más a 10,0% menos: incluye "no ahorró nada". Decir "ahorraste" sería mentir.',
      covers: 'Ahorro · "Una sola factura posterior dentro del ruido"',
      async run(c) {
        await uploadBill(c, 'Subir mi factura', '1.767')
        c.highlight({ text: 'Lo más probable', selector: 'figcaption' })
        await c.expectText('entre 1,1% más y 10,0% menos')
      },
    },
    {
      title: 'Septiembre: ahora sí',
      explain: 'Todo el rango queda del lado del ahorro. La resta en soles habría dicho S/ 7 por la subida de tarifa; medido en kWh son ≈ S/ 88.',
      covers: 'Ahorro · "Ahorro medido" y "La tarifa esconde el ahorro"',
      async run(c) {
        await uploadBill(c, 'Subir mi factura', '1.665', '0,86')
        await c.expectText('S/ 88')
        const s = await c.api.savings((await c.api.recommendation()).firstStepPlan!.id)
        c.check(`La resta en soles habría dicho S/ ${s.measurement.tariffEffect?.naiveMoneyPerMonth} (no S/ 88)`, (s.measurement.tariffEffect?.naiveMoneyPerMonth ?? 99) < 20)
      },
    },
    {
      title: 'Detrás de escena: el correo que no sale',
      explain: 'Al medir el ahorro, Kamai le manda un correo. Simulamos que el servicio de correos falla una vez: Inés no espera ni ve un error, porque el resultado ya está en la app. El correo se reintenta y sale una sola vez.',
      covers: 'Integraciones · "El servicio de mensajería falla" y "Ahorro medido avisa una vez"',
      async run(c) {
        type Msg = { template: string; status: string; attempts: number }
        const before = await c.backstage<Msg[]>('/internal/outbox')
        const queued = before.filter((m) => m.template === 'savings-measured')
        c.check('Quedó un correo “ahorro medido” en la cola', queued.length === 1)
        await c.backstage('/internal/demo/messaging', { failTimes: 1 })
        const first = await c.backstage<{ results: { status: string }[] }>('/internal/demo/outbox/deliver-now', {})
        c.check('1er intento: el servicio falla y queda para reintentar', first.results.some((r) => r.status === 'retry'))
        const second = await c.backstage<{ results: { status: string }[] }>('/internal/demo/outbox/deliver-now', {})
        c.check('2º intento: enviado', second.results.some((r) => r.status === 'sent'))
        const after = (await c.backstage<Msg[]>('/internal/outbox')).filter((m) => m.template === 'savings-measured')
        c.check('Sigue siendo un solo correo (no se repite)', after.length === 1 && after[0].status === 'sent')
        await c.expectText('S/ 88')
      },
    },
    {
      title: 'Se equivocó en septiembre',
      explain: 'Corrige: eran 1.750 kWh. Recalculamos todo desde cero (sin sumar dos veces) y le avisamos que la cifra que vio ya no vale.',
      covers: 'Ahorro · "Editar una factura ya vista"',
      async run(c) {
        await c.goTab('Facturas')
        await c.click({ text: 'Septiembre 2026', selector: 'main button' })
        await c.waitFor('#bill-kwh')
        await c.type('#bill-kwh', '1750')
        await c.click({ text: 'Guardar cambios', selector: 'button' })
        await c.expectText('Factura corregida')
        await c.goTab('Mi ahorro')
        c.highlight({ text: 'Actualizamos tu resultado', selector: 'p', closest: '[role="note"]' })
        await c.expectText('corregiste tu factura de septiembre: de 1.665 a 1.750 kWh')
        await c.expectText('antes te mostrábamos S/ 88 al mes y esa cifra ya no vale')
        await c.expectText('Todavía no podemos saberlo')
      },
    },
    {
      title: 'El cambio queda a la vista',
      explain: 'El aviso grande sale una vez. Después, el último cambio queda anotado con su fecha, y en Facturas está el historial y la marca “Corregida el…”.',
      covers: 'Ahorro · "El aviso se muestra una sola vez" + historial de correcciones',
      async run(c) {
        await c.goTab('Facturas')
        c.highlight('[data-tour="corrections"]')
        await c.expectText('Tus cambios recientes')
        await c.expectText('Corregida el')
        await c.goTab('Mi ahorro')
        c.highlight('[data-tour="last-correction"]')
        await c.expectText('Último cambio en tus facturas')
      },
    },
    {
      title: 'Borra septiembre',
      explain: 'Al borrar, el resultado vuelve a lo que dicen las facturas que quedan. No queda ninguna cifra vieja dando vueltas.',
      covers: 'Ahorro · "Borrar facturas posteriores"',
      async run(c) {
        await c.goTab('Facturas')
        await c.click({ text: 'Septiembre 2026', selector: 'main button' })
        await c.click({ text: 'Borrar factura', selector: 'button' })
        await c.expectText('Al borrarla, recalculamos tu ahorro')
        await c.click({ text: 'Sí, borrar esta factura', selector: 'button' })
        await c.expectText('Factura borrada')
        await c.goTab('Mi ahorro')
        await c.expectText('Todavía no podemos saberlo')
      },
    },
  ],
}

// ───────────────────────────────── 3. Cuando algo falla ─────────────────────────────────
const failures: Tour = {
  id: 'fallas',
  title: 'Cuando algo falla',
  subtitle: 'Errores que se entienden',
  icon: Siren,
  steps: [
    {
      title: 'Empieza su paso',
      explain: 'Arrancamos con el plan de burletes en marcha.',
      async run(c) {
        await c.reset()
        await c.click({ text: 'Quiero empezar', selector: 'button' })
        await c.expectText('En marcha')
      },
    },
    {
      title: 'La IA no responde',
      explain: 'Simulamos que el proveedor de IA se cae. Inés no ve un error técnico: ve los pasos de la guía y puede reintentar.',
      covers: 'Integraciones · "IA caída"',
      async run(c) {
        c.setAiDown(true)
        await c.click('[aria-label="¿Cómo hago \\"Programar descongelamiento\\"?"]')
        await c.expectText('no están disponibles ahora')
        await c.expectText('Los pasos de la guía')
        await c.expectText('Reintentar')
        await c.sleep(1200)
        await c.closeDrawer()
        c.setAiDown(false)
      },
    },
    {
      title: 'Fecha de término antes de empezar',
      explain: 'Pone el 5 de junio por error. En vez de "fecha inválida", le decimos qué pasó con sus fechas y qué elegir.',
      covers: 'Errores · "Fecha de término anterior al inicio"',
      async run(c) {
        await c.click({ text: 'Ya lo terminé', selector: 'button' })
        await c.waitFor('#done-date')
        await c.type('#done-date', '2026-06-05')
        await c.click({ text: 'Listo, lo terminé', selector: 'button' })
        c.highlight('#done-date-msg')
        await c.expectText('Pusiste el 5 de junio, pero empezaste este paso el 1 de julio')
      },
    },
    {
      title: 'Fecha en el futuro',
      explain: 'Ahora elige un día que todavía no llegó. También se lo explicamos.',
      covers: 'Errores · "Fecha de término en el futuro"',
      async run(c) {
        await c.type('#done-date', plusDays(40))
        await c.click({ text: 'Listo, lo terminé', selector: 'button' })
        c.highlight('#done-date-msg')
        await c.expectText('todavía no llegó')
      },
    },
    {
      title: 'Fecha correcta',
      explain: 'Con el 10 de julio queda guardado y vamos a su ahorro.',
      async run(c) {
        await c.type('#done-date', '2026-07-10')
        await c.click({ text: 'Listo, lo terminé', selector: 'button' })
        await c.expectText('Todavía no podemos saberlo')
      },
    },
    {
      title: 'Guarda sin escribir nada',
      explain: 'El campo queda en rojo con un ejemplo de qué escribir. Nada de "campo requerido".',
      covers: 'Errores · "Varios datos mal"',
      async run(c) {
        await c.goTab('Facturas')
        await c.click({ text: 'Subir factura de luz', selector: 'button' })
        await c.waitFor('#bill-kwh')
        await c.click({ text: 'Guardar factura', selector: '[data-slot="drawer-footer"] button' })
        c.highlight('#bill-kwh-msg')
        await c.expectText('Escribe los kWh que dice tu factura')
      },
    },
    {
      title: '"84" en vez de "0,84"',
      explain: 'Un error típico al tipear el precio. Le sugerimos el valor correcto.',
      covers: 'Errores · "Varios datos mal" (precio)',
      async run(c) {
        await c.type('#bill-kwh', '1.800')
        await c.type('#bill-price', '84')
        await c.click({ text: 'Guardar factura', selector: '[data-slot="drawer-footer"] button' })
        c.highlight('#bill-price-msg')
        await c.expectText('¿Quisiste poner 0,84?')
      },
    },
    {
      title: 'Un cero de más',
      explain: 'Escribe 18.000 en vez de 1.800. No lo bloqueamos (podría ser cierto), pero le avisamos y le pedimos confirmar.',
      covers: 'Prevenir · "Un cero de más"',
      async run(c) {
        await c.type('#bill-price', '0,84')
        await c.type('#bill-kwh', '18.000')
        c.highlight('#bill-kwh-msg')
        await c.expectText('bastante más de lo normal')
        await c.click({ text: 'Guardar factura', selector: '[data-slot="drawer-footer"] button' })
        await c.expectText('Sí, está bien. Guardar')
      },
    },
    {
      title: 'Fechas que se cruzan con junio',
      explain: 'Cada día va en una sola factura. Le decimos con cuál choca y le damos un atajo para revisar esa.',
      covers: 'Errores · "Fechas de factura que se cruzan con otra"',
      async run(c) {
        await c.type('#bill-kwh', '1.800')
        await c.click({ text: 'Cambiar fechas', selector: 'button' })
        await c.type('#bill-start', '2026-06-15')
        await c.type('#bill-end', '2026-07-14')
        await c.click({ text: 'Guardar factura', selector: '[data-slot="drawer-footer"] button' })
        c.highlight('#bill-dates-msg')
        await c.expectText('se cruzan con tu factura de junio')
        await c.click({ text: 'Ver la de junio', selector: 'button' })
        await c.expectText('Factura de junio')
        await c.sleep(1000)
        await c.closeDrawer()
      },
    },
    {
      title: '¿Dónde está ese dato?',
      explain: 'Si no entiende la factura, le mostramos una de ejemplo con cada dato marcado y cómo suele llamarse.',
      covers: 'Prevenir · "No sabe dónde está el dato"',
      async run(c) {
        await c.click({ text: 'Subir factura de luz', selector: 'button' })
        await c.click({ text: '¿Dónde encuentro estos datos en mi factura?', selector: 'button' })
        c.highlight('[aria-label="Factura de luz de ejemplo"]')
        await c.expectText('Consumo (energía activa)')
        await c.expectText('Precio unitario')
        await c.sleep(1500)
        await c.click({ text: '¿Dónde encuentro estos datos en mi factura?', selector: 'button' })
      },
    },
    {
      title: 'Se queda sin señal',
      explain: 'Simulamos que el celular pierde la conexión y trata de guardar. Le decimos que es la señal y que lo que escribió sigue ahí.',
      covers: 'Errores · "Sin señal"',
      async run(c) {
        c.setOffline(true)
        await c.expectText('Estás sin señal')
        await c.type('#bill-kwh', '1.800')
        await c.click({ text: 'Guardar factura', selector: '[data-slot="drawer-footer"] button' })
        c.highlight({ text: 'Sin conexión', selector: 'p', closest: '[role="alert"]' })
        await c.expectText('Lo que escribiste sigue aquí')
        c.check('El número que escribió sigue en el campo', (c.find('#bill-kwh') as HTMLInputElement | null)?.value === '1.800')
      },
    },
    {
      title: 'Vuelve la señal y reintenta',
      explain: 'Con un toque en "Intentar de nuevo" se guarda, sin volver a escribir nada.',
      async run(c) {
        c.setOffline(false)
        await c.click({ text: 'Intentar de nuevo', selector: 'button' })
        await c.expectText('Factura guardada')
      },
    },
    {
      title: 'La foto no se lee',
      explain: 'Sube agosto con una foto borrosa. La factura cuenta igual con los números que escribió; solo le pedimos, sin apuro, otra foto para que su ahorro quede verificado ante el programa.',
      covers: 'Integraciones · "Foto de factura ilegible o ausente"',
      async run(c) {
        await c.click({ text: 'Subir factura de luz', selector: 'button' })
        await c.waitFor('#bill-kwh')
        await c.type('#bill-kwh', '1.767')
        await c.attachFile('input[type="file"]', 'factura-borrosa.jpg')
        await c.expectText('factura-borrosa.jpg')
        await c.click({ text: 'Guardar factura', selector: '[data-slot="drawer-footer"] button' })
        await c.expectText('Factura guardada')
        c.highlight({ text: 'La foto no se lee', selector: 'p', closest: 'button' })
        await c.expectText('La foto no se lee: toca para subir otra')
        await c.click({ text: 'Agosto 2026', selector: 'main button' })
        await c.expectText('No pudimos leer la foto de esta factura')
        await c.expectText('Tu factura cuenta igual')
        await c.sleep(1500)
        await c.closeDrawer()
      },
    },
  ],
}

// ───────────────────────────────── 4. Lo que ven los aliados ─────────────────────────────────
const allies: Tour = {
  id: 'aliados',
  title: 'Lo que ven los aliados',
  subtitle: 'Ahorro medido para quienes financian',
  icon: Landmark,
  steps: [
    {
      title: 'Preparamos el programa',
      explain: 'Atajo: Inés ya terminó burletes y subió julio, agosto y septiembre. Junto a 6 panaderías ficticias, arma el reporte que verían los aliados.',
      async run(c) {
        await setupCompleted(c)
        for (const b of [
          { kwhConsumed: 1800, costPerKwh: 0.84, billingStartDate: '2026-07-01', billingEndDate: '2026-07-31', uploadedFiles: ['jul.jpg'] },
          { kwhConsumed: 1767, costPerKwh: 0.84, billingStartDate: '2026-08-01', billingEndDate: '2026-08-31', uploadedFiles: ['ago.jpg'] },
          { kwhConsumed: 1665, costPerKwh: 0.86, billingStartDate: '2026-09-01', billingEndDate: '2026-09-30', uploadedFiles: ['sep.jpg'] },
        ])
          await c.api.addBill(b)
        await c.refresh()
        await c.setView('allies')
        await c.expectText('Vista para aliados')
      },
    },
    {
      title: 'Primero, la verdad sobre los datos',
      explain: 'Arriba de todo dice que los datos son ficticios. Un reporte para inversores no puede dejar dudas sobre de dónde salen los números.',
      async run(c) {
        c.highlight('[data-tour="ally-data-note"]')
        await c.expectText('Datos ficticios del caso')
      },
    },
    {
      title: 'Ahorro medido, no declarado',
      explain: 'La mediana de ahorro sale solo de negocios con ahorro medido en sus facturas, y se publica recién con 5 negocios o más. También el total de kWh y de CO₂ evitado por mes.',
      covers: 'Ahorro · "Reporte para aliados" (meta: "ahorro medido, no declarado")',
      async run(c) {
        c.highlight('[data-tour="ally-kpis"]')
        await c.expectText('Ahorro medido (mediana)')
        await c.expectText('CO₂ evitado / mes')
      },
    },
    {
      title: 'De cada 10 que eligen…',
      explain: 'El enunciado dice que hoy, de cada 10 negocios que eligen una ecoinnovación, 3 la completan y 1 deja facturas de antes y después. Aquí se ve ese embudo, contra esa línea de base.',
      covers: 'Meta del programa · embudo “10 → 3 → 1”',
      async run(c) {
        c.highlight('[data-tour="ally-funnel"]')
        await c.expectText('De cada 10 negocios que eligen una ecoinnovación')
        await c.expectText('antes 3')
        await c.expectText('antes 1')
      },
    },
    {
      title: 'La meta de los 90 días',
      explain: 'Cuántos negocios con ahorro medido lo lograron dentro de sus primeros 90 días en Kamai. Inés no: su primera recomendación no le servía y perdió meses. Eso es lo que este cambio busca evitar.',
      covers: 'Meta del programa · “ahorro real en sus primeros 90 días”',
      async run(c) {
        c.highlight('[data-tour="ally-goal"]')
        await c.expectText('Meta: ahorro real en los primeros 90 días')
        await c.expectText('lo lograron dentro de sus primeros 90 días')
      },
    },
    {
      title: 'Lo declarado, al lado, nunca sumado',
      explain: 'El formulario de impacto percibido sigue existiendo, pero se muestra separado. Hay negocios que dicen que les fue bien y todavía no lo podemos confirmar.',
      covers: 'Ahorro · "medido vs declarado"',
      async run(c) {
        c.highlight('[data-tour="ally-declared"]')
        await c.expectText('impacto pero todavía no lo podemos confirmar')
      },
    },
    {
      title: 'Sin exponer a nadie',
      explain: 'El detalle por negocio usa un código anónimo: sin nombres, emails ni montos en soles. Con la evidencia de cada uno (si las facturas tienen foto verificada).',
      covers: 'Datos de otros negocios · k-anonimato y vista para aliados sin datos personales',
      async run(c) {
        c.highlight('[data-tour="ally-rows"]')
        await c.expectText('Detalle por negocio (anónimo)')
        const text = document.querySelector('main')?.textContent ?? ''
        c.check('No aparece “Inés” ni ningún email', !text.includes('Inés Huamán') && !text.includes('@'))
        c.check('No aparecen montos en soles por negocio', !/S\/\s?\d/.test(document.querySelector('[data-tour="ally-rows"]')?.textContent ?? ''))
      },
    },
    {
      title: 'Cómo medimos',
      explain: 'El mismo método que ve Inés, contado para aliados, con su versión. Si cambia el método, se sabe desde cuándo.',
      async run(c) {
        c.highlight('[data-tour="ally-method"]')
        await c.expectText('Solo cuenta como ahorro si todo el rango probable')
        await c.expectText('Método savings-v1')
      },
    },
    {
      title: 'Volver a la app de Inés',
      explain: 'Un mismo dato, dos vistas: a ella le hablamos de su negocio y en soles; a los aliados, del programa en kWh, CO₂ y negocios con ahorro medido.',
      async run(c) {
        await c.setView('owner')
        await c.expectText('Hola, Inés')
      },
    },
  ],
}

export const TOURS: Tour[] = [happy, honesty, failures, allies]
