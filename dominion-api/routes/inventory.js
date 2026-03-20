import express from 'express';
import { verifyAuth } from '../middleware/verifyAuth.js';
import { read, update } from '../services/jsonDatabase.js';

const router = express.Router();

// Get current player's inventory
router.get('/', verifyAuth, async (req, res) => {
  const user = req.user;

  try {
    const profiles = await read('profiles');
    const profile = profiles.find(p => p.id === user.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    return res.json(profile.inventory || { gold: 0, iron: 0, copper: 0, items: [] });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Add an item to inventory (foundation only)
// Body: { id: string, quantity: number }
router.post('/add-item', verifyAuth, async (req, res) => {
  const user = req.user;
  const { id, quantity } = req.body;

  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid item id' });
  const qty = Number(quantity) || 1;
  if (qty <= 0) return res.status(400).json({ error: 'Quantity must be positive' });

  try {
    const profiles = await read('profiles');
    const profile = profiles.find(p => p.id === user.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const inventory = profile.inventory || { gold: 0, iron: 0, copper: 0, items: [] };

    // Find existing stack
    const existingIndex = inventory.items.findIndex((it) => it.id === id);
    if (existingIndex >= 0) {
      inventory.items[existingIndex].quantity += qty;
    } else {
      inventory.items.push({ id, quantity: qty });
    }

    // Persist
    await update('profiles', user.id, { inventory });
    return res.json(inventory);
  } catch (error) {
    console.error('Error updating inventory:', error);
    return res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// Remove an item or reduce quantity
// Body: { id: string, quantity: number }
router.post('/remove-item', verifyAuth, async (req, res) => {
  const user = req.user;
  const { id, quantity } = req.body;

  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid item id' });
  const qty = Number(quantity) || 1;
  if (qty <= 0) return res.status(400).json({ error: 'Quantity must be positive' });

  try {
    const profiles = await read('profiles');
    const profile = profiles.find(p => p.id === user.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const inventory = profile.inventory || { gold: 0, iron: 0, copper: 0, items: [] };

    const existingIndex = inventory.items.findIndex((it) => it.id === id);
    if (existingIndex === -1) return res.status(400).json({ error: 'Item not found' });

    inventory.items[existingIndex].quantity -= qty;
    if (inventory.items[existingIndex].quantity <= 0) {
      inventory.items.splice(existingIndex, 1);
    }

    await update('profiles', user.id, { inventory });
    return res.json(inventory);
  } catch (error) {
    console.error('Error updating inventory:', error);
    return res.status(500).json({ error: 'Failed to update inventory' });
  }
});

export default router;
