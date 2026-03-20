import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const dataDir = path.resolve(process.cwd(), 'data');

// Simple per-collection promise queue to avoid concurrent writes
const queues = new Map();

async function ensureCollectionFile(collection) {
  await fs.mkdir(dataDir, { recursive: true });
  const fp = path.join(dataDir, `${collection}.json`);
  try {
    await fs.access(fp);
  } catch (e) {
    await fs.writeFile(fp, '[]', 'utf8');
  }
  return fp;
}

function enqueue(collection, op) {
  const last = queues.get(collection) || Promise.resolve();
  const next = last.then(() => op());
  // ensure failures don't block the queue permanently
  queues.set(collection, next.catch(() => {}));
  return next;
}

export async function read(collection) {
  const fp = await ensureCollectionFile(collection);
  const txt = await fs.readFile(fp, 'utf8');
  try {
    return JSON.parse(txt || '[]');
  } catch (e) {
    // if file is corrupted, reset to empty array (safe fallback)
    console.error(`Corrupted JSON in ${fp}, resetting file.`);
    await write(collection, []);
    return [];
  }
}

export async function write(collection, data) {
  const fp = await ensureCollectionFile(collection);
  return enqueue(collection, async () => {
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, fp);
  });
}

export async function insert(collection, record) {
  const now = new Date().toISOString();
  if (!record.id) record.id = crypto.randomUUID();
  record.createdAt = record.createdAt || now;
  record.updatedAt = now;
  const arr = await read(collection);
  arr.push(record);
  await write(collection, arr);
  return record;
}

export async function update(collection, id, updates) {
  const arr = await read(collection);
  const idx = arr.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  arr[idx] = { ...arr[idx], ...updates, updatedAt: now };
  await write(collection, arr);
  return arr[idx];
}

export async function remove(collection, id) {
  const arr = await read(collection);
  const idx = arr.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  arr.splice(idx, 1);
  await write(collection, arr);
  return true;
}

export default { read, write, insert, update, remove };
