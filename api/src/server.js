import { createApp } from './app.js';
import { createMemoryRepo } from './repo/memoryRepo.js';
import { createMongoRepo } from './repo/mongoRepo.js';
import { seed } from './seed/seed.js';
import { createFakeAiClient, createHttpAiClient } from './integrations/ai.js';
import { createFakeMessagingClient, createHttpMessagingClient, deliverPending } from './integrations/messaging.js';

const PORT = Number(process.env.PORT ?? 3000);

async function buildRepo() {
  if (process.env.MONGO_URL) return { repo: await createMongoRepo(process.env.MONGO_URL), stop: async () => {} };
  if (process.argv.includes('--mongo-memory')) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    console.log(`MongoDB en memoria: ${mongod.getUri()}`);
    return { repo: await createMongoRepo(mongod.getUri()), stop: () => mongod.stop() };
  }
  return { repo: createMemoryRepo(), stop: async () => {} };
}

const built = await buildRepo();
const holder = { repo: built.repo };
await seed(holder.repo);
// Con --demo (npm run start:recorridos) se habilitan los endpoints internos que usan los recorridos: reiniciar datos y simular fallas.
const repo = new Proxy({}, { get: (_, k) => holder.repo[k] });
const stop = built.stop;
const demo = {
  async reset() {
    if (holder.repo.kind !== 'memory') throw new Error('reset solo disponible en modo memoria');
    holder.repo = createMemoryRepo();
    await seed(holder.repo);
  },
};

const ai = process.env.AI_URL
  ? createHttpAiClient({ url: process.env.AI_URL, apiKey: process.env.AI_API_KEY })
  : createFakeAiClient({ mode: process.env.FAKE_AI_MODE ?? 'ok' });
const messaging = process.env.MESSAGING_SERVICE_URL
  ? createHttpMessagingClient({ url: process.env.MESSAGING_SERVICE_URL, apiKey: process.env.MESSAGING_API_KEY })
  : createFakeMessagingClient({ failTimes: Number(process.env.FAKE_MESSAGING_FAIL_TIMES ?? 0) });

const demoEnabled = process.argv.includes('--demo') || process.env.DEMO === '1';
const app = createApp({ repo, ai, messaging, demo: demoEnabled ? demo : null });
const server = app.listen(PORT, () => console.log(`Kamai en http://localhost:${PORT} (repo: ${repo.kind}${demoEnabled ? ', recorridos habilitados: abrí /?recorridos' : ''})`));

// Worker de correos cada 60 s (en prod sería un job programado aparte).
const timer = setInterval(() => deliverPending(repo, messaging).catch((e) => console.error('outbox', e)), 60_000);

const shutdown = async () => {
  clearInterval(timer);
  server.close();
  await repo.close();
  await stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
