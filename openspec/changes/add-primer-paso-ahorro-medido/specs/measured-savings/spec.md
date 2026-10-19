# measured-savings

## ADDED Requirements

### Requirement: Normalización por día
El sistema MUST comparar consumos en kWh por día. Los días del periodo se cuentan de forma inclusiva y los promedios se ponderan por días. El listado de facturas MUST explicar cuándo la resta simple en soles engaña.

#### Scenario: El "ahorraste S/ 117" de febrero
- **WHEN** se comparan las facturas de enero (31 días, 1.840 kWh) y febrero (28 días, 1.690 kWh)
- **THEN** la resta simple da ≈ S/ 117
- **AND** el consumo por día de febrero es 1,7% mayor
- **AND** la comparación queda marcada `NAIVE_SAVING_IS_MISLEADING`

#### Scenario: Total de factura
- **WHEN** se normaliza la factura de febrero (1.690 kWh × 0,78)
- **THEN** su total es S/ 1.318,20

### Requirement: Línea base propia y periodos posteriores
El sistema MUST usar como línea base los periodos que terminan antes de `startedAt`, con al menos 3 facturas y 80 días. MUST usar como posteriores los periodos que empiezan en `completedAt` o después. MUST excluir y declarar los periodos que mezclan antes y después.

#### Scenario: Línea base de Inés
- **WHEN** Inés empieza burletes el 1/7 y la completa el 10/7
- **THEN** la línea base son sus 6 facturas de enero a junio, con 59,67 kWh/día (10.800 kWh / 181 días)
- **AND** su variación natural es ≈ 2,6%

#### Scenario: Periodo mixto
- **WHEN** existe la factura de julio (1/7 al 31/7)
- **THEN** se excluye de la medición
- **AND** se declara la limitación `TRANSITION_PERIODS_EXCLUDED`

### Requirement: Corrección por tarifa
El sistema MUST medir el ahorro en kWh y valorizarlo a la tarifa vigente (la de la factura más reciente). MUST mostrar aparte el efecto del cambio de tarifa y lo que habría mostrado la resta en soles.

#### Scenario: La tarifa esconde el ahorro
- **WHEN** Inés tiene línea base a 0,805 S/kWh promedio, y agosto y septiembre posteriores a 0,84 y 0,86
- **THEN** el ahorro valorizado es ≈ S/ 88 al mes a 0,86
- **AND** la resta en soles habría mostrado ≈ S/ 7 al mes
- **AND** se informa que la tarifa subió 6,8% y que esa subida no es su culpa

#### Scenario: Mismo consumo, tarifa más alta
- **WHEN** el consumo por día después es igual al de la línea base pero la tarifa sube a 0,95
- **THEN** el resultado no muestra ni ahorro ni pérdida de consumo (`INCONCLUSIVE`, cambio menor a 0,5%)

### Requirement: Incertidumbre y "todavía no podemos saberlo"
El sistema MUST calcular un rango de ~95% como `ahorro ± 2·ruido·√(1/n_base + 1/n_post)`, con `ruido` igual al desvío estándar de kWh/día de la línea base y un piso de 2%. MUST devolver exactamente uno de estos estados: `INSUFFICIENT_BASELINE`, `WAITING_POST_DATA`, `INCONCLUSIVE`, `MEASURED` o `INCREASED`. Solo MUST afirmar ahorro (`MEASURED`) cuando todo el rango está por encima de cero.

#### Scenario: Faltan facturas de antes
- **WHEN** hay solo 2 facturas anteriores a la implementación
- **THEN** el estado es `INSUFFICIENT_BASELINE` y se piden las facturas que faltan

#### Scenario: Recién completada
- **WHEN** la ecoinnovación se completó pero no hay una factura completa posterior
- **THEN** el estado es `WAITING_POST_DATA`
- **AND** la dueña ve "Todavía no podemos saberlo" junto con su consumo normal

#### Scenario: Una sola factura posterior dentro del ruido
- **WHEN** agosto muestra 57,0 kWh/día (−4,5%)
- **THEN** el estado es `INCONCLUSIVE`
- **AND** el rango incluye valores negativos
- **AND** la dueña ve que su consumo bajó 4,5% pero que su consumo normal varía cerca de 2,6%

#### Scenario: Ahorro medido
- **WHEN** agosto y septiembre promedian 56,26 kWh/día
- **THEN** el estado es `MEASURED`, con −5,7% (rango 1,5% a 9,9%) y ≈ S/ 88 al mes (rango S/ 23 a 153)

#### Scenario: El consumo subió
- **WHEN** después de completar el consumo es de 66 kWh/día
- **THEN** el estado es `INCREASED` y se le dice claramente

### Requirement: Sin corrección estacional con poca historia
El sistema MUST declarar `NO_SEASONAL_ADJUSTMENT` cuando hay menos de 12 meses de historia.

#### Scenario: Seis meses de historia
- **WHEN** se mide con las facturas de enero a septiembre
- **THEN** las limitaciones incluyen `NO_SEASONAL_ADJUSTMENT`

### Requirement: Recálculo idempotente ante edición y borrado
El ahorro MUST calcularse como función pura de las facturas vigentes y las fechas del plan, sin acumular incrementos. Al crear, editar o borrar una factura, el sistema MUST recalcular y guardar un snapshot solo si cambia `inputsHash`. Al mostrar el ahorro MUST comparar contra lo último que vio la dueña. Si cambió o desapareció una factura que ya había visto, MUST avisarle que la cifra anterior ya no vale. Si solo se agregaron facturas, MUST NOT presentarlo como corrección.

#### Scenario: Determinismo y orden
- **WHEN** se recalcula 5 veces, o con las facturas en otro orden
- **THEN** el resultado es idéntico

#### Scenario: Subir una factura nueva
- **WHEN** Inés sube septiembre y el estado pasa de `INCONCLUSIVE` a `MEASURED`
- **THEN** `previous.changeKind` es `NEW_BILLS`
- **AND** no se le dice que editó o borró algo

#### Scenario: Editar una factura ya vista
- **WHEN** Inés corrige septiembre a 1.750 kWh después de haber visto "Ahorras cerca de S/ 88"
- **THEN** el estado pasa a `INCONCLUSIVE`
- **AND** `previous.changeKind` es `EDITED_OR_DELETED`
- **AND** ve "Recalculamos tu resultado porque editaste o borraste una factura: la cifra anterior ya no vale"

#### Scenario: El aviso se muestra una sola vez
- **WHEN** vuelve a entrar sin nuevos cambios
- **THEN** no hay aviso de cambio

#### Scenario: Borrar facturas posteriores
- **WHEN** borra agosto y septiembre
- **THEN** el estado vuelve a `WAITING_POST_DATA`

#### Scenario: Recalcular no duplica
- **WHEN** se consulta el ahorro 3 veces sin cambios
- **THEN** no se crean snapshots con hash repetido
- **AND** no se encola un segundo correo

### Requirement: Validación de facturas
El sistema MUST rechazar con 409 una factura cuyo periodo se superponga con otra del mismo negocio. MUST rechazar con 400 los valores no positivos, una fecha de fin anterior al inicio o un periodo mayor a 62 días. Al guardar una factura MUST registrar la moneda derivada del país y la evidencia (`photo` | `none`).

#### Scenario: Superposición
- **WHEN** se sube una factura del 15/6 al 15/7 y ya existe junio
- **THEN** la respuesta es 409 `OVERLAPPING_PERIOD` con el id de la factura en conflicto

#### Scenario: Datos inválidos
- **WHEN** se sube una factura con kWh negativos y la fecha de fin antes del inicio
- **THEN** la respuesta es 400 `VALIDATION` con el detalle de cada campo

#### Scenario: Moneda
- **WHEN** Inés (Perú) sube una factura
- **THEN** la factura queda con `currency = "S/"`

### Requirement: Reporte para aliados
El sistema MUST ofrecer un reporte agregado que:
- separe lo medido de lo declarado (impacto percibido);
- identifique cada negocio solo con un hash salado;
- no incluya nombre, email ni dinero individual;
- marque la evidencia (`photo` | `partial` | `none`);
- publique mediana y total solo con 5 o más negocios en estado `MEASURED`.

#### Scenario: Menos de cinco medidos
- **WHEN** hay 4 negocios medidos
- **THEN** `published` es `false` y se explica que se publica desde 5

#### Scenario: Cinco o más medidos
- **WHEN** hay 5 negocios medidos y 1 sin determinar
- **THEN** se publica la mediana de ahorro (%) y el total de kWh por mes
- **AND** el conteo por estado incluye el sin determinar

#### Scenario: Sin datos personales
- **WHEN** se genera el reporte
- **THEN** no contiene "Inés", ningún email ni ningún id interno de negocio

### Requirement: Aviso de corrección con fecha y cifra anterior
Cuando una factura que la dueña ya había visto cambia o se borra, el sistema MUST decir cuándo pasó, qué factura fue, de cuánto a cuánto cambió y qué pasa con la cifra que ya había visto. Después del primer aviso, la última corrección MUST quedar a la vista en "Mi ahorro" y en el historial de "Facturas".

#### Scenario: Corrige septiembre después de ver S/ 88
- **WHEN** Inés vio "Ahorras cerca de S/ 88 al mes" y el 10 de julio corrige septiembre de 1.665 a 1.750 kWh
- **THEN** ve "El 10 de julio corregiste tu factura de septiembre: de 1.665 a 1.750 kWh. Por eso recalculamos tu resultado: antes te mostrábamos S/ 88 al mes y esa cifra ya no vale."

#### Scenario: Después del aviso
- **WHEN** vuelve a entrar a "Mi ahorro"
- **THEN** no se repite el aviso grande
- **AND** `lastCorrection` muestra "El 10 de julio corregiste tu factura de septiembre: de 1.665 a 1.750 kWh."
- **AND** en "Facturas" la factura dice "Corregida el 10 de julio" y aparece en "Tus cambios recientes"

### Requirement: Consultar no cuenta como visto
Consultar el ahorro (`GET /plans/:id/savings`) MUST NOT cambiar qué vio la dueña. Solo la pantalla "Mi ahorro", al mostrarlo, MUST marcarlo con `POST /plans/:id/savings/seen { inputsHash }`. Si el hash ya no es el vigente, MUST NOT marcarlo.

#### Scenario: Corrige desde Facturas
- **WHEN** corrige una factura desde "Facturas", que consulta el ahorro para el gráfico
- **THEN** el aviso de corrección la espera en "Mi ahorro"

#### Scenario: Versión vieja
- **WHEN** se intenta marcar como visto un `inputsHash` que ya no es el vigente
- **THEN** la respuesta es `{ ok: false, reason: "STALE" }` y no se marca

### Requirement: CO₂ equivalente
Cada factura MUST incluir `co2Equivalent` (kg) según el contrato del anexo, con un factor de red por país configurable. La medición MUST incluir `co2AvoidedKgPerMonth` cuando hay ahorro.

#### Scenario: Factura de febrero
- **WHEN** se listan las facturas de Inés (Perú, factor 0,21 kg/kWh)
- **THEN** febrero (1.690 kWh) tiene `co2Equivalent` ≈ 354,9 kg

### Requirement: Vista para aliados del programa
El reporte para aliados MUST incluir el embudo por cada 10 contra la línea de base del enunciado, la meta de 90 días, lo declarado frente a lo medido y los totales de kWh y CO₂ evitados (solo con 5 o más negocios medidos). La pantalla MUST aclarar cuándo los datos son de demostración.

#### Scenario: Embudo contra la línea de base
- **WHEN** se genera el reporte
- **THEN** `program.funnel.baselinePer10` es `{ completed: 3, withBeforeAfter: 1 }`
- **AND** cada etapa del embudo (eligieron, completaron, con facturas de antes y después, con ahorro medido) es menor o igual que la anterior

#### Scenario: Meta de 90 días
- **WHEN** hay negocios con ahorro medido
- **THEN** `goal90Days.measuredWithin90` cuenta los que lo confirmaron dentro de sus primeros 90 días desde `joinedAt`

#### Scenario: Datos de demostración
- **WHEN** la vista muestra datos de la demo
- **THEN** arriba de todo dice "Datos de demostración"
