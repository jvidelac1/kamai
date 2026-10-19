// Datos del anexo de la prueba (ficticios) + campos nuevos que propone el diseño (marcados NUEVO).

export const INES = {
  id: 'biz_ines',
  name: 'Panadería Santa Inés',
  ownerName: 'Inés Huamán',
  email: 'ines@ejemplo.test',
  country: 'PE',
  city: 'Arequipa',
  ciiu: '1071', // elaboración de productos de panadería
  sector: 'bakery',
  employees: '6',
  description: 'Panadería de barrio con horno eléctrico y dos refrigeradoras.',
  diagnosis: { topic: 'ENERGY', level: 'Crecimiento', sections: { fuentes: 55, consumo: 42 } },
  joinedAt: '2026-02-10', // lleva ~5 meses en Kamai al 1/7 (subió sus facturas desde enero)
  // NUEVO: 3 preguntas cortas al aceptar el "primer paso"
  quarterBudget: 1200,
  hoursPerWeek: 4,
  mainLoads: ['horno', 'refrigeracion'],
};

export const CATALOG = [
  {
    id: 'eco_118',
    title: 'Mantenimiento de burletes y descongelamiento de refrigeradoras',
    category: 'ENERGY',
    complexity: 'BAJA',
    investment: 'BAJA',
    time: 'BAJA',
    collaborators: 'BAJA',
    impact: 'Reduce el consumo de refrigeración',
    returnInvestment: 'Inmediato',
    steps: ['Revisar burletes', 'Programar descongelamiento', 'Registrar consumo'],
    ciiuCodes: [],
    targetLoads: ['refrigeracion'], // NUEVO (curado por el equipo)
  },
  {
    id: 'eco_204',
    title: 'Hornear por tandas y apagar el horno entre ellas',
    category: 'ENERGY',
    complexity: 'MEDIA',
    investment: 'BAJA',
    time: 'MEDIA',
    collaborators: 'MEDIA',
    impact: 'Reduce horas de horno encendido en vacío',
    returnInvestment: 'Inmediato',
    steps: ['Medir horas de horno', 'Armar calendario de tandas', 'Capacitar al equipo'],
    ciiuCodes: ['1071'],
    targetLoads: ['horno'],
  },
  {
    id: 'eco_090',
    title: 'Iluminación LED',
    category: 'ENERGY',
    complexity: 'BAJA',
    investment: 'MEDIA',
    time: 'BAJA',
    collaborators: 'BAJA',
    impact: 'Menor consumo en iluminación',
    returnInvestment: 'Entre 6 y 12 meses',
    steps: ['Contar luminarias', 'Cotizar LED', 'Reemplazar'],
    ciiuCodes: [],
    targetLoads: ['iluminacion'],
  },
  {
    id: 'eco_071',
    title: 'Aislamiento térmico del horno',
    category: 'ENERGY',
    complexity: 'ALTA',
    investment: 'ALTA',
    time: 'ALTA',
    collaborators: 'MEDIA',
    impact: 'Reduce pérdidas de calor del horno',
    returnInvestment: 'Más de 12 meses',
    steps: ['Cotizar aislamiento', 'Contratar técnico', 'Instalar', 'Registrar consumo'],
    ciiuCodes: ['1071'],
    targetLoads: ['horno'],
  },
  {
    id: 'eco_150',
    title: 'Calentador solar de agua',
    category: 'ENERGY',
    complexity: 'ALTA',
    investment: 'ALTA',
    time: 'ALTA',
    collaborators: 'MEDIA',
    impact: 'Reemplaza calentamiento eléctrico de agua',
    returnInvestment: 'Más de 24 meses',
    steps: ['Evaluar techo', 'Cotizar', 'Instalar'],
    ciiuCodes: [],
    targetLoads: ['agua_caliente'],
  },
];

// Tabla "Datos de negocios similares" (23 panaderías de Perú y Bolivia).
export const PEER_STATS = [
  { ecoId: 'eco_118', sector: 'bakery', chosen: 9, completed: 7, withBills: 4, medianKwhPerDayChangePct: -6 },
  { ecoId: 'eco_204', sector: 'bakery', chosen: 6, completed: 3, withBills: 2, medianKwhPerDayChangePct: -11 },
  { ecoId: 'eco_090', sector: 'bakery', chosen: 11, completed: 9, withBills: 5, medianKwhPerDayChangePct: -4 },
  { ecoId: 'eco_071', sector: 'bakery', chosen: 2, completed: 1, withBills: 1, medianKwhPerDayChangePct: -18 },
  { ecoId: 'eco_150', sector: 'bakery', chosen: 1, completed: 0, withBills: 0, medianKwhPerDayChangePct: null },
];

const bill = (id, start, end, kwh, tariff) => ({
  id,
  businessId: 'biz_ines',
  type: 'electricity',
  kwhConsumed: kwh,
  costPerKwh: tariff,
  billingStartDate: start,
  billingEndDate: end,
  uploadedFiles: [`factura-${id}.jpg`],
});

// Facturas reales del caso (enero–junio 2026).
export const INES_BILLS = [
  bill('bill_2026_01', '2026-01-01', '2026-01-31', 1840, 0.78),
  bill('bill_2026_02', '2026-02-01', '2026-02-28', 1690, 0.78),
  bill('bill_2026_03', '2026-03-01', '2026-03-31', 1910, 0.81),
  bill('bill_2026_04', '2026-04-01', '2026-04-30', 1760, 0.81),
  bill('bill_2026_05', '2026-05-01', '2026-05-31', 1880, 0.81),
  bill('bill_2026_06', '2026-06-01', '2026-06-30', 1720, 0.84),
];

// SIMULADAS para la demo (Inés todavía no completó nada): empieza burletes el 1/7 y termina el 10/7.
export const INES_SIMULATED_POST_BILLS = [
  bill('bill_2026_07', '2026-07-01', '2026-07-31', 1800, 0.84), // periodo mixto: se excluye
  bill('bill_2026_08', '2026-08-01', '2026-08-31', 1767, 0.84), // 57,0 kWh/día: dentro del ruido
  bill('bill_2026_09', '2026-09-01', '2026-09-30', 1665, 0.86), // 55,5 kWh/día y la tarifa vuelve a subir
];

export const INES_PLANS = [
  {
    id: 'plan_552',
    businessId: 'biz_ines',
    ecoCardOrigin: 'eco_071',
    title: 'Aislamiento térmico del horno',
    status: 'in_progress',
    statusUpdatedAt: '2026-05-13', // 7 semanas antes del 1/7
    startedAt: '2026-05-13',
    steps: [{ title: 'Cotizar aislamiento', status: 'not_started', subSteps: [] }],
  },
];

/**
 * Panaderías sintéticas para poblar el reporte a aliados (k-anonimato >= 5).
 * Cada una: 4 facturas antes, 2 después, efecto distinto.
 */
export function syntheticPeers() {
  const effects = [0.93, 0.95, 0.9, 0.96, 0.92, 1.0];
  const businesses = [];
  const bills = [];
  const plans = [];
  effects.forEach((factor, i) => {
    const id = `biz_peer_${i + 1}`;
    const base = 40 + i * 6; // kWh/día
    // Fechas de alta distintas: algunas llegan a medir su ahorro dentro de sus primeros 90 días y otras no.
    const joinedAt = ['2026-05-05', '2026-05-10', '2026-03-01', '2026-05-20', '2026-02-15', '2026-05-12'][i];
    businesses.push({ id, name: `Panadería ${i + 1}`, country: i % 2 ? 'BO' : 'PE', sector: 'bakery', ciiu: '1071', email: `peer${i + 1}@ejemplo.test`, joinedAt });
    const months = [
      ['2026-01-01', '2026-01-31', 31], ['2026-02-01', '2026-02-28', 28], ['2026-03-01', '2026-03-31', 31], ['2026-04-01', '2026-04-30', 30],
      ['2026-06-01', '2026-06-30', 30], ['2026-07-01', '2026-07-31', 31],
    ];
    const wobble = [1.01, 0.99, 1.0, 1.005, 1.0, 0.995];
    months.forEach(([s, e, d], k) => {
      const f = k >= 4 ? factor : 1;
      bills.push({ id: `${id}_b${k}`, businessId: id, type: 'electricity', kwhConsumed: Math.round(base * d * f * wobble[k]), costPerKwh: 0.8, billingStartDate: s, billingEndDate: e, uploadedFiles: [] });
    });
    // Impacto percibido (declarado): varias lo declaran alto, aunque no todas lo tengan medido.
    const perceivedImpact = [{ scale: 5 }, { scale: 4 }, null, { scale: 5 }, { scale: 3 }, { scale: 5 }][i];
    plans.push({ id: `plan_peer_${i + 1}`, businessId: id, ecoCardOrigin: i % 2 ? 'eco_204' : 'eco_118', title: 'peer', status: 'completed', statusUpdatedAt: '2026-05-20', startedAt: '2026-05-01', completedAt: '2026-05-20', perceivedImpact, steps: [] });
  });
  return { businesses, bills, plans };
}

/** Panadería recién llegada, sin facturas: para mostrar la recomendación de un negocio nuevo (caso 1c del enunciado). */
export const NEW_BAKERY = {
  id: 'biz_nueva',
  name: 'Panadería La Espiga',
  ownerName: 'Rosa Quispe',
  email: 'rosa@ejemplo.test',
  country: 'BO',
  city: 'Cochabamba',
  ciiu: '1071',
  sector: 'bakery',
  employees: '3',
  diagnosis: { topic: 'ENERGY', level: 'Inicial', sections: { fuentes: 30, consumo: 35 } },
  joinedAt: '2026-07-01',
  quarterBudget: 500,
  hoursPerWeek: 2,
  mainLoads: ['horno'],
};
