# Resumen

El problema del caso: Kamai no sabe decirle a una dueña por dónde empezar, y el ahorro que muestra es una resta entre la última factura y la anterior. A Inés le dijo "ahorraste S/ 117" en febrero, cuando en realidad febrero tuvo tres días menos y por día consumió un 1,7% más.

## Lo que propongo

**Primer paso.** Un único motor de recomendación, así los cuatro lugares que hoy sugieren cosas distintas muestran lo mismo, y queda guardado por qué se recomendó. Primero filtra lo que no entra en el presupuesto o en el tiempo de la persona. Después ordena con cuatro criterios que se pueden explicar: si ataca el equipo que más consume, qué tan fácil es, cuántos la terminaron y cuánto ahorró a otros.

Para Inés el resultado es mantenimiento de burletes y descongelamiento. Dudé con hornear por tandas, que ataca el horno, pero tiene solo dos casos medidos y la mitad no la terminó. La dejé como segundo paso. El aislamiento que había elegido no entra en sus S/ 1.200, así que le sugiero pausarlo.

**IA.** Con entre 1 y 11 casos por ecoinnovación no hay con qué entrenar nada. Uso reglas y un suavizado para que "1 de 2" no pese igual que "7 de 9". El LLM lo dejo donde ya estaba, en las subtareas, con respaldo si falla.

**Ahorro.** Comparo contra el propio historial del negocio, en kWh por día, y paso a soles con la tarifa vigente, para que la suba de tarifa no le cuente en contra. Muestro un rango. Si el rango incluye cero, la respuesta es "todavía no podemos saberlo".

Con las facturas que inventé para julio a septiembre: agosto solo no alcanza para afirmar nada, y con septiembre ya da unos S/ 88 por mes. La resta en soles habría dicho S/ 7.

**Fallas.**
- Si la IA no responde, la persona ve los pasos de la guía.
- Los correos van a una cola con reintentos y no se repiten.
- Una foto ilegible no invalida la factura.
- Editar o borrar recalcula todo desde cero, y le aviso cuándo cambió, qué factura y qué cifra ya no vale.

**Privacidad.** Cifras de otros negocios solo con 5 o más detrás. Los aliados ven datos agregados y anónimos.

## Dónde está cada cosa

- Especificación (el entregable principal): `openspec/changes/add-primer-paso-ahorro-medido/`
- Backend con pruebas: `api/`
- App para celular y vista para aliados, como extra: `web/`
- Tabla de qué cubre cada punto del PDF: `evidence/cobertura-pdf.md`

## Supuestos que haría falta validar

Cuánta plata representa cada nivel de inversión (el catálogo no tiene montos), cuántas horas por semana pide cada nivel de complejidad, el factor de CO₂ por país y que en Arequipa no haya mucha diferencia de consumo entre estaciones.
