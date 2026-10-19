// Repositorio MongoDB. Usa `id` propio (string) como clave de negocio; `_id` nunca sale de aquí.
import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';

const strip = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
};

export async function createMongoRepo(uri, dbName = 'kamai') {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const c = {
    businesses: db.collection('businesses'),
    catalog: db.collection('ecoCards'),
    peerStats: db.collection('peerStats'),
    bills: db.collection('userBills'),
    plans: db.collection('userEcoCards'),
    recommendations: db.collection('recommendations'),
    snapshots: db.collection('savingsSnapshots'),
    outbox: db.collection('emailOutbox'),
    billChanges: db.collection('billChanges'),
  };
  await Promise.all([
    c.businesses.createIndex({ id: 1 }, { unique: true }),
    c.catalog.createIndex({ id: 1 }, { unique: true }),
    c.peerStats.createIndex({ sector: 1, ecoId: 1 }, { unique: true }),
    c.bills.createIndex({ id: 1 }, { unique: true }),
    c.bills.createIndex({ businessId: 1, billingStartDate: 1 }),
    c.plans.createIndex({ id: 1 }, { unique: true }),
    c.recommendations.createIndex({ businessId: 1, createdAt: 1 }),
    c.snapshots.createIndex({ planId: 1, createdAt: 1 }),
    c.outbox.createIndex({ key: 1 }, { unique: true }), // idempotencia por persona + plantilla + plan
    c.outbox.createIndex({ status: 1, nextAttemptAt: 1 }),
    c.billChanges.createIndex({ businessId: 1, at: 1 }),
  ]);
  const proj = { projection: { _id: 0 } };
  const newId = (p) => `${p}_${randomUUID().slice(0, 8)}`;

  return {
    kind: 'mongo',
    async getBusiness(id) { return c.businesses.findOne({ id }, proj); },
    async upsertBusiness(b) { await c.businesses.replaceOne({ id: b.id }, b, { upsert: true }); return b; },
    async listBusinesses() { return c.businesses.find({}, proj).toArray(); },

    async listCatalog() { return c.catalog.find({}, proj).sort({ id: 1 }).toArray(); },
    async upsertEco(e) { await c.catalog.replaceOne({ id: e.id }, e, { upsert: true }); },

    async listPeerStats(sector) { return c.peerStats.find({ sector }, proj).toArray(); },
    async upsertPeerStat(s) { await c.peerStats.replaceOne({ sector: s.sector, ecoId: s.ecoId }, s, { upsert: true }); },

    async listBills(businessId) { return c.bills.find({ businessId }, proj).sort({ billingStartDate: 1 }).toArray(); },
    async getBill(id) { return c.bills.findOne({ id }, proj); },
    async insertBill(b) { const doc = { ...b, id: b.id ?? newId('bill') }; await c.bills.insertOne({ ...doc }); return doc; },
    async updateBill(id, patch) {
      return strip(await c.bills.findOneAndUpdate({ id }, { $set: patch }, { returnDocument: 'after' }));
    },
    async deleteBill(id) { return (await c.bills.deleteOne({ id })).deletedCount === 1; },

    async logBillChange(e) { await c.billChanges.insertOne({ ...e }); return e; },
    async listBillChanges(businessId) { return c.billChanges.find({ businessId }, proj).sort({ at: 1, _id: 1 }).toArray(); },

    async getPlan(id) { return c.plans.findOne({ id }, proj); },
    async listPlans(businessId) { return c.plans.find({ businessId }, proj).toArray(); },
    async listAllPlans() { return c.plans.find({}, proj).toArray(); },
    async insertPlan(p) { const doc = { ...p, id: p.id ?? newId('plan') }; await c.plans.insertOne({ ...doc }); return doc; },
    async updatePlan(id, patch) {
      return strip(await c.plans.findOneAndUpdate({ id }, { $set: patch }, { returnDocument: 'after' }));
    },

    async saveRecommendation(r) { await c.recommendations.insertOne({ ...r }); return r; },
    async lastRecommendation(businessId) {
      return (await c.recommendations.find({ businessId }, proj).sort({ createdAt: -1, _id: -1 }).limit(1).toArray())[0] ?? null;
    },
    async listRecommendations(businessId) { return c.recommendations.find({ businessId }, proj).sort({ createdAt: 1 }).toArray(); },

    async lastSnapshot(planId) {
      return (await c.snapshots.find({ planId }, proj).sort({ createdAt: -1, _id: -1 }).limit(1).toArray())[0] ?? null;
    },
    async saveSnapshot(s) { await c.snapshots.insertOne({ ...s }); return s; },
    async listSnapshots(planId) { return c.snapshots.find({ planId }, proj).sort({ createdAt: 1, _id: 1 }).toArray(); },

    async enqueueOnce(msg) {
      try {
        await c.outbox.insertOne({ ...msg });
        return { inserted: true, message: msg };
      } catch (err) {
        if (err.code === 11000) return { inserted: false, message: await c.outbox.findOne({ key: msg.key }, proj) };
        throw err;
      }
    },
    async listOutbox(filter = {}) { return c.outbox.find(filter, proj).toArray(); },
    async updateOutbox(key, patch) {
      return strip(await c.outbox.findOneAndUpdate({ key }, { $set: patch }, { returnDocument: 'after' }));
    },

    async close() { await client.close(); },
  };
}
