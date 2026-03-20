// Currency conversion and helpers for Dominion economy
const GOLD_TO_IRON = 4;
const IRON_TO_COPPER = 4;

export function toCopper({ gold = 0, iron = 0, copper = 0 } = {}) {
  return (Number(gold) * GOLD_TO_IRON * IRON_TO_COPPER) + (Number(iron) * IRON_TO_COPPER) + Number(copper);
}

export function fromCopper(totalCopper = 0) {
  const t = Math.max(0, Math.floor(Number(totalCopper) || 0));

  const copper = t % IRON_TO_COPPER;
  const totalIron = Math.floor(t / IRON_TO_COPPER);
  const iron = totalIron % GOLD_TO_IRON;
  const gold = Math.floor(totalIron / GOLD_TO_IRON);

  return { gold, iron, copper };
}

export function addCurrencyToInventory(inventory = {}, delta = {}) {
  const base = {
    gold: Number(inventory.gold) || 0,
    iron: Number(inventory.iron) || 0,
    copper: Number(inventory.copper) || 0,
    items: Array.isArray(inventory.items) ? inventory.items.slice() : []
  };

  const d = {
    gold: Number(delta.gold) || 0,
    iron: Number(delta.iron) || 0,
    copper: Number(delta.copper) || 0
  };

  const total = toCopper(base) + toCopper(d);
  const normalized = fromCopper(total);

  return {
    gold: normalized.gold,
    iron: normalized.iron,
    copper: normalized.copper,
    items: base.items
  };
}

export const MAX_COPPER_PER_CALL = 1000000000; // safety cap (in copper units)
