const COLLECTION_KEY = 'ultima-chama-collection-v1';
const SLOTS = ['head', 'body', 'charm'];

export const RARITIES = Object.freeze([
  { id: 'common', name: 'Comum', marks: '✦', chance: 60 },
  { id: 'rare', name: 'Raro', marks: '✦✦', chance: 27 },
  { id: 'epic', name: 'Épico', marks: '✦✦✦', chance: 10 },
  { id: 'legendary', name: 'Lendário', marks: '✦✦✦✦', chance: 3 }
].map(Object.freeze));

const equipment = [
  ['head', 'common', 'Capuz de Vigília', 'hood', { defense: .02 }],
  ['head', 'rare', 'Elmo do Sentinela', 'helmet', { defense: .04 }],
  ['head', 'epic', 'Máscara de Ossos', 'boneMask', { defense: .07 }],
  ['head', 'legendary', 'Coroa da Última Chama', 'crown', { defense: .10 }],
  ['body', 'common', 'Colete do Explorador', 'vest', { damage: .03, defense: .01 }],
  ['body', 'rare', 'Armadura do Guardião', 'armor', { damage: .06, defense: .02 }],
  ['body', 'epic', 'Manto das Cinzas', 'cloak', { damage: .10, defense: .03 }],
  ['body', 'legendary', 'Armadura da Aurora', 'royalArmor', { damage: .15, defense: .05 }],
  ['charm', 'common', 'Bolsa de Brasas', 'satchel', { damage: .01, reload: .02 }],
  ['charm', 'rare', 'Amuleto da Vigília', 'amulet', { damage: .02, reload: .04 }],
  ['charm', 'epic', 'Brasa Eterna', 'ember', { damage: .03, reload: .07 }],
  ['charm', 'legendary', 'Estandarte da Chama', 'standard', { damage: .05, reload: .10 }]
];

export const ITEM_CATALOG = Object.freeze(equipment.map(([slot, rarity, name, style, bonus]) =>
  Object.freeze({ id: `${slot}-${rarity}`, name, slot, rarity, style, bonus: Object.freeze(bonus) })
));
const itemsById = new Map(ITEM_CATALOG.map(item => [item.id, item]));

function nonnegativeInteger(value) {
  return Number.isFinite(value) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value))) : 0;
}

export function createCollection() {
  return { unlocked: [], equipped: { head: null, body: null, charm: null }, best: 0 };
}

export function sanitizeCollection(value) {
  const collection = createCollection();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return collection;
  if (Array.isArray(value.unlocked)) {
    collection.unlocked = [...new Set(value.unlocked.filter(id => itemsById.has(id)))];
  }
  for (const slot of SLOTS) {
    const id = value.equipped?.[slot];
    if (itemsById.get(id)?.slot === slot && collection.unlocked.includes(id)) collection.equipped[slot] = id;
  }
  collection.best = nonnegativeInteger(value.best);
  return collection;
}

export function rollEquipment(rng = Math.random, minRarity = 0) {
  const random = () => {
    const value = rng();
    return Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0;
  };
  const roll = random() * 100;
  let boundary = 0;
  let rarityIndex = RARITIES.findIndex(rarity => { boundary += rarity.chance; return roll < boundary; });
  rarityIndex = Math.max(rarityIndex, Math.min(3, nonnegativeInteger(minRarity)));
  const slot = SLOTS[Math.floor(random() * SLOTS.length)];
  return itemsById.get(`${slot}-${RARITIES[rarityIndex].id}`);
}

export function unlockEquipment(collection, itemId) {
  if (!itemsById.has(itemId) || !Array.isArray(collection?.unlocked) || collection.unlocked.includes(itemId)) return false;
  collection.unlocked.push(itemId);
  return true;
}

export function equipItem(collection, itemId, slot) {
  if (!collection?.equipped || typeof collection.equipped !== 'object') return false;
  if (itemId === null) {
    if (!SLOTS.includes(slot)) return false;
    collection.equipped[slot] = null;
    return true;
  }
  const item = itemsById.get(itemId);
  if (!item || !Array.isArray(collection.unlocked) || !collection.unlocked.includes(itemId)) return false;
  if (slot !== undefined && slot !== item.slot) return false;
  collection.equipped[item.slot] = itemId;
  return true;
}

export function getEquipmentBonuses(collection) {
  const clean = sanitizeCollection(collection);
  const bonuses = { damage: 0, defense: 0, reload: 0 };
  for (const id of Object.values(clean.equipped)) {
    const item = itemsById.get(id);
    if (item) for (const stat of Object.keys(bonuses)) bonuses[stat] += item.bonus[stat] || 0;
  }
  bonuses.damage = Math.min(.20, bonuses.damage);
  bonuses.defense = Math.min(.15, bonuses.defense);
  bonuses.reload = Math.min(.10, bonuses.reload);
  return bonuses;
}

// Resolve the browser storage inside try: even reading localStorage may throw.
export function loadCollection(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    return sanitizeCollection(JSON.parse(target.getItem(COLLECTION_KEY) || 'null'));
  } catch { return createCollection(); }
}

export function saveCollection(collection, storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target.setItem(COLLECTION_KEY, JSON.stringify(sanitizeCollection(collection)));
    return true;
  } catch { return false; }
}

// time uses the campaign clock in milliseconds; only eliminations multiply.
export function addScore(state, base, time, comboKill = false) {
  const now = nonnegativeInteger(time);
  state.score = nonnegativeInteger(state.score);
  state.best = nonnegativeInteger(state.best);
  state.combo = Math.min(4, nonnegativeInteger(state.combo));
  state.comboUntil = nonnegativeInteger(state.comboUntil);
  if (now >= state.comboUntil) { state.combo = 0; state.comboUntil = 0; }
  if (comboKill) {
    state.combo = Math.min(4, state.combo + 1);
    state.comboUntil = now + 4000;
  }
  const points = nonnegativeInteger(nonnegativeInteger(base) * (comboKill ? state.combo : 1));
  state.score = nonnegativeInteger(state.score + points);
  state.best = Math.max(state.best, state.score);
  return points;
}
