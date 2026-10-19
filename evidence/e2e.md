# El caso de Inés, paso a paso por HTTP

Generado el 2026-10-19 contra un servidor real (repo: mongo).

Las facturas de enero a junio son las del caso. Las de julio a septiembre las inventé para poder mostrar la medición.

## Qué se verificó

- [ok] Los 4 lugares recomiendan lo mismo (eco_118)
- [ok] Una sola recomendación guardada con su porqué
- [ok] Detecta aislamiento trabado 7 semanas
- [ok] Febrero: "ahorraste S/ 117" marcado como engañoso
- [ok] IA caída → pasos estáticos, 200
- [ok] Recién completada → WAITING_POST_DATA
- [ok] Superposición → 409
- [ok] Agosto solo → INCONCLUSIVE ("todavía no podemos saberlo")
- [ok] Con septiembre → MEASURED, S/ 88/mes
- [ok] La resta simple en soles habría mostrado mucho menos ahorro
- [ok] Correo "ahorro medido" enviado una sola vez tras reintento
- [ok] Edición → recalcula desde cero y avisa que la cifra anterior ya no vale
- [ok] Aliados: sin nombres ni emails, publica mediana con ≥5 medidos

## Pedidos y respuestas

### 1. Recomendación desde "home"
```http
GET /businesses/biz_ines/recommendations/first-step?surface=home&asOf=2026-07-01
```
**→ 200**
```json
{
  "recommendationId": "rec_8f8c196c009cd410_2026-07-01",
  "recommended": {
    "ecoId": "eco_118",
    "title": "Mantenimiento de burletes y descongelamiento de refrigeradoras",
    "investment": "BAJA",
    "complexity": "BAJA",
    "score": {
      "total": 0.742,
      "components": {
        "loadMatch": 1,
        "feasibility": 1,
        "completion": 0.631,
        "effect": 0.171
      },
      "expectedEffectPct": 3.4
    }
  },
  "reasons": [
    "TARGETS_MAIN_LOAD",
    "LOW_INVESTMENT",
    "LOW_COMPLEXITY",
    "FITS_BUDGET_AND_TIME",
    "PEERS_USUALLY_COMPLETE"
  ],
  "alternatives": [
    "eco_204",
    "eco_090"
  ],
  "excluded": [
    {
      "ecoId": "eco_071",
      "title": "Aislamiento térmico del horno",
      "reason": "ALREADY_IN_PLAN"
    },
    {
      "ecoId": "eco_150",
      "title": "Calentador solar de agua",
      "reason": "OVER_BUDGET"
    }
  ],
  "stalledPlans": [
    {
      "planId": "plan_552",
      "ecoId": "eco_071",
      "title": "Aislamiento térmico del horno",
      "weeksWithoutProgress": 7,
      "suggestion": "PAUSE_AND_START_SMALLER",
      "complexity": "ALTA",
      "investment": "ALTA"
    }
  ],
  "explanation": {
    "headline": "Tu primer paso: Mantenimiento de burletes y descongelamiento de refrigeradoras",
    "bullets": [
      "Ataca tus refrigeradoras, uno de los equipos que más consume en tu negocio.",
      "Casi no requiere inversión.",
      "Se hace en pocas horas, sin conocimiento técnico.",
      "Entra en tu presupuesto de S/ 1.200 y tus 4 horas por semana.",
      "8 de cada 10 panaderías que la eligieron la terminaron.",
      "Todavía hay pocas mediciones en negocios parecidos para darte una cifra de ahorro: lo vamos a medir con tus facturas."
    ],
    "stalledNote": "\"Aislamiento térmico del horno\" lleva 7 semanas sin avanzar. Te sugerimos pausarla y retomarla cuando tengas tu primer ahorro.",
    "next": "Cuando la termines y midamos el ahorro, seguimos con: Hornear por tandas y apagar el horno entre ellas."
  }
}
```

### 2. Recomendación desde "catalog"
```http
GET /businesses/biz_ines/recommendations/first-step?surface=catalog&asOf=2026-07-01
```
**→ 200**
```json
{
  "recommendationId": "rec_8f8c196c009cd410_2026-07-01",
  "recommended": "eco_118"
}
```

### 3. Recomendación desde "diagnosis"
```http
GET /businesses/biz_ines/recommendations/first-step?surface=diagnosis&asOf=2026-07-01
```
**→ 200**
```json
{
  "recommendationId": "rec_8f8c196c009cd410_2026-07-01",
  "recommended": "eco_118"
}
```

### 4. Recomendación desde "email"
```http
GET /businesses/biz_ines/recommendations/first-step?surface=email&asOf=2026-07-01
```
**→ 200**
```json
{
  "recommendationId": "rec_8f8c196c009cd410_2026-07-01",
  "recommended": "eco_118"
}
```

### 5. Facturas normalizadas: la trampa de febrero
```http
GET /businesses/biz_ines/bills
```
**→ 200**
```json
{
  "comparisons": [
    {
      "from": "bill_2026_01",
      "to": "bill_2026_02",
      "naiveSaving": 117,
      "daysDifference": -3,
      "kwhPerDayChangePct": 1.7,
      "costPerDayChangePct": 1.7,
      "tariffChangePct": 0,
      "verdict": "NAIVE_SAVING_IS_MISLEADING"
    },
    {
      "from": "bill_2026_02",
      "to": "bill_2026_03",
      "naiveSaving": -228.9,
      "daysDifference": 3,
      "kwhPerDayChangePct": 2.1,
      "costPerDayChangePct": 6,
      "tariffChangePct": 3.8,
      "verdict": "CONSISTENT"
    }
  ],
  "last": {
    "from": "bill_2026_05",
    "to": "bill_2026_06",
    "naiveSaving": 78,
    "daysDifference": -1,
    "kwhPerDayChangePct": -5.5,
    "costPerDayChangePct": -2,
    "tariffChangePct": 3.7,
    "verdict": "CONSISTENT"
  }
}
```

### 6. Inés acepta el primer paso
```http
POST /businesses/biz_ines/plans

{"ecoId":"eco_118","startedAt":"2026-07-01","recommendationId":"rec_8f8c196c009cd410_2026-07-01"}
```
**→ 201**
```json
{
  "id": "plan_a8ad34a5",
  "status": "in_progress",
  "startedAt": "2026-07-01",
  "recommendationId": "rec_8f8c196c009cd410_2026-07-01"
}
```

### 7. Subtareas con el proveedor de IA caído
```http
POST /plans/plan_a8ad34a5/sub-tasks

{"stepsId":["step_1","step_2","step_3"]}
```
**→ 200**
```json
{
  "source": "static",
  "reason": "AI_UNAVAILABLE",
  "retryable": true,
  "message": "Las sugerencias automáticas no están disponibles ahora. Aquí tienes los pasos de la guía; puedes reintentar más tarde.",
  "steps": [
    {
      "_id": "step_1",
      "title": "Revisar burletes",
      "subSteps": []
    },
    {
      "_id": "step_2",
      "title": "Programar descongelamiento",
      "subSteps": []
    },
    {
      "_id": "step_3",
      "title": "Registrar consumo",
      "subSteps": []
    }
  ]
}
```

### 8. Completa la ecoinnovación el 10/7
```http
POST /plans/plan_a8ad34a5/complete

{"completedAt":"2026-07-10","perceivedImpact":{"scale":4,"text":"Las refris ya no hacen tanto hielo"}}
```
**→ 200**
```json
{
  "status": "WAITING_POST_DATA",
  "explanation": {
    "headline": "Todavía no podemos saberlo",
    "detail": "Cuando subas tu primera factura completa después de terminar, te mostramos el resultado.",
    "baseline": "Tu consumo normal: 59,7 kWh por día."
  }
}
```

### 9. Sube julio (periodo mixto)
```http
POST /businesses/biz_ines/bills

{"kwhConsumed":1800,"costPerKwh":0.84,"billingStartDate":"2026-07-01","billingEndDate":"2026-07-31","uploadedFiles":["jul.jpg"]}
```
**→ 201**
```json
{
  "id": "bill_f48cd0a0",
  "kwhPerDay": 58.064516129032256,
  "currency": "S/"
}
```

### 10. Intenta subir un periodo superpuesto
```http
POST /businesses/biz_ines/bills

{"kwhConsumed":900,"costPerKwh":0.84,"billingStartDate":"2026-07-15","billingEndDate":"2026-08-10"}
```
**→ 409**
```json
{
  "error": "OVERLAPPING_PERIOD",
  "message": "Estas fechas se cruzan con tu factura de julio (del 1 de julio al 31 de julio).",
  "hint": "Cada día va en una sola factura. Revisa las fechas de esta, o corrige la otra si es la que está mal.",
  "field": "billingStartDate",
  "conflictsWith": "bill_f48cd0a0",
  "conflictStart": "2026-07-01",
  "conflictEnd": "2026-07-31"
}
```

### 11. Sube agosto
```http
POST /businesses/biz_ines/bills

{"kwhConsumed":1767,"costPerKwh":0.84,"billingStartDate":"2026-08-01","billingEndDate":"2026-08-31","uploadedFiles":["ago.jpg"]}
```
**→ 201**
```json
{
  "id": "bill_bd5893ad",
  "kwhPerDay": 57
}
```

### 12. Ahorro con una factura posterior
```http
GET /plans/plan_a8ad34a5/savings
```
**→ 200**
```json
{
  "status": "INCONCLUSIVE",
  "periods": {
    "baseline": [
      "bill_2026_01",
      "bill_2026_02",
      "bill_2026_03",
      "bill_2026_04",
      "bill_2026_05",
      "bill_2026_06"
    ],
    "post": [
      "bill_bd5893ad"
    ],
    "excludedTransition": [
      "bill_f48cd0a0"
    ]
  },
  "baseline": {
    "bills": 6,
    "days": 181,
    "kwhPerDay": 59.67,
    "naturalVariationKwhPerDay": 1.53,
    "naturalVariationPct": 2.6
  },
  "savings": {
    "kwhPerDay": 2.67,
    "kwhPerDayRange": [
      -0.65,
      5.98
    ],
    "pct": 4.5,
    "pctRange": [
      -1.1,
      10
    ],
    "kwhPerMonth": 80,
    "currentTariff": 0.84,
    "moneyPerMonthAtCurrentTariff": 67,
    "moneyPerMonthRange": [
      -16,
      151
    ],
    "moneyAccumulatedSinceCompletion": 69
  },
  "explanation": {
    "headline": "Todavía no podemos saberlo",
    "detail": "Tu consumo bajó 4,5%, pero tu consumo normal varía cerca de 2,6% de un mes a otro. Con una factura más lo sabremos con más seguridad."
  }
}
```

### 13. Sube septiembre (la tarifa vuelve a subir: 0,86)
```http
POST /businesses/biz_ines/bills

{"kwhConsumed":1665,"costPerKwh":0.86,"billingStartDate":"2026-09-01","billingEndDate":"2026-09-30","uploadedFiles":["sep.jpg"]}
```
**→ 201**
```json
{
  "id": "bill_dbb71af1",
  "totalCost": 1431.9
}
```

### 14. Ahorro con dos facturas posteriores
```http
GET /plans/plan_a8ad34a5/savings
```
**→ 200**
```json
{
  "status": "MEASURED",
  "savings": {
    "kwhPerDay": 3.41,
    "kwhPerDayRange": [
      0.9,
      5.91
    ],
    "pct": 5.7,
    "pctRange": [
      1.5,
      9.9
    ],
    "kwhPerMonth": 102,
    "currentTariff": 0.86,
    "moneyPerMonthAtCurrentTariff": 88,
    "moneyPerMonthRange": [
      23,
      153
    ],
    "moneyAccumulatedSinceCompletion": 177
  },
  "tariffEffect": {
    "baselineAvgTariff": 0.805,
    "currentTariff": 0.86,
    "changePct": 6.8,
    "naiveMoneyPerMonth": 7
  },
  "limitations": [
    {
      "code": "NO_SEASONAL_ADJUSTMENT",
      "detail": "Hay 8.9 meses de historia; con menos de 12 no se puede corregir por temporada."
    },
    {
      "code": "TRANSITION_PERIODS_EXCLUDED",
      "detail": "1 periodo(s) mezclan antes y después de la implementación y no se usan."
    }
  ],
  "explanation": {
    "headline": "Ahorras cerca de S/ 88 al mes",
    "detail": "Tu consumo bajó 5,7% (3,4 kWh por día menos que antes). Con lo que sabemos, el ahorro real está entre S/ 23 y S/ 153 al mes.",
    "howWeMeasured": "Comparamos tu consumo por día antes y después, así no importa si el mes tuvo más o menos días.",
    "tariffNote": "La tarifa subió 6,8%: por eso tu factura no baja tanto como tu consumo. Esa subida no es culpa tuya."
  },
  "previous": {
    "status": "INCONCLUSIVE",
    "inputsHash": "48cff36253b0942c",
    "changeKind": "NEW_BILLS"
  }
}
```

### 15. Worker de correos (1er intento: el servicio de mensajería falla)
```http
POST /internal/outbox/deliver
```
**→ 200**
```json
{
  "results": [
    {
      "key": "biz_ines:savings-measured:plan_a8ad34a5",
      "status": "retry",
      "error": "messaging 503"
    }
  ]
}
```

### 16. Worker de correos (2 min después: reintento)
```http
POST /internal/outbox/deliver
```
**→ 200**
```json
{
  "results": [
    {
      "key": "biz_ines:savings-measured:plan_a8ad34a5",
      "status": "sent"
    }
  ]
}
```

### 17. Edita septiembre (se equivocó: eran 1.750 kWh)
```http
PUT /bills/bill_dbb71af1

{"kwhConsumed":1750}
```
**→ 200**
```json
{
  "id": "bill_dbb71af1",
  "kwhConsumed": 1750,
  "kwhPerDay": 58.333333333333336
}
```

### 18. Ahorro tras la edición
```http
GET /plans/plan_a8ad34a5/savings
```
**→ 200**
```json
{
  "status": "INCONCLUSIVE",
  "savingsPct": 3.4,
  "explanation": {
    "headline": "Todavía no podemos saberlo",
    "detail": "Tu consumo bajó 3,4%, pero tu consumo normal varía cerca de 2,6% de un mes a otro. Con una factura más lo sabremos con más seguridad.",
    "updateNote": "El 10 de julio corregiste tu factura de septiembre: de 1.665 a 1.750 kWh. Por eso recalculamos tu resultado: antes te mostrábamos S/ 88 al mes y esa cifra ya no vale."
  },
  "previous": {
    "status": "MEASURED",
    "inputsHash": "2732885a28841cb3",
    "changeKind": "EDITED_OR_DELETED"
  }
}
```

### 19. Reporte para aliados (agregado, k ≥ 5)
```http
GET /allies/report
```
**→ 200**
```json
{
  "summary": {
    "businessesTracked": 7,
    "byStatus": {
      "MEASURED": 5,
      "INCONCLUSIVE": 2
    },
    "measuredBusinesses": 5,
    "minBusinessesToPublish": 5,
    "published": true,
    "medianSavingsPct": 7.4,
    "totalKwhSavedPerMonth": 563,
    "method": "Línea base propia en kWh/día, sin tarifa; solo cuenta ahorro con rango ~95% sobre cero."
  },
  "sampleRows": [
    {
      "businessRef": "1c81b819d1",
      "ecoId": "eco_118",
      "status": "MEASURED",
      "measured": true,
      "declaredImpact": 5,
      "savingsPct": 7.4,
      "savingsPctRange": [
        3.9,
        10.9
      ],
      "kwhPerMonth": 89,
      "methodVersion": "savings-v1",
      "limitations": [
        "NO_SEASONAL_ADJUSTMENT"
      ],
      "evidence": "none",
      "country": "PE"
    },
    {
      "businessRef": "0d2d8ca880",
      "ecoId": "eco_204",
      "status": "MEASURED",
      "measured": true,
      "declaredImpact": 4,
      "savingsPct": 5.4,
      "savingsPctRange": [
        1.9,
        8.8
      ],
      "kwhPerMonth": 74,
      "methodVersion": "savings-v1",
      "limitations": [
        "NO_SEASONAL_ADJUSTMENT"
      ],
      "evidence": "none",
      "country": "BO"
    }
  ]
}
```
