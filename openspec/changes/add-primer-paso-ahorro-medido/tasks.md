# Tareas

Las ordené para tener algo medible lo antes posible. Marqué con [x] lo que quedó construido y probado en este repo.

## 1. Datos y contratos
- [x] 1.1 Agregar `startedAt`, `completedAt` y `recommendationId` a los planes, y guardar `startedAt` cuando pasa a `in_progress`
- [x] 1.2 Agregar a las facturas `currency` (sale del país) y si tienen foto
- [x] 1.3 Validar facturas: valores positivos, fin después del inicio, hasta 62 días, y 409 si se superponen
- [x] 1.4 Agregar `targetLoads` al catálogo para las 5 ecoinnovaciones de energía del caso
- [ ] 1.5 Completar `targetLoads` en las más de 40 ecoinnovaciones, con el equipo de contenido
- [x] 1.6 Perfil: `quarterBudget`, `hoursPerWeek` y `mainLoads`
- [x] 1.7 `GET /businesses/:id` y `PATCH /plans/:id/steps/:index` para la pantalla
- [ ] 1.8 Pantalla con las 3 preguntas al aceptar el primer paso
- [ ] 1.9 Completar datos viejos: `startedAt` desde el historial si existe, moneda desde el país, `completedAt` desde la última actualización de los planes terminados
- [x] 1.10 Índices en Mongo

## 2. Medición del ahorro
- [x] 2.1 Pasar facturas a kWh por día y explicar cuándo la resta simple engaña
- [x] 2.2 Separar línea base, después y meses mixtos
- [x] 2.3 `measureSavings`: ruido con piso del 2%, rango, los 5 estados, tarifa vigente, efecto de la tarifa y limitaciones
- [x] 2.4 Hash de entrada que no dependa del orden de las facturas
- [x] 2.5 Pruebas con los datos del anexo: febrero, tarifa, ruido, inconcluso, medido, subió, edición, borrado y orden
- [x] 2.6 `GET /plans/:id/savings` con foto del resultado cuando cambia el hash y aviso según lo último que vio la dueña
- [x] 2.7 Recalcular los planes terminados al crear, editar o borrar una factura
- [ ] 2.8 Corrección por temporada cuando haya un año de facturas
- [ ] 2.9 Ahorro total cuando hay dos ecoinnovaciones terminadas a la vez (D6)

## 3. Recomendación
- [x] 3.1 `recommendFirstStep`: filtros con motivo, puntaje de cuatro partes y desempate estable
- [x] 3.2 Ajuste para pocos casos en "cuántos la terminaron" y "cuánto ahorró"
- [x] 3.3 Detectar planes trabados (42 días o más) y proponer el siguiente paso
- [x] 3.4 Textos de la explicación, con el umbral de 5 negocios
- [x] 3.5 Endpoint con `surface`, guardado y reutilizado según el hash
- [x] 3.6 Devolver el plan en curso cuando ya aceptó un primer paso
- [ ] 3.7 Calcular `peerStats` todas las noches con datos reales (hoy está cargado a mano)
- [ ] 3.8 Pasar las cuatro pantallas de a una, con un flag: inicio, catálogo, diagnóstico y correo
- [ ] 3.9 Borrar las cuatro lógicas viejas cuando los números confirmen el cambio

## 4. Integraciones y fallas
- [x] 4.1 Cola de correos sin repetidos, con reintentos (1, 5, 30, 120 y 720 minutos), fallidos y rebotados
- [x] 4.2 Correo de ahorro medido, una vez por plan
- [x] 4.3 Subtareas con respaldo: si la IA no responde se puede reintentar; con 402 se avisa que no hay cupo
- [x] 4.4 Errores con mensaje, pista y campo, en lenguaje simple. Casos: fecha de término antes del inicio, en el futuro, plan ya terminado (con la misma fecha no es error) y facturas superpuestas
- [x] 4.5 En pantalla: calendarios con límites, avisos cuando un número parece mal, guía para encontrar los datos en la factura, aviso sin señal y guardado que no se queda colgado
- [x] 4.6 Estado de la foto, aviso para subir otra y "sin verificar" para los aliados
- [x] 4.7 Historial de cambios de facturas y aviso con fecha, factura, antes y después y la cifra anterior; `POST /savings/seen`
- [ ] 4.8 Tarea programada para la cola de correos (hoy es un intervalo dentro del servidor)
- [ ] 4.9 Recordatorio para subir la factura cuando se cumple el período
- [ ] 4.10 Lectura automática de la foto, que solo propone valores

## 5. Aliados y privacidad
- [x] 5.1 `GET /allies/report`: código anónimo, sin datos personales, medido y declarado por separado, evidencia y umbral de 5
- [x] 5.2 Vista para aliados: embudo contra la línea de base, meta de 90 días, kWh y CO₂, detalle anónimo
- [x] 5.3 `co2Equivalent` en cada factura y CO₂ evitado en el ahorro
- [ ] 5.4 Congelar el reporte al cierre de cada período
- [ ] 5.5 Proteger `/internal/*` y `/allies/*`

## 6. Front
- [x] 6.1 App para celular con React, Vite y shadcn/ui sobre la API: primer paso, plan, ahorro y facturas
- [x] 6.2 Recorridos que prueban los casos en la pantalla (se activan con `?recorridos`)
- [ ] 6.3 Integrar las pantallas en la app real de Kamai
- [ ] 6.4 Métricas: estados de medición por semana, planes con fecha de inicio, correos fallidos
- [ ] 6.5 Probar los textos de "todavía no podemos saberlo" con 3 a 5 dueñas
