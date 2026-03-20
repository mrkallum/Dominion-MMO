import { redisClient } from './database.js';
import { read, update, insert, write } from './jsonDatabase.js';

async function redisIncr(key, windowSeconds) {
  const client = redisClient;
  if (!client || !client.isOpen) return null;
  const count = await client.incr(key);
  if (Number(count) === 1) await client.expire(key, windowSeconds);
  return Number(count);
}

async function jsonIncr(key, windowSeconds) {
  const now = Date.now();
  const items = await read('rate_counters');
  let rec = items.find(r => r.key === key);
  if (!rec || new Date(rec.expiresAt).getTime() <= now) {
    rec = { key, count: 1, expiresAt: new Date(now + windowSeconds * 1000).toISOString() };
    // replace or insert
    const others = items.filter(r => r.key !== key);
    others.push(rec);
    await write('rate_counters', others);
    return 1;
  }
  rec.count = (rec.count || 0) + 1;
  const updated = items.map(r => r.key === key ? rec : r);
  await write('rate_counters', updated);
  return rec.count;
}

export async function incrWithExpire(key, windowSeconds) {
  try {
    const r = await redisIncr(key, windowSeconds);
    if (r !== null) return r;
  } catch (e) {
    console.warn('Redis rate incr failed', e?.message || e);
  }
  return await jsonIncr(key, windowSeconds);
}

export async function incrAndCheck(key, limit, windowSeconds) {
  const count = await incrWithExpire(key, windowSeconds);
  return { allowed: count <= limit, count };
}

export default { incrWithExpire, incrAndCheck };
