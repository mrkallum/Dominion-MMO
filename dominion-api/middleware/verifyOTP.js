import bcrypt from 'bcrypt';
import { read, insert, update, remove } from '../services/jsonDatabase.js';
import { redisClient } from '../services/database.js';
import { incrAndCheck } from '../services/rateLimiter.js';

// Generate OTP code
export const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
};

// Hash OTP for storage
export const hashOTP = async (code) => {
    return await bcrypt.hash(code, 10);
};

// Verify OTP
export const verifyOTP = async (email, code) => {
    try {
        // Limit verify attempts: 10 per hour per email
        try {
            const key = `rate:otp:verify:${email}`;
            const res = await incrAndCheck(key, 10, 60 * 60);
            if (!res.allowed) return { valid: false, error: 'Too many verification attempts, try later' };
        } catch (e) {
            console.warn('Rate limiter failed', e?.message || e);
        }
        // Prefer Redis for ephemeral OTP storage
        if (redisClient && redisClient.isOpen) {
            const key = `otp:${email}`;
            const data = await redisClient.hGetAll(key);
            if (!data || Object.keys(data).length === 0) return { valid: false, error: 'No valid OTP found' };

            const attempts = Number(data.attempts || 0);
            if (attempts >= 3) return { valid: false, error: 'Too many attempts' };

            const isValid = await bcrypt.compare(code, data.code_hash || '');
            if (!isValid) {
                await redisClient.hIncrBy(key, 'attempts', 1);
                return { valid: false, error: 'Invalid code' };
            }

            // successful - remove key
            await redisClient.del(key);
            return { valid: true };
        }

        const all = await read('otp_codes');
        const now = new Date();
        const candidates = all
            .filter(o => o.email === email && new Date(o.expires_at) > now)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (candidates.length === 0) return { valid: false, error: 'No valid OTP found' };

        const otpData = candidates[0];

        // Check attempts
        if (otpData.attempts >= 3) {
            return { valid: false, error: 'Too many attempts' };
        }

        const isValid = await bcrypt.compare(code, otpData.code_hash);

        if (!isValid) {
            // Increment attempts
            await update('otp_codes', otpData.id, { attempts: (otpData.attempts || 0) + 1 });
            return { valid: false, error: 'Invalid code' };
        }

        // Delete used OTP
        await remove('otp_codes', otpData.id);

        return { valid: true };
    } catch (err) {
        console.error('Error verifying OTP:', err);
        return { valid: false, error: 'Internal error' };
    }
};

// Store OTP
export const storeOTP = async (email, code) => {
    const codeHash = await hashOTP(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    try {
        if (redisClient && redisClient.isOpen) {
            const key = `otp:${email}`;
            const now = new Date().toISOString();
            await redisClient.hSet(key, { code_hash: codeHash, attempts: '0', createdAt: now });
            await redisClient.expire(key, 10 * 60);
            return;
        }

        await insert('otp_codes', { email, code_hash: codeHash, expires_at: expiresAt.toISOString(), attempts: 0 });
    } catch (err) {
        console.error('Error storing OTP:', err);
        throw err;
    }
};