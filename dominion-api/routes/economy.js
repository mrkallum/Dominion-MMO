import express from 'express';
import { verifyAuth } from '../middleware/verifyAuth.js';
import { read, insert, update } from '../services/jsonDatabase.js';
import { toCopper, fromCopper, addCurrencyToInventory, MAX_COPPER_PER_CALL } from '../services/economy.js';

const router = express.Router();

function devAllowed() {
  // Allow in non-production or when explicit env var enabled
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.DEV_ADD_MONEY === 'true';
}

// Dev-only endpoint to add currency to a player's inventory
router.post('/add', verifyAuth, async (req, res) => {
  if (!devAllowed()) return res.status(404).json({ error: 'Not found' });

  const user = req.user;
  const { gold = 0, iron = 0, copper = 0, reason = 'dev-add' } = req.body || {};

  const delta = {
    gold: Number(gold) || 0,
    iron: Number(iron) || 0,
    copper: Number(copper) || 0
  };

  if (delta.gold < 0 || delta.iron < 0 || delta.copper < 0) {
    return res.status(400).json({ error: 'Negative amounts not allowed' });
  }

  const deltaCopper = toCopper(delta);
  if (deltaCopper <= 0) return res.status(400).json({ error: 'No currency provided' });
  if (deltaCopper > MAX_COPPER_PER_CALL) return res.status(400).json({ error: 'Amount too large' });

  try {
    const profiles = await read('profiles');
    const profile = profiles.find(p => p.id === user.id);
    if (!profile) return res.status(500).json({ error: 'Failed to fetch profile' });

    const current = profile.inventory || { gold: 0, iron: 0, copper: 0, items: [] };
    const updatedInventory = addCurrencyToInventory(current, delta);
    await update('profiles', user.id, { inventory: updatedInventory });

    // Try to log the change to an 'economy_logs' table if it exists — don't fail if it doesn't
    try {
      await insert('economy_logs', { user_id: user.id, change: { gold: delta.gold, iron: delta.iron, copper: delta.copper }, reason, before: current, after: updatedInventory });
    } catch (e) {
      console.warn('economy log failed', e?.message || e);
    }
    return res.json(updatedInventory);
  } catch (err) {
    console.error('economy add error', err);
    return res.status(500).json({ error: 'Add money failed' });
  }
});

export default router;
