import express from 'express';
import { verifyAuth } from '../middleware/verifyAuth.js';
import { read, insert, update } from '../services/jsonDatabase.js';

const router = express.Router();

// Equipment modifiers (item id -> stat bonuses)
const equipmentModifiers = {
  sword: { strength: 5, agility: 2 },
  shield: { hp: 20, stamina: 10 },
  helmet: { hp: 10, intelligence: 3 },
  armor: { hp: 30, stamina: 15 },
  boots: { agility: 5, stamina: 5 }
};

router.get('/me', verifyAuth, async (req, res) => {
  const user = req.user;

  // Try to get existing profile
  const profiles = await read('profiles');
  const existing = profiles.find(p => p.id === user.id);
  if (existing) {
    return res.json({ ...existing, needsSetup: existing.username === user.email.split('@')[0] });
  }

  const defaultProfile = {
    id: user.id,
    email: user.email,
    username: user.email.split('@')[0],
    level: 1,
    xp: 0,
    faction: 'neutral',
    corruption_alignment: 'pure',
    race: 'human',
    stats: { hp: 100, stamina: 100, strength: 10, agility: 10, intelligence: 10 },
    inventory: { gold: 1, iron: 2, copper: 2, items: [ { id: 'sword', quantity: 1 }, { id: 'shield', quantity: 1 }, { id: 'helmet', quantity: 1 }, { id: 'armor', quantity: 1 }, { id: 'boots', quantity: 1 } ] }
  };

  const newProfile = await insert('profiles', defaultProfile);
  res.json({ ...newProfile, needsSetup: true });
});

router.post('/create', verifyAuth, async (req, res) => {
  const user = req.user;
  const { username, race, appearance } = req.body;

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ error: 'Valid username required' });
  }

  const validRaces = ['human', 'elf', 'dwarf', 'voidborn'];
  if (!race || !validRaces.includes(race)) {
    return res.status(400).json({ error: 'Valid race required' });
  }

  try {
    const updated = await update('profiles', user.id, { username: username.trim(), race, appearance: appearance ? appearance : null });
    if (!updated) return res.status(500).json({ error: 'Failed to update profile' });
    return res.json(updated);
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Equip an item
router.post('/equip', verifyAuth, async (req, res) => {
  const user = req.user;
  const { itemId, slot } = req.body;

  if (!itemId || !slot) {
    return res.status(400).json({ error: 'itemId and slot required' });
  }

  // Valid slots
  const validSlots = ['head', 'chest', 'legs', 'weapon', 'back'];
  if (!validSlots.includes(slot)) {
    return res.status(400).json({ error: 'Invalid slot' });
  }

  try {
    const profiles = await read('profiles');
    const profile = profiles.find(p => p.id === user.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const inventory = profile.inventory || { gold: 0, iron: 0, copper: 0, items: [] };

    // Check if item is in inventory
    const itemIndex = inventory.items.findIndex(it => it.id === itemId);
    if (itemIndex === -1) {
      return res.status(400).json({ error: 'Item not in inventory' });
    }

    // Remove from inventory
    inventory.items.splice(itemIndex, 1);

    // Add to equipment
    const appearance = profile.appearance || { customization: {} };
    appearance.customization = appearance.customization || {};
    appearance.customization[slot] = { asset: { id: itemId, name: itemId } };

    // Update stats
    const stats = profile.stats || {};
    const modifiers = equipmentModifiers[itemId] || {};
    Object.keys(modifiers).forEach(stat => {
      stats[stat] = (stats[stat] || 0) + modifiers[stat];
    });

    await update('profiles', user.id, { inventory, appearance, stats });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error equipping item:', error);
    return res.status(500).json({ error: 'Failed to equip item' });
  }
});

// Unequip an item
router.post('/unequip', verifyAuth, async (req, res) => {
  const user = req.user;
  const { slot } = req.body;

  if (!slot) {
    return res.status(400).json({ error: 'slot required' });
  }

  const validSlots = ['head', 'chest', 'legs', 'weapon', 'back'];
  if (!validSlots.includes(slot)) {
    return res.status(400).json({ error: 'Invalid slot' });
  }

  try {
    const profiles = await read('profiles');
    const profile = profiles.find(p => p.id === user.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const appearance = profile.appearance || { customization: {} };
    const equipped = appearance.customization?.[slot]?.asset;
    if (!equipped) {
      return res.status(400).json({ error: 'No item equipped in slot' });
    }

    const itemId = equipped.id || equipped.name;

    // Remove from equipment
    delete appearance.customization[slot];

    // Add to inventory
    const inventory = profile.inventory || { gold: 0, iron: 0, copper: 0, items: [] };
    inventory.items.push({ id: itemId, quantity: 1 });

    // Update stats (subtract modifiers)
    const stats = profile.stats || {};
    const modifiers = equipmentModifiers[itemId] || {};
    Object.keys(modifiers).forEach(stat => {
      stats[stat] = (stats[stat] || 0) - modifiers[stat];
    });

    await update('profiles', user.id, { inventory, appearance, stats });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error unequipping item:', error);
    return res.status(500).json({ error: 'Failed to unequip item' });
  }
});

export default router;
