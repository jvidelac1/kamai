# Evidencia

- `cobertura-pdf.md`: cada punto del enunciado con la decisión, el código, la prueba y el recorrido que lo muestra.
- `test-report.txt`: la salida completa de las pruebas del backend.
- `e2e.md`: el caso de Inés recorrido por HTTP contra MongoDB, con cada pedido y respuesta (se genera con `npm run e2e`).
- `openspec-validate.txt`: la validación de la especificación.

## Capturas (celular, 375 px)

| | |
|---|---|
| `capturas/01-primer-paso.jpg` | la recomendación y por qué |
| `capturas/02-plan-en-marcha.jpg` | el plan con los pasos para ir marcando |
| `capturas/03-ahorro-medido.jpg` | ahorro medido con su rango |
| `capturas/04-aviso-cambio-con-fecha.jpg` | qué ve después de corregir una factura |
| `capturas/05-error-fecha.jpg` | un error que explica qué pasó y qué elegir |
| `capturas/06-sin-senal.jpg` | sin conexión no se pierde lo escrito |
| `capturas/07-vista-aliados.jpg` | el reporte para aliados |

## Recorridos

Con el servidor en modo recorridos (`npm run start:recorridos`) y la URL `/?recorridos`, hay cuatro recorridos que usan la app como lo haría Inés y verifican cada paso en la pantalla. Los corrí en el navegador y pasaron todos: camino feliz 16 de 16, honestidad 10 de 10, fallas 13 de 13 y aliados 9 de 9.
