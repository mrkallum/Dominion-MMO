import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import profileRoutes from './routes/profile.js';
import authRoutes from './routes/auth.js';
import inventoryRoutes from './routes/inventory.js';
import economyRoutes from './routes/economy.js';

// local JSON-based database used by routes; no external DB init here

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientDir = path.join(__dirname, '../dominion-client');

// Middleware
app.use(cors());
app.use(express.json());

// Static client
app.use(express.static(clientDir));

// Altcha widget
const altchaDir = path.join(__dirname, '..', 'altcha-main', 'altcha-main');
app.use('/altcha-main', express.static(altchaDir));

app.get('/altcha-main/*', (req, res) => {
  res.sendFile(path.join(altchaDir, 'index.html'));
});

// API Routes
app.use('/profile', profileRoutes);
app.use('/auth', authRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/economy', economyRoutes);

// Log error endpoint
app.post('/log-error', (req, res) => {
  const { message, filename, lineno, colno, error } = req.body;
  const logEntry = `${new Date().toISOString()} - Error: ${message} at ${filename}:${lineno}:${colno} - ${error}\n`;
  fs.appendFile(path.join(__dirname, '..', '..', 'errors.txt'), logEntry, (err) => {
    if (err) {
      console.error('Failed to log error:', err);
      return res.status(500).json({ error: 'Failed to log error' });
    }
    res.status(200).json({ success: true });
  });
});

// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  const logEntry = `${new Date().toISOString()} - Server Error: ${err.message} - ${err.stack}\n`;
  fs.appendFile(path.join(__dirname, '..', '..', 'errors.txt'), logEntry, (logErr) => {
    if (logErr) console.error('Failed to log server error:', logErr);
  });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`🔥 Dominion API + Client running at http://localhost:${port}`);
});

export default app;
