# resilient-integrations

## ADDED Requirements

### Requirement: La IA es opcional
La recomendación, la explicación y la medición del ahorro MUST NOT depender del proveedor de IA. Si el proveedor no responde (timeout o 5xx), el endpoint de subtareas MUST responder 200 con los pasos estáticos del catálogo, `source: "static"` y `retryable: true`. Si responde 402 (sin cupo ni créditos), MUST responder con `reason: "NO_QUOTA"` y `retryable: false`.

#### Scenario: IA caída
- **WHEN** Inés pide subtareas y el proveedor de IA no responde
- **THEN** recibe 200 con los pasos "Revisar burletes", "Programar descongelamiento" y "Registrar consumo"
- **AND** el mensaje dice que puede reintentar más tarde

#### Scenario: Sin cupo
- **WHEN** el proveedor responde 402
- **THEN** recibe 200 con los pasos estáticos y el mensaje de que usó las sugerencias del mes
- **AND** no se ofrece comprar créditos en ese momento

#### Scenario: IA disponible
- **WHEN** el proveedor responde bien
- **THEN** `source` es `"ai"` con las subtareas generadas

### Requirement: Correos con outbox idempotente
Los correos MUST encolarse en un outbox con clave única `negocio:plantilla:referencia` y entregarse fuera del request, mediante un job programado. Ante una falla MUST reintentarse con backoff de 1, 5, 30, 120 y 720 minutos, y después quedar en `failed`. Las direcciones que rebotaron MUST quedar `suppressed` sin envío. El aviso dentro de la app MUST ser la fuente de verdad.

#### Scenario: Ahorro medido avisa una vez
- **WHEN** la medición de un plan pasa a `MEASURED`
- **THEN** se encola un correo `savings-measured` para ese plan
- **AND** recalcular de nuevo no encola otro

#### Scenario: El servicio de mensajería falla
- **WHEN** el primer intento de envío falla
- **THEN** el mensaje queda `pending` con `attempts = 1` y un próximo intento a 1 minuto
- **AND** cuando pasa ese tiempo se reintenta y queda `sent`
- **AND** Inés recibe un solo correo

#### Scenario: Dirección rebotada
- **WHEN** el negocio tiene `emailBounced = true`
- **THEN** el mensaje queda `suppressed` y nunca se envía

### Requirement: Foto de factura ilegible o ausente
Una factura MUST aceptarse con los datos cargados a mano aunque su foto no se pueda leer o no exista. La evidencia MUST registrarse como `photo` o `none`. El reporte a aliados MUST distinguir las mediciones con foto, parciales y sin foto. Cualquier lectura automática futura (OCR) MUST limitarse a proponer valores que la persona confirma.

#### Scenario: Sin foto
- **WHEN** se sube una factura sin archivos
- **THEN** se guarda con `evidence = "none"` y cuenta para la medición de la dueña

#### Scenario: Reporte con evidencia
- **WHEN** se genera el reporte para aliados con negocios que no subieron fotos
- **THEN** sus filas tienen `evidence = "none"`

### Requirement: Liviano para celular
Las respuestas para la dueña MUST traer los textos ya redactados por el servidor. La pantalla de referencia MUST funcionar sin build ni librerías externas.

#### Scenario: Pantalla de referencia
- **WHEN** se abre la pantalla en un celular de 375 px de ancho
- **THEN** se ve el primer paso, el ahorro medido y las facturas sin desplazamiento horizontal

### Requirement: Errores que una persona entiende
Todo error que vea la dueña MUST decir qué pasó con sus propios datos (fechas en palabras, la factura con la que choca, el valor que escribió) y qué hacer para resolverlo. La API MUST responder con `{ error, message, hint, field?, fields? }`, en lenguaje simple y sin jerga técnica.

#### Scenario: Fecha de término anterior al inicio
- **WHEN** Inés marca que terminó el 5 de junio un paso que empezó el 1 de julio
- **THEN** la respuesta es 400 `COMPLETED_BEFORE_START`, con `field = "completedAt"` y `minDate = "2026-07-01"`
- **AND** dice "Pusiste el 5 de junio, pero empezaste este paso el 1 de julio." con la pista "Elige un día desde el 1 de julio en adelante."

#### Scenario: Fecha de término en el futuro
- **WHEN** marca como fecha de término un día que todavía no llegó
- **THEN** la respuesta es 400 `COMPLETED_IN_FUTURE`, dice que ese día todavía no llegó y sugiere elegir hoy o un día anterior

#### Scenario: Doble toque en "Listo"
- **WHEN** envía dos veces la misma fecha de término
- **THEN** la segunda vez responde 200 (no es un error)
- **AND** si envía otra fecha, responde 409 `PLAN_ALREADY_COMPLETED` con la fecha original

#### Scenario: Fechas de factura que se cruzan con otra
- **WHEN** sube una factura del 15 de junio al 14 de julio y ya existe la de junio
- **THEN** la respuesta es 409 `OVERLAPPING_PERIOD` y nombra la factura de junio con sus fechas
- **AND** devuelve `conflictsWith`, y la pantalla ofrece "Ver la de junio" para corregirla

#### Scenario: Varios datos mal
- **WHEN** envía kWh negativos, un precio de 84 y la fecha de fin antes del inicio
- **THEN** la respuesta es 400 `VALIDATION` con un mensaje por campo
- **AND** para el precio sugiere "¿Quisiste poner 0,84 en vez de 84?"

### Requirement: Tres tipos de error y nada se pierde
La pantalla MUST distinguir tres casos: "lo puedes arreglar tú" (marca el campo con su mensaje), "sin conexión" (puede reintentar) y "problema nuestro" ("no es tu culpa"). Un error MUST NOT borrar lo que la persona escribió.

#### Scenario: Sin señal
- **WHEN** intenta guardar una factura sin conexión
- **THEN** ve "Sin conexión" y que lo que escribió sigue ahí, con el botón "Intentar de nuevo", y el formulario conserva los valores
- **AND** el guardado no queda colgado en "Guardando…"

### Requirement: Prevenir antes que corregir
La pantalla MUST limitar los calendarios a fechas posibles (desde que empezó hasta hoy) y sugerir el periodo y el precio de la próxima factura. MUST mostrar avisos suaves, que no bloquean y piden confirmar, cuando un valor se aleja mucho de lo normal en ese negocio: un cero de más o de menos en los kWh, o un precio muy distinto al de la última factura. MUST ofrecer una guía de dónde encontrar cada dato en la factura.

#### Scenario: Un cero de más
- **WHEN** escribe 18.000 kWh para un mes en que su consumo normal es de ~1.800
- **THEN** ve el aviso "Son 580,6 kWh por día, bastante más de lo normal en tu negocio (≈ 59,9). ¿Está bien el número?"
- **AND** el botón pasa a "Sí, está bien. Guardar"

#### Scenario: No sabe dónde está el dato
- **WHEN** toca "¿Dónde encuentro estos datos en mi factura?"
- **THEN** ve una factura de ejemplo con el periodo, el consumo en kWh y el precio por kWh marcados
- **AND** los nombres que suelen tener en la factura

### Requirement: Estado de la foto de la factura
Cada factura con foto MUST tener `photoStatus` (`readable` | `unreadable`), revisado al subirla o al cambiar la foto. Si la foto no se lee, la factura MUST contar igual para la dueña, la pantalla MUST explicarlo y ofrecer subir otra foto, y para los aliados la medición MUST quedar como "sin verificar".

#### Scenario: Foto borrosa
- **WHEN** Inés sube una factura con una foto que no se puede leer
- **THEN** la factura se guarda con `photoStatus = "unreadable"` y cuenta para su ahorro
- **AND** en "Facturas" ve "La foto no se lee: toca para subir otra"

#### Scenario: Sube otra foto
- **WHEN** reemplaza la foto por una legible
- **THEN** `photoStatus` pasa a `readable`
