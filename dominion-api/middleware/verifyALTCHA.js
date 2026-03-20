import crypto from 'crypto';
import { read, insert, update } from '../services/jsonDatabase.js';
import { redisClient } from '../services/database.js';
import { incrAndCheck } from '../services/rateLimiter.js';

// Middleware to verify ALTCHA proof via server API and issue altcha_token
export const verifyALTCHA = async (req, res, next) => {
    const { altcha, email } = req.body;

    if (!altcha || !email) {
        return res.status(400).json({ error: 'ALTCHA proof and email required' });
    }

    // allow bypass in development/test or when explicitly disabled
    const bypass = process.env.NODE_ENV !== 'production' || process.env.ALTCHA_DISABLE === 'true';

    try {
        let verified = false;

        // Rate limit ALTCHA attempts per IP: 20 per minute
        try {
            const ipKey = req.ip || req.connection.remoteAddress;
            const rk = `rate:altcha:ip:${ipKey}`;
            const rl = await incrAndCheck(rk, 20, 60);
            if (!rl.allowed) return res.status(429).json({ error: 'Too many ALTCHA requests, slow down' });
        } catch (e) {
            console.warn('Rate limiter failed', e?.message || e);
        }

        if (bypass) {
            // in non-production environments we skip the remote call to avoid DNS/network issues
            console.warn('ALTCHA verification bypassed (development mode or ALTCHA_DISABLE)');
            verified = true;
        } else {
            // Verify ALTCHA solution via the ALTCHA server API
            const verifyResponse = await fetch(process.env.ALTCHA_VERIFY_URL || 'https://api.altcha.org/api/v1/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challenge: altcha.challenge,
                    salt: altcha.salt,
                    signature: altcha.signature,
                    number: altcha.number,
                }),
            });

            if (!verifyResponse.ok) {
                console.error('ALTCHA verification failed:', await verifyResponse.text());
            } else {
                const verifyData = await verifyResponse.json();
                verified = verifyData.verified;
            }
        }

        if (!verified) {
            return res.status(403).json({ error: 'Human verification failed' });
        }

        // Generate short-lived altcha_token (2 minutes)
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
        const ip = req.ip || req.connection.remoteAddress;

        if (redisClient && redisClient.isOpen) {
            const key = `altcha:${token}`;
            await redisClient.hSet(key, { email, ip, used: 'false' });
            await redisClient.expire(key, 2 * 60);
        } else {
            await insert('altcha_tokens', { token, email, ip, expires_at: expiresAt.toISOString(), used: false });
        }

        // Attach token to request for next middleware
        req.altchaToken = token;
        next();
    } catch (err) {
        console.error('Error verifying altcha or creating altcha_token:', err);
        if (bypass) {
            // in development we allow proceed despite the error
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
            const ip = req.ip || req.connection.remoteAddress;
            if (redisClient && redisClient.isOpen) {
                const key = `altcha:${token}`;
                await redisClient.hSet(key, { email, ip, used: 'false' });
                await redisClient.expire(key, 2 * 60);
            } else {
                await insert('altcha_tokens', { token, email, ip, expires_at: expiresAt.toISOString(), used: false });
            }
            req.altchaToken = token;
            next();
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

// Middleware to check valid altcha_token
export const requireALTCHAToken = async (req, res, next) => {
    const { altcha_token } = req.body;

    if (!altcha_token) {
        return res.status(403).json({ error: 'Human verification required' });
    }

    try {
        if (redisClient && redisClient.isOpen) {
            const key = `altcha:${altcha_token}`;
            const data = await redisClient.hGetAll(key);
            if (!data || Object.keys(data).length === 0) return res.status(403).json({ error: 'Human verification required' });
            // mark used by deleting key
            await redisClient.del(key);
            req.altchaData = { token: altcha_token, email: data.email, ip: data.ip };
            return next();
        }

        const all = await read('altcha_tokens');
        const now = new Date();
        const matches = all.filter(t => t.token === altcha_token && new Date(t.expires_at) > now && !t.used);
        if (matches.length === 0) return res.status(403).json({ error: 'Human verification required' });
        const tokenData = matches[0];
        await update('altcha_tokens', tokenData.id, { used: true });
        req.altchaData = tokenData;
        next();
    } catch (err) {
        console.error('Error validating altcha_token:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};