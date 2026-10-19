// Repositorio en memoria (tests y demo sin Mongo). Misma interfaz que mongoRepo.
const clone = (x) => (x === undefined || x === null ? x : structuredClone(x));

export function createMemoryRepo() {
  const db = {
    businesses: new Map(),
    catalog: new Map(),
    peerStats: new Map(),
    bills: new Map(),
    plans: new Map(),
    recommendations: [],
    snapshots: [],
    outbox: new Map(),
    billChanges: [],
  };
  let seq = 0;
  const nextId = (p) => `${p}_${Date.now().toString(36)}${(++seq).toString(36)}`;

  return {
    kind: 'memory',
    async getBusiness(id) { return clone(db.businesses.get(id)) ?? null; },
    async upsertBusiness(b) { db.businesses.set(b.id, clone(b)); return clone(b); },
    async listBusinesses() { return [...db.businesses.values()].map(clone); },

    async listCatalog() { return [...db.catalog.values()].map(clone); },
    async upsertEco(e) { db.catalog.set(e.id, clone(e)); },

    async listPeerStats(sector) { return [...db.peerStats.values()].filter((s) => s.sector === sector).map(clone); },
    async upsertPeerStat(s) { db.peerStats.set(`${s.sector}:${s.ecoId}`, clone(s)); },

    async listBills(businessId) { return [...db.bills.values()].filter((b) => b.businessId === businessId).map(clone); },
    async getBill(id) { return clone(db.bills.get(id)) ?? null; },
    async insertBill(b) { const doc = { ...b, id: b.id ?? nextId('bill') }; db.bills.set(doc.id, clone(doc)); return clone(doc); },
    async updateBill(id, patch) { const cur = db.bills.get(id); if (!cur) return null; const doc = { ...cur, ...patch, id }; db.bills.set(id, doc); return clone(doc); },
    async deleteBill(id) { return db.bills.delete(id); },

    /** Registro de cambios de facturas (para avisar cuándo y qué cambió). */
    async logBillChange(e) { db.billChanges.push(clone(e)); return clone(e); },
    async listBillChanges(businessId) { return db.billChanges.filter((e) => e.businessId === businessId).map(clone); },

    async getPlan(id) { return clone(db.plans.get(id)) ?? null; },
    async listPlans(businessId) { return [...db.plans.values()].filter((p) => p.businessId === businessId).map(clone); },
    async listAllPlans() { return [...db.plans.values()].map(clone); },
    async insertPlan(p) { const doc = { ...p, id: p.id ?? nextId('plan') }; db.plans.set(doc.id, clone(doc)); return clone(doc); },
    async updatePlan(id, patch) { const cur = db.plans.get(id); if (!cur) return null; const doc = { ...cur, ...patch, id }; db.plans.set(id, doc); return clone(doc); },

    async saveRecommendation(r) { db.recommendations.push(clone(r)); return clone(r); },
    async lastRecommendation(businessId) {
      const rs = db.recommendations.filter((r) => r.businessId === businessId);
      return clone(rs.at(-1)) ?? null;
    },
    async listRecommendations(businessId) { return db.recommendations.filter((r) => r.businessId === businessId).map(clone); },

    async lastSnapshot(planId) { return clone(db.snapshots.filter((s) => s.planId === planId).at(-1)) ?? null; },
    async saveSnapshot(s) { db.snapshots.push(clone(s)); return clone(s); },
    async listSnapshots(planId) { return db.snapshots.filter((s) => s.planId === planId).map(clone); },

    /** Inserta solo si la clave no existe (idempotencia). Devuelve {inserted}. */
    async enqueueOnce(msg) {
      if (db.outbox.has(msg.key)) return { inserted: false, message: clone(db.outbox.get(msg.key)) };
      db.outbox.set(msg.key, clone(msg));
      return { inserted: true, message: clone(msg) };
    },
    async listOutbox(filter = {}) {
      return [...db.outbox.values()].filter((m) => Object.entries(filter).every(([k, v]) => m[k] === v)).map(clone);
    },
    async updateOutbox(key, patch) { const cur = db.outbox.get(key); if (!cur) return null; const doc = { ...cur, ...patch }; db.outbox.set(key, doc); return clone(doc); },

    async close() {},
  };
}
