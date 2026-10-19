# Propuesta: primer paso con ahorro medido

## Why

Kamai tiene más de 40 ecoinnovaciones y guarda las facturas de cada negocio, pero no le sabe decir a una dueña por cuál empezar ni cuánto le ahorró la que ya hizo.

El caso de Inés lo muestra bien:

- Eligió la primera recomendación que vio, aislamiento térmico del horno. Es de inversión y complejidad alta, no entra en los S/ 1.200 que puede poner este trimestre, y lleva siete semanas sin avanzar. Hoy hay cuatro lugares que recomiendan con criterios distintos y no queda registrado por qué se recomendó algo.
- En febrero Kamai le mostró "ahorraste S/ 117". Pero febrero tuvo tres días menos y, por día, consumió un 1,7% más. Además la tarifa subió un 8% entre enero y junio, así que cualquier ahorro real queda tapado si se compara en soles.
- Para los aliados que financian el programa no hay ahorro medido. De cada 10 negocios que eligen una ecoinnovación, 3 la completan y 1 deja facturas de antes y después.

La meta es que cada negocio vea un ahorro real en sus primeros 90 días, y que Kamai pueda mostrarles a los aliados ahorro medido, no declarado.

## What Changes

- Un motor de recomendación único (`GET /businesses/:id/recommendations/first-step`) que consumen el inicio, el catálogo, el diagnóstico y el correo de bienvenida. Cada recomendación se guarda con sus razones y la versión de las reglas.
- Una explicación en lenguaje simple, armada con plantillas. Solo cita datos de otros negocios si hay 5 o más detrás.
- Una medición de ahorro nueva (`GET /plans/:id/savings`): compara contra el historial propio en kWh por día, deja afuera los meses que mezclan antes y después, valoriza a la tarifa actual, da un rango y dice "todavía no podemos saberlo" cuando no alcanza.
- Un reporte para aliados (`GET /allies/report`) con lo medido separado de lo declarado, el embudo contra la línea de base del enunciado, la meta de 90 días y kWh y CO₂ evitados. Sin datos personales.
- Facturas: se valida que no se superpongan; se guarda la moneda según el país; se agrega `co2Equivalent` (está en el contrato del anexo); se registra si la foto se pudo leer; y queda un historial de cambios para avisar qué cambió y cuándo.
- Planes: se agregan `startedAt`, `completedAt` y `recommendationId`. Sin la fecha de inicio no hay forma de separar el antes del después.
- Perfil: tres preguntas al aceptar el primer paso (presupuesto del trimestre, horas por semana, equipos que más consumen).
- Catálogo: un campo `targetLoads` con el equipo que ataca cada ecoinnovación.
- Correos por una cola con reintentos y sin repetir envíos. Las subtareas de IA tienen respaldo con los pasos del catálogo.

## Alcance

Entra la primera ecoinnovación de energía, que es donde hay facturas con kWh: la recomendación para negocios con y sin facturas, la medición de una ecoinnovación por vez, la vista de la dueña y la de los aliados, y las fallas de IA, correo, foto ilegible y edición o borrado de facturas.

Queda afuera:
- Agua: mismo método, otra unidad. Lo sumaría cuando el de luz esté validado.
- Montos en el catálogo: lo resuelvo con bandas por nivel, que son un supuesto.
- Corrección por temporada: no se puede con menos de un año de facturas, así que lo aclaro en cada medición.
- Lectura automática de la foto: para una segunda etapa.
- Modelos entrenados: no hay datos suficientes.
- Separar el ahorro de dos ecoinnovaciones hechas a la vez: muestro el total y lo aclaro.

## Impact

- Specs nuevas: `first-step-recommendation`, `measured-savings` y `resilient-integrations`.
- Código: un módulo nuevo dentro de la API actual, y las cuatro pantallas que recomiendan pasan a usar el endpoint.
- Datos: colecciones nuevas `recommendations`, `savingsSnapshots`, `emailOutbox`, `billChanges` y `peerStats`, y campos nuevos en planes, facturas, perfil y catálogo.
- Migración: para los planes que ya existen, `startedAt` sale del historial de estados si está; si no, se usa la fecha de término y se marca como aproximada.
