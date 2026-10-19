# Diseño

## Contexto

Lo que tenemos para trabajar es poco:
- Un catálogo sin montos ni ahorro esperado, solo niveles BAJA, MEDIA y ALTA.
- 23 panaderías, con entre 0 y 5 mediciones de antes y después por ecoinnovación.
- Facturas cargadas a mano, sin moneda y sin relación con ninguna ecoinnovación.
- Planes que solo guardan el estado y la fecha del último cambio.

Del otro lado, la persona usa el celular, a veces con pocos datos, y tiene que decidir con poca información. Por eso fui por poca IA, decisiones que se puedan explicar y una medición que no exagere.

Donde más profundicé fue en la medición del ahorro, porque ahí están las trampas del caso (febrero y la tarifa) y porque sin una medición confiable tampoco se puede saber si recomendar mejor sirve. La recomendación también está construida. Las integraciones y la privacidad las resolví en lo esencial. Temporada y lectura de fotos quedan diseñadas pero afuera.

## Objetivos

- Que la recomendación sea la misma en los cuatro lugares de Kamai y que quede guardado por qué.
- Que el primer paso entre en el presupuesto y el tiempo de la dueña y ataque lo que más consume.
- Que el ahorro no engañe: corregido por días y tarifa, con un rango, y con "todavía no podemos saberlo" cuando haga falta.
- Que editar o borrar una factura no genere doble conteo ni cifras que se contradigan.
- Un reporte para aliados agregado y anónimo, con lo medido separado de lo declarado.

No busco entrenar modelos, ni que un LLM decida o calcule, ni cubrir agua y el resto de las categorías en esta etapa.

---

## D1. Un solo motor de recomendación

`GET /businesses/:id/recommendations/first-step?surface=home|catalog|diagnosis|email` pasa a ser la única fuente. Cada cálculo se guarda con:
- la ecoinnovación elegida;
- las razones (como códigos);
- el puntaje y sus componentes;
- la versión de las reglas;
- un hash de los datos de entrada.

Si el hash no cambió, se reutiliza la recomendación guardada. El plan que se crea al aceptarla guarda el id de la recomendación.

Lo hice así porque hoy no hay forma de saber qué recomendación funcionó. Con el id en el plan, cada ahorro medido queda asociado a una versión de las reglas, y eso es lo que permite mejorarlas después con datos.

Descarté unificar el criterio en cada pantalla por separado (se vuelve a desincronizar en el primer cambio) y calcular en el front (duplica lógica y no deja registro).

## D2. Reglas y un puntaje que se pueda explicar

Primero filtro lo que no corresponde. Cada descarte queda guardado con su motivo:
- otro tema;
- no aplica al rubro;
- ya hecha;
- ya está en el plan;
- el piso de la banda de inversión supera el presupuesto;
- las horas que suele pedir superan las que tiene.

Con lo que queda armo un puntaje con cuatro partes:

| Parte | Peso | Cómo se calcula |
|---|---|---|
| Ataca un equipo que declaró como el que más consume | 0,30 | 1 si sí, 0,3 si no, 0,5 si no declaró nada |
| Facilidad | 0,25 | promedio de inversión y complejidad (BAJA 1, MEDIA 0,6, ALTA 0,2) |
| Cuántos la terminaron | 0,25 | `(terminaron + 0,3·4) / (eligieron + 4)` |
| Cuánto ahorró a otros | 0,20 | mediana de cambio por `n/(n+3)`, con tope de 20% |

Las dos últimas están ajustadas a propósito para los pocos casos. Sin el ajuste, "1 de 2" (50%) competiría parejo con "7 de 9" (78%), y el −18% de un único caso de aislamiento se llevaría todo. El 0,3 viene del dato del enunciado: hoy 3 de cada 10 completan.

Descarté:
- **Reglas sin datos de otros negocios:** tira la poca evidencia que hay.
- **Una regresión para estimar el efecto:** con 0 a 5 observaciones, los intervalos serían enormes.
- **Un modelo que ordena opciones:** necesita miles de casos con resultado.
- **Un LLM eligiendo:** no es determinista, no se puede auditar y podría inventar ahorros que el catálogo no tiene.

Cuando haya unas 30 ecoinnovaciones medidas por sector, la parte de efecto se puede reemplazar por un modelo jerárquico por sector y país sin cambiar el resto.

## D3. Pocos datos nuevos

- **Perfil:** tres preguntas al aceptar el primer paso: presupuesto del trimestre, horas por semana y qué equipos consumen más (opciones cerradas). Sin eso no hay forma de saber que en una panadería el horno es lo que más pesa.
- **Catálogo:** `targetLoads`, cargado por el equipo una vez por ecoinnovación.
- **Planes:** `startedAt`, `completedAt` y `recommendationId`.
- **Bandas de inversión (supuesto mío):** BAJA menos de S/ 300, MEDIA hasta S/ 1.500, ALTA más. Horas por semana: BAJA 1, MEDIA 3, ALTA 6. Están en configuración para cambiarlas cuando el catálogo tenga montos.

## D4. El primer paso de Inés

Con sus datos al 1 de julio:

| Ecoinnovación | Carga | Facilidad | Terminaron | Efecto | Total |
|---|---|---|---|---|---|
| Burletes y descongelamiento | 1 | 1,0 | 0,63 | 0,17 | 0,742 |
| Hornear por tandas | 1 | 0,8 | 0,42 | 0,22 | 0,649 |
| Iluminación LED | 0,3 | 0,8 | 0,68 | 0,13 | 0,485 |

Aislamiento queda afuera: ya está en su plan, está trabado y no entra en el presupuesto. El calentador solar tampoco entra.

Elegí burletes y no tandas, aunque tandas ataca el horno, por tres razones:
- **La mayoría la termina** (7 de 9, contra 3 de 6), y la meta de los 90 días depende de que la termine.
- **Casi no cuesta nada y se hace en una o dos semanas.** Después de siete semanas trabada, un logro rápido importa.
- **El −6% esperado se puede medir:** supera su variación normal (2,6%) con dos facturas.

Tandas queda como siguiente paso y se mide aparte. También me pareció razonable empezar por tandas, pero tiene solo dos casos medidos y pide cambiar la rutina de seis personas con cuatro horas por semana.

El aislamiento no lo borro: le sugiero pausarlo con un mensaje que no la haga sentir mal.

Si el negocio todavía no tiene facturas, la recomendación sale igual (no depende de ellas), pero le pido 3 facturas antes de empezar. Si no, el ahorro nunca va a poder medirse.

## D5. Cómo mido el ahorro

**Contra qué:** contra el propio historial.
- Las facturas que terminan antes de `startedAt` son la línea base. Pido mínimo 3 y 80 días.
- Las que empiezan desde `completedAt` en adelante son el "después".
- Las que cruzan la implementación quedan afuera, y lo digo.

**Días:** todo en kWh por día, ponderado por la cantidad de días. Así se arregla lo de febrero.

**Tarifa:** el ahorro se mide en kWh y se pasa a soles con la tarifa de la última factura. La suba de tarifa se muestra aparte, porque no es mérito ni culpa de ella.

**Temporada:** con menos de 12 meses no la corrijo y lo aclaro. Con un año de datos usaría el mismo mes del año anterior, o factores de otros negocios del país cuando haya 5 o más.

**Cuándo digo que no se sabe:**
- Tomo como ruido el desvío estándar de los kWh por día de la línea base, con un piso del 2%. Para Inés da 1,53 kWh por día, un 2,6%.
- El margen es `2 × ruido × √(1/n_antes + 1/n_después)`. Solo afirmo que hubo ahorro si todo el rango queda por encima de cero.

| Estado | Cuándo | Qué ve |
|---|---|---|
| `INSUFFICIENT_BASELINE` | menos de 3 facturas de antes | que suba las que faltan |
| `WAITING_POST_DATA` | todavía no hay una factura completa después | "todavía no podemos saberlo" y su consumo normal |
| `INCONCLUSIVE` | el rango cruza el cero | "todavía no podemos saberlo", con cuánto bajó y cuánto varía normalmente |
| `MEASURED` | todo el rango arriba de cero | "ahorrás cerca de S/ X por mes", con el rango |
| `INCREASED` | todo el rango abajo de cero | que su consumo subió |

Con las facturas de julio a septiembre que armé:
- **Agosto (57,0 kWh/día):** baja 4,5%, pero el rango va de −1,1% a 10%, así que `INCONCLUSIVE`.
- **Agosto y septiembre (56,3):** baja 5,7%, rango de 1,5% a 9,9%. Da unos S/ 88 por mes (entre 23 y 153).
- **La resta en soles habría mostrado S/ 7,** por la suba de tarifa.

Descarté:
- **Seguir con la resta simple:** mezcla días, tarifa y temporada.
- **Comparar en soles:** le carga a ella la suba de la tarifa.
- **Usar a otras panaderías como grupo de control:** con tan pocos casos, el control tendría más ruido que lo que se quiere medir.
- **Corregir por clima:** no tengo esa fuente, y en Arequipa la temperatura no cambia tanto (supuesto).
- **Mostrar solo un número:** promete más de lo que se sabe.

## D6. Una ecoinnovación por vez

Sugiero la siguiente cuando la anterior ya tiene medición o pasaron 60 días. Si igual hay dos terminadas al mismo tiempo, muestro el ahorro total y aclaro que no se puede repartir: con facturas mensuales no hay forma honesta de separarlo. Esto está especificado pero no construido.

## D7. Recalcular sin doble conteo

El ahorro es una función pura de las facturas y las fechas del plan. Nunca guardo incrementos: siempre recalculo desde las facturas que hay.

Cuando una factura se crea, se edita o se borra, recalculo los planes terminados del negocio. Guardo una foto del resultado solo si cambió el hash de los datos de entrada.

El plan recuerda lo último que vio la dueña. Al volver:
- si solo se sumaron facturas nuevas, es un avance y no hay aviso de corrección;
- si cambió o desapareció una factura que ya había visto, se le avisa.

El reporte para aliados se congela al cierre de cada período: las ediciones posteriores van al período siguiente como ajuste (segunda etapa).

## D8. Integraciones y qué pasa cuando fallan

| Integración | Falla | Qué ve Inés | Qué hace el sistema |
|---|---|---|---|
| IA (subtareas) | no responde o error 5xx | los pasos de la guía y la opción de reintentar | responde 200 con `source: "static"`. La recomendación y la medición no dependen de la IA |
| IA | 402, sin cupo | que ya usó las sugerencias del mes; sigue con los pasos | no le ofrezco comprar créditos en ese momento |
| Correo | no responde 200 | nada; el resultado ya está en la app | cola con clave por persona, plantilla y plan; reintentos a 1, 5, 30, 120 y 720 minutos; después queda como fallido. A las direcciones que rebotaron no se les escribe |
| Foto de la factura | no se puede leer | la factura queda guardada con sus números; en Facturas ve "La foto no se lee: toca para subir otra" | se marca como no legible. Para ella cuenta igual; para los aliados queda sin verificar |
| Conversión de moneda | (no aplica) | | no la uso: mido en kWh y la moneda sale del país |
| Encuestas | no hay diagnóstico | la recomendación igual | asumo energía para este flujo |
| MongoDB | caída | un error genérico y la opción de reintentar | los cálculos se pueden repetir sin efectos |

## D9. Datos de otros negocios

- **Umbral:** solo muestro una cifra de otros negocios si hay 5 o más detrás. En burletes la eligieron 9, así que puedo decir "8 de cada 10 la terminaron". Pero solo 4 midieron, así que el −6% no lo muestro. Aislamiento (1 caso) y tandas (2) nunca muestran cifras.
- **Redondeo** ("x de cada 10", porcentajes enteros) para que no se puedan reconstruir conteos chicos.
- **Aliados:** cada negocio aparece con un código anónimo, sin nombre, mail ni montos en soles. Los promedios se publican solo con 5 o más negocios medidos.

## D10. Dónde uso IA y dónde no

| Parte | Cómo |
|---|---|
| Elegir la ecoinnovación | reglas y el ajuste de D2, sin LLM |
| Explicar por qué | plantillas. Es más barato, no gasta cupo y sale igual en todos lados. Más adelante un LLM podría ajustar el tono sobre los mismos datos |
| Medir el ahorro | aritmética, nunca un LLM |
| Subtareas | el LLM que ya existe, con respaldo |
| Leer la foto | un modelo de visión en una segunda etapa, que solo propone y la persona confirma |
| Asistente de consultas | el LLM que ya existe, citando el resultado de la medición, sin inventar cifras |

## D11. Celular con pocos datos

Las respuestas para la dueña traen los textos ya armados y son chicas (la recomendación con su explicación pesa menos de 3 KB). El rango se muestra con una barra simple, no con un gráfico pesado.

## D12. Una vista para los aliados

Uso el mismo dato contado dos veces:
- **A Inés** le hablo de su negocio: soles por mes, el rango y la nota de la tarifa.
- **A los aliados** les hablo del programa: mediana de ahorro medido, kWh y CO₂ evitados, el embudo contra la línea de base del enunciado, la meta de 90 días, lo declarado al lado (sin sumarlo) y un detalle anónimo con la evidencia de cada negocio.

La meta del enunciado tiene esas dos partes, y si el reporte quedaba solo como endpoint, la segunda quedaba sin responder.

Los números de esa vista salen de datos inventados, así que la pantalla lo dice arriba. Con una muestra tan chica también aclaro que importa la tendencia y no el decimal. Mostrarles a los aliados el declarado como si fuera ahorro es justo lo que la meta pide dejar de hacer, así que lo descarté.

## D13. Avisar qué cambió y cuándo

Guardo un registro de cambios de facturas (creada, editada o borrada, con antes, después y fecha). Cuando Inés vuelve a "Mi ahorro" después de corregir algo, le digo cuándo pasó, qué factura fue, de cuánto a cuánto cambió y qué pasa con la cifra que había visto. Por ejemplo: "antes te mostrábamos S/ 88 por mes y esa cifra ya no vale". Después de esa primera vez queda una línea con el último cambio, y en Facturas el historial.

Consultar el ahorro no cambia nada. Solo la pantalla de ahorro, al mostrarlo, avisa que lo vio (`POST /savings/seen` con el hash). Al principio la consulta misma lo marcaba como visto, y eso hacía que si corregía una factura desde la pantalla de Facturas (que también consulta el ahorro para el gráfico), el aviso se perdiera antes de que lo leyera.

---

## Tecnologías

- **Backend:** un módulo dentro de la API de Node que ya existe, sin un servicio nuevo. Es chico y usa los mismos datos.
- **Librerías:** Express (o el router que ya tengan), zod para validar y el driver de MongoDB (o Mongoose, si es lo que usan). No hace falta ninguna librería de estadística: son unas 20 líneas.
- **Pruebas:** Vitest para la lógica, con los datos del anexo; supertest y mongodb-memory-server para probar la API contra Mongo real. Las mismas pruebas corren contra el repositorio en memoria y contra Mongo.
- **Front:** React, Vite, Tailwind y shadcn/ui, con unos recorridos que prueban los casos en la pantalla.
- **Despliegue:** donde ya corre la API. El envío de correos va como tarea programada cada minuto, no dentro del request. Activaría la recomendación de a una pantalla con un flag.
- **Métricas a mirar:** estados de medición por semana, porcentaje de planes con fecha de inicio, correos fallidos y tiempo de respuesta.

## Riesgos

- **Las bandas de inversión son un supuesto.** Si cambian, cambia qué queda afuera por presupuesto. Están en configuración y versionadas.
- **Ser honesto implica mostrar más seguido "todavía no podemos saberlo".** Para que no frustre, siempre digo qué falta y aviso cuando llega.
- **Depende de que suba facturas.** Por eso las pido antes de empezar, que es cuando más motivada está, y mando recordatorios.
- **Sin temporada, un mes raro puede dar un falso "medido".** El piso de ruido y el rango ayudan, y la limitación queda escrita.

## Supuestos

1. Las bandas de inversión y las horas por complejidad.
2. Que el horno y las refrigeradoras son lo que más consume en una panadería. Para Inés lo dice el caso; para el resto lo pregunto.
3. Que en Arequipa una panadería no cambia mucho su consumo según la estación.
4. Que las facturas son mensuales y no se superponen (lo dice el anexo).

## Migración

1. Subir el endpoint con un flag apagado.
2. Completar `startedAt`, `completedAt` y la moneda en los datos que ya existen.
3. Prender el inicio y comparar con lo que se mostraba antes.
4. Pasar catálogo, diagnóstico y correo.
5. Reemplazar el "ahorraste S/ X" actual.
6. Mandar el primer reporte a aliados con el método versionado.

## Preguntas abiertas

- ¿Qué cuenta como "completada" para el reporte: el formulario de impacto o el estado del plan?
- ¿Se puede pedir el número de suministro para validar facturas más adelante?
- ¿Los aliados aceptan un rango o necesitan una sola cifra? Mi propuesta es la mediana con su rango.
