import { INES, CATALOG, PEER_STATS, INES_BILLS, INES_PLANS, NEW_BAKERY, syntheticPeers } from './data.js';

export async function seed(repo, { withPeers = true } = {}) {
  await repo.upsertBusiness(INES);
  await repo.upsertBusiness(NEW_BAKERY);
  for (const e of CATALOG) await repo.upsertEco(e);
  for (const s of PEER_STATS) await repo.upsertPeerStat(s);
  for (const b of INES_BILLS) if (!(await repo.getBill(b.id))) await repo.insertBill(b);
  for (const p of INES_PLANS) if (!(await repo.getPlan(p.id))) await repo.insertPlan(p);
  if (withPeers) {
    const peers = syntheticPeers();
    for (const b of peers.businesses) await repo.upsertBusiness(b);
    for (const b of peers.bills) if (!(await repo.getBill(b.id))) await repo.insertBill(b);
    for (const p of peers.plans) if (!(await repo.getPlan(p.id))) await repo.insertPlan(p);
  }
}
