import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_PATH = path.join(__dirname, 'data', 'registry.json');

const EMPTY_STORE = {
  manufacturers: {},
  sentReports: {},
  forumPosts: [],
};

let writeQueue = Promise.resolve();

async function ensureStoreExists() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(EMPTY_STORE, null, 2), 'utf8');
  }
}

async function readStoreUnsafe() {
  await ensureStoreExists();
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      manufacturers: parsed?.manufacturers && typeof parsed.manufacturers === 'object' ? parsed.manufacturers : {},
      sentReports: parsed?.sentReports && typeof parsed.sentReports === 'object' ? parsed.sentReports : {},
      forumPosts: Array.isArray(parsed?.forumPosts) ? parsed.forumPosts : [],
    };
  } catch {
    return { ...EMPTY_STORE };
  }
}

async function atomicWriteStore(data) {
  const temp = `${STORE_PATH}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(temp, STORE_PATH);
}

export async function readStore() {
  await writeQueue;
  return readStoreUnsafe();
}

export async function updateStore(mutator) {
  writeQueue = writeQueue.then(async () => {
    const current = await readStoreUnsafe();
    const next = await mutator(current);
    await atomicWriteStore(next);
    return next;
  });

  return writeQueue;
}
