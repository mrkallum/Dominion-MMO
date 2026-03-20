import { read, write, insert, update, remove } from './jsonDatabase.js';
import { createClient } from 'redis';

// Export JSON DB helpers as a drop-in lightweight replacement for server code
// Also create a Redis client when possible so the app can use Redis if available.
let redisClient = null;
const redisUrl = process.env.REDIS_URL || process.env.ALTCHA_STORAGE_REDIS_URL || `redis://localhost:${process.env.ALTCHA_STORAGE_REDIS_PORT || 6379}`;
try {
	redisClient = createClient({ url: redisUrl });
	redisClient.on('error', (err) => console.warn('Redis client error', err));
	redisClient.connect().then(() => console.log('Connected to Redis at', redisUrl)).catch((e) => console.warn('Redis connect failed', e.message || e));
} catch (e) {
	console.warn('Redis client initialization skipped:', e.message || e);
}

export { read, write, insert, update, remove, redisClient };
