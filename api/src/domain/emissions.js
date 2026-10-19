// CO₂ equivalente de la electricidad consumida (el anexo dice que la factura "agrega co2Equivalent").
// SUPUESTO a validar con el equipo: factores de emisión de la red eléctrica por país, en kg CO₂ por kWh.
export const EMISSION_FACTORS_KG_PER_KWH = { PE: 0.21, BO: 0.43 };

export const emissionFactor = (country) => EMISSION_FACTORS_KG_PER_KWH[country] ?? null;

/** kg de CO₂ equivalente (redondeado a 1 decimal), o null si no hay factor para el país. */
export function co2Kg(kwh, country) {
  const f = emissionFactor(country);
  return f === null ? null : Math.round(kwh * f * 10) / 10;
}
