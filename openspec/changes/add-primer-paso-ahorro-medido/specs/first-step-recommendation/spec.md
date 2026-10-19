# first-step-recommendation

## ADDED Requirements

### Requirement: Fuente única de recomendación
El sistema MUST exponer un único endpoint `GET /businesses/:id/recommendations/first-step?surface=` como la única fuente de recomendación del primer paso. Inicio, catálogo, diagnóstico por etapas y correo de bienvenida MUST consumirlo en lugar de calcular por su cuenta.

#### Scenario: Los cuatro lugares dicen lo mismo
- **WHEN** se pide la recomendación de Inés con `surface` igual a `home`, `catalog`, `diagnosis` y `email`, sin que cambien sus datos
- **THEN** las cuatro respuestas recomiendan la misma ecoinnovación (`eco_118`)
- **AND** devuelven el mismo `recommendationId`
- **AND** queda una sola recomendación guardada

#### Scenario: Superficie desconocida
- **WHEN** se pide la recomendación con `surface=foo`
- **THEN** la respuesta es 400 con código `BAD_SURFACE`

#### Scenario: Negocio inexistente
- **WHEN** se pide la recomendación de un negocio que no existe
- **THEN** la respuesta es 404

### Requirement: Trazabilidad del porqué
Cada recomendación MUST guardarse con `ecoId`, `reasons[]` (códigos), `score` con sus componentes, `excluded[]` con su motivo, `rulesVersion` e `inputsHash`. El plan creado al aceptarla MUST guardar `recommendationId`.

#### Scenario: Se guarda la razón y la versión
- **WHEN** se calcula la recomendación de Inés
- **THEN** queda guardada con `rulesVersion = "rec-v1"`
- **AND** sus razones incluyen `TARGETS_MAIN_LOAD`, `LOW_INVESTMENT`, `LOW_COMPLEXITY`, `FITS_BUDGET_AND_TIME` y `PEERS_USUALLY_COMPLETE`

#### Scenario: El plan recuerda de qué recomendación vino
- **WHEN** Inés acepta el primer paso con `recommendationId`
- **THEN** el plan creado tiene `status = in_progress`, `startedAt` y ese `recommendationId`

#### Scenario: Recalcular sin cambios no duplica
- **WHEN** se pide la recomendación varias veces y el `inputsHash` no cambió
- **THEN** se reutiliza la recomendación guardada y no se crea otra

### Requirement: Filtros duros por presupuesto, tiempo, rubro y estado
El sistema MUST excluir las ecoinnovaciones que no apliquen al rubro (CIIU), las de otro tema, las ya completadas o en plan, aquellas cuyo piso de banda de inversión supere el presupuesto del trimestre y aquellas cuyas horas típicas superen las horas semanales disponibles. Cada exclusión MUST registrarse con su motivo.

#### Scenario: Lo que no entra en S/ 1.200 queda fuera
- **WHEN** se recomienda para Inés (presupuesto S/ 1.200, 4 h/semana)
- **THEN** el calentador solar queda excluido con motivo `OVER_BUDGET`
- **AND** el aislamiento térmico queda excluido con motivo `ALREADY_IN_PLAN`

#### Scenario: Ecoinnovación exclusiva de otro rubro
- **WHEN** se recomienda para un negocio con CIIU distinto de panadería
- **THEN** "Hornear por tandas" queda excluida con motivo `NOT_FOR_SECTOR`

#### Scenario: Con más presupuesto y tiempo
- **WHEN** el negocio declara S/ 5.000 y 10 horas por semana
- **THEN** el aislamiento térmico no se excluye por presupuesto

### Requirement: Puntaje transparente con pocos casos
El sistema MUST ordenar las candidatas con un puntaje lineal de cuatro componentes: coincidencia con los equipos que más consumen (0,30), factibilidad (0,25), tasa de completitud de pares **suavizada** hacia 0,3 con fuerza 4 (0,25) y efecto de pares **encogido** por `n/(n+3)` con tope de 20% (0,20). El desempate MUST ser estable: menor inversión y luego id. El cálculo MUST ser determinista.

#### Scenario: Primer paso de Inés
- **WHEN** se recomienda para Inés con su perfil, sus 6 facturas y los datos de las 23 panaderías
- **THEN** la recomendada es "Mantenimiento de burletes y descongelamiento de refrigeradoras" (puntaje 0,742)
- **AND** la primera alternativa es "Hornear por tandas" (0,649)

#### Scenario: Un caso no pesa como nueve
- **WHEN** se compara una ecoinnovación que completaron 1 de 2 con otra que completaron 7 de 9
- **THEN** la tasa suavizada de la primera (≈ 0,37) es menor que la de la segunda (≈ 0,63)

#### Scenario: Sin equipos declarados
- **WHEN** el negocio no declaró sus equipos principales
- **THEN** la coincidencia de carga vale 0,5 para todas, sin favorecer ni castigar a ninguna

#### Scenario: Determinismo
- **WHEN** se calcula dos veces con las mismas entradas
- **THEN** el resultado y el `inputsHash` son idénticos

### Requirement: Plan trabado y siguiente paso
El sistema MUST detectar los planes sin cambios en 42 días o más y sugerir pausarlos con un mensaje que no culpe. MUST indicar como siguiente paso la mejor alternativa que ataque un equipo principal. Una vez aceptado un primer paso, la respuesta MUST incluir `firstStepPlan` con el plan en curso, y la recomendación pasa a ser el siguiente paso.

#### Scenario: Aislamiento trabado
- **WHEN** se recomienda para Inés al 1/7/2026 y el aislamiento no tiene cambios desde el 13/5
- **THEN** `stalledPlans` incluye el aislamiento con 7 semanas y la sugerencia `PAUSE_AND_START_SMALLER`

#### Scenario: Después de aceptar
- **WHEN** Inés ya aceptó burletes y vuelve a pedir su primer paso
- **THEN** `firstStepPlan` es el plan de burletes en curso
- **AND** la recomendación devuelta es "Hornear por tandas" como siguiente

### Requirement: Negocio sin facturas
El sistema MUST recomendar aunque el negocio no tenga facturas. En ese caso MUST pedir las facturas que faltan para llegar a 3 antes de empezar.

#### Scenario: Negocio nuevo
- **WHEN** se recomienda para un negocio sin facturas
- **THEN** hay una ecoinnovación recomendada
- **AND** `measurement` es `{ needsBaseline: true, billsAvailable: 0, billsNeeded: 3 }`
- **AND** la explicación incluye "Antes de empezar, sube 3 factura(s)"

### Requirement: Explicación simple y privada
La explicación MUST generarse con plantillas deterministas, sin LLM. Solo MUST citar cifras de otros negocios cuando haya 5 o más negocios detrás del dato, redondeadas ("x de cada 10", % entero). Por debajo del umbral MUST usar un texto cualitativo.

#### Scenario: Cifra de completitud sí, cifra de ahorro no
- **WHEN** se explica burletes a Inés (9 negocios la eligieron, 4 tienen facturas de antes y después)
- **THEN** la explicación dice "8 de cada 10 panaderías que la eligieron la terminaron"
- **AND** no menciona el −6%
- **AND** dice que todavía hay pocas mediciones

#### Scenario: Un solo caso nunca se muestra
- **WHEN** se prepara la estadística pública del aislamiento (1 negocio con facturas)
- **THEN** no se publica ninguna cifra de efecto

#### Scenario: Con cinco casos sí se muestra
- **WHEN** se prepara la estadística pública de LED (5 negocios con facturas)
- **THEN** se publica la mediana de −4%
