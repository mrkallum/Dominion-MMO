import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { read, insert } from '../services/jsonDatabase.js';
import { verifyALTCHA, requireALTCHAToken } from '../middleware/verifyALTCHA.js';
import { generateOTP, storeOTP, verifyOTP } from '../middleware/verifyOTP.js';
import { incrAndCheck } from '../services/rateLimiter.js';
import { signJWT } from '../middleware/verifyJWT.js';
import { sendOTPEmail } from '../services/email.js';

const router = express.Router();

// Generate ALTCHA challenge (server-side)
function generateALTCHAChallenge() {
    const salt = crypto.randomBytes(16).toString('base64');
    const challenge = crypto.randomBytes(16).toString('base64');
    return {
        challenge,
        salt,
        algorithm: 'SHA-256',
        maxNumber: 100000,
    };
}

// ALTCHA challenge endpoint
router.get('/challenge', (req, res) => {
    const challenge = generateALTCHAChallenge();
    res.json(challenge);
});

// ALTCHA verification endpoint - issues altcha_token
router.post('/altcha', verifyALTCHA, async (req, res) => {
    // verifyALTCHA middleware has already verified and stored token
    res.json({ altcha_token: req.altchaToken });
});

// Request OTP - requires valid altcha_token
router.post('/request-otp', requireALTCHAToken, async (req, res) => {
    const { intent } = req.body; // 'signup' or 'login'
    const email = req.altchaData.email;

    if (!intent || !['signup', 'login'].includes(intent)) {
        return res.status(400).json({ error: 'Invalid intent' });
    }

    // For login, check if user exists
    if (intent === 'login') {
        const users = await read('users');
        const found = users.find(u => u.email === email);
        if (!found) return res.status(400).json({ error: 'User not found' });
    }

    // Generate and store OTP
    try {
        const key = `rate:otp:req:${email}`;
        const res = await incrAndCheck(key, 5, 60 * 60);
        if (!res.allowed) return res.status(429).json({ error: 'Too many OTP requests, try later' });
    } catch (e) {
        console.warn('Rate limiter failed', e?.message || e);
    }

    const otp = generateOTP();
    await storeOTP(email, otp);

    // Send email
    try {
        await sendOTPEmail(email, otp);
        res.json({ message: 'OTP sent' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// Verify OTP and complete auth
router.post('/verify-otp', async (req, res) => {
    const { email, code, intent, password, username } = req.body;

    if (!email || !code || !intent) {
        return res.status(400).json({ error: 'Email, code, and intent required' });
    }

    // Verify OTP
    const otpResult = await verifyOTP(email, code);
    if (!otpResult.valid) {
        return res.status(400).json({ error: otpResult.error });
    }

    try {
        if (intent === 'signup') {
            // Create user
            if (!password || password.length < 6) {
                return res.status(400).json({ error: 'Password required and must be at least 6 characters' });
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const user = await insert('users', { email, password_hash: passwordHash, email_verified_at: new Date().toISOString() });

            // Create profile (use same id as user)
            const profileUsername = username || email.split('@')[0];
            await insert('profiles', { id: user.id, email: user.email, username: profileUsername });

            // Issue JWT
            const token = signJWT({ id: user.id, email: user.email });
            res.json({ token, user });

        } else if (intent === 'login') {
            // Get user
            const users = await read('users');
            const user = users.find(u => u.email === email);
            if (!user) return res.status(400).json({ error: 'User not found' });

            // Issue JWT
            const token = signJWT({ id: user.id, email: user.email });
            res.json({ token, user });
        } else {
            res.status(400).json({ error: 'Invalid intent' });
        }
    } catch (err) {
        console.error('Auth error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Resend OTP - also requires ALTCHA
router.post('/resend-otp', requireALTCHAToken, async (req, res) => {
    const email = req.altchaData.email;

    try {
        const key = `rate:otp:req:${email}`;
        const res = await incrAndCheck(key, 5, 60 * 60);
        if (!res.allowed) return res.status(429).json({ error: 'Too many OTP requests, try later' });
    } catch (e) {
        console.warn('Rate limiter failed', e?.message || e);
    }

    // Generate new OTP
    const otp = generateOTP();
    await storeOTP(email, otp);

    try {
        await sendOTPEmail(email, otp);
        res.json({ message: 'OTP resent' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send email' });
    }
});

export default router;
