# Qué cubre cada punto del enunciado

Para cada pedido del PDF anoté dónde está la decisión (D1 a D13 en `design.md`), dónde está el código, qué prueba lo verifica y en qué recorrido se ve. Recorridos: F = camino feliz, H = honestidad, X = cuando algo falla, A = aliados.

## La meta

| Pedido | Decisión | Código | Prueba | Recorrido |
|---|---|---|---|---|
| Ahorro real en los primeros 90 días | D3, D5 | `goal90Days` en el reporte y en la vista de aliados | e2e del reporte | A |
| Mostrar a los aliados ahorro medido y no declarado | D12 | `/allies/report` y la vista de aliados | e2e del reporte | A |
| Hoy, de cada 10 que eligen, 3 completan y 1 deja facturas | D12 | embudo con esa línea de base | e2e del reporte | A |

## 1. Recomendación

| Pedido | Decisión | Código | Prueba | Recorrido |
|---|---|---|---|---|
| Elegir la primera para Inés y explicar por qué | D2, D4 | `recommendFirstStep`, `explainRecommendation` | recommendation.test | F |
| a. El catálogo no tiene montos | D3 | bandas en `REC_CONFIG` | "excluye lo que no entra en S/ 1.200" | F |
| b. Hay pocos casos | D2, D9 | `smoothedRate`, `shrunkEffectPct`, `publicPeerStat` | "1 de 2 no pesa como 7 de 9" | F |
| c. Negocio nuevo sin facturas | D4 | aviso para subir 3 facturas | e2e de la panadería nueva | F |
| d. Que los 4 lugares digan lo mismo | D1 | endpoint único con `surface` | e2e de los 4 lugares | F |

## 2. Cuánta IA

| Pedido | Decisión | Código | Recorrido |
|---|---|---|---|
| Qué técnica y para qué parte | D10 | reglas y estadística simple; LLM solo en subtareas, con respaldo | F, X |

## 3. Cómo se mide el ahorro

| Pedido | Decisión | Código | Prueba | Recorrido |
|---|---|---|---|---|
| a. Contra qué se compara | D5 | `classifyBills` | línea base de Inés | H |
| b. Días | D5 | `normalizeBill` | "el ahorraste S/ 117 de febrero" | H |
| b. Tarifa | D5 | `tariffEffect` | "valoriza a la tarifa vigente" | F, H |
| b. Temporada | D5 | aviso en cada medición | "no corrige por temporada" | F |
| c. Cuándo decir "todavía no podemos saberlo" | D5 | los 5 estados de `measureSavings` | pruebas de cada estado | F, H |
| d. Qué ve ella y qué ven los aliados | D5, D12 | app de Inés y vista de aliados | e2e del reporte | F, A |

## 4. Cuando algo falla

| Pedido | Decisión | Código | Prueba | Recorrido |
|---|---|---|---|---|
| La IA no responde | D8 | respaldo con los pasos del catálogo | integrations.test, e2e | X |
| Un correo no sale | D8 | cola con reintentos y sin repetir | integrations.test, e2e | H |
| La foto no se puede leer | D8 | estado de la foto y aviso | e2e de foto ilegible | X |
| Editar o borrar sin contar dos veces | D7 | recálculo desde cero | pruebas de edición y borrado | H |
| Sin cifras contradictorias | D13 | aviso con fecha y cifra anterior, historial | e2e "si edita septiembre" | H |

## 5. Datos de otros negocios

| Pedido | Decisión | Código | Prueba | Recorrido |
|---|---|---|---|---|
| No exponer a nadie, desde cuántos mostrar un promedio | D9 | umbral de 5, redondeo, código anónimo | "no publica con menos de 5" | F, A |

## 6. Tecnologías

Están en la sección "Tecnologías" del diseño: Node, Express, MongoDB, zod; React, Vite, Tailwind, shadcn; Vitest, supertest, mongodb-memory-server.

## Anexo

- Ecoinnovación: respeto que `ciiuCodes` vacío significa "todos los sectores" y agrego `targetLoads`.
- Factura: devuelvo `totalCost` y `co2Equivalent`, y rechazo períodos superpuestos.
- Plan: mismos estados, con tres campos nuevos de fecha y origen.
- Subtareas: el 402 sin cupo tiene respaldo.
- Correo: un envío por persona y plantilla, y nada a direcciones que rebotaron.
- Impacto percibido: escala y texto libre.

## Lo que no hice

Agua, lectura real de la foto, corrección por temporada, ahorro total de dos ecoinnovaciones a la vez, el cálculo nocturno de datos de pares, autenticación de los endpoints internos e integraciones reales. Además, los números de la vista de aliados salen de datos inventados, y la pantalla lo aclara.
