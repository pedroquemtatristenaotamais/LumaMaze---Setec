import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ITEM_CATALOG, RARITIES, createCollection, sanitizeCollection, rollEquipment,
  unlockEquipment, equipItem, getEquipmentBonuses, loadCollection, saveCollection, addScore
} from '../progression.js';

test('finite catalog offers one item per slot and rarity with readable names', () => {
  assert.ok(Array.isArray(ITEM_CATALOG), 'equipment catalog is exported');
  assert.equal(ITEM_CATALOG.length, 12);
  assert.deepEqual(RARITIES.map(r => [r.id, r.name, r.chance]), [
    ['common', 'Comum', 60], ['rare', 'Raro', 27], ['epic', 'Épico', 10], ['legendary', 'Lendário', 3]
  ]);
  for (const slot of ['head', 'body', 'charm']) {
    for (const rarity of RARITIES) {
      const choices = ITEM_CATALOG.filter(item => item.slot === slot && item.rarity === rarity.id);
      assert.equal(choices.length, 1);
      assert.ok(choices[0].name.length > 3);
      assert.equal(typeof choices[0].style, 'string');
      assert.equal(typeof choices[0].bonus, 'object');
      assert.ok(rarity.marks.length);
    }
  }
});

test('random boundaries preserve the 60/27/10/3 rarity distribution', () => {
  assert.equal(typeof rollEquipment, 'function');
  for (const [roll, rarity] of [[0, 'common'], [.599999, 'common'], [.6, 'rare'], [.869999, 'rare'], [.87, 'epic'], [.969999, 'epic'], [.97, 'legendary'], [.999999, 'legendary']]) {
    const item = rollEquipment(() => roll);
    assert.equal(item.rarity, rarity);
    assert.ok(ITEM_CATALOG.includes(item));
  }
});

test('boss minimums guarantee rare and epic rewards while allowing legendary rolls', () => {
  assert.equal(typeof rollEquipment, 'function');
  assert.equal(rollEquipment(() => 0, 1).rarity, 'rare');
  assert.equal(rollEquipment(() => 0, 2).rarity, 'epic');
  assert.equal(rollEquipment(() => .99, 2).rarity, 'legendary');
  for (const slotRoll of [0, .4, .8]) {
    let calls = 0;
    assert.equal(rollEquipment(() => calls++ === 0 ? 0 : slotRoll, 3).slot, ['head', 'body', 'charm'][Math.floor(slotRoll * 3)]);
  }
});

test('fresh collections are independent and duplicates are not unlocked twice', () => {
  assert.equal(typeof createCollection, 'function');
  const collection = createCollection();
  assert.deepEqual(collection, { unlocked: [], equipped: { head: null, body: null, charm: null }, best: 0 });
  assert.equal(unlockEquipment(collection, 'head-rare'), true);
  assert.equal(unlockEquipment(collection, 'head-rare'), false);
  assert.equal(unlockEquipment(collection, 'unknown'), false);
  assert.deepEqual(collection.unlocked, ['head-rare']);
  assert.deepEqual(createCollection().unlocked, []);
});

test('only unlocked items equip their own slot and unequipping requires a valid slot', () => {
  assert.equal(typeof equipItem, 'function');
  const collection = createCollection();
  assert.equal(equipItem(collection, 'head-epic'), false);
  unlockEquipment(collection, 'head-epic');
  assert.equal(equipItem(collection, 'head-epic', 'body'), false);
  assert.equal(equipItem(collection, 'head-epic'), true);
  assert.equal(collection.equipped.head, 'head-epic');
  assert.equal(collection.equipped.body, null);
  assert.equal(equipItem(collection, null), false);
  assert.equal(equipItem(collection, null, 'head'), true);
  assert.equal(collection.equipped.head, null);
  assert.equal(equipItem(collection, null, '__proto__'), false);
});

test('sanitizing corrupt data removes unknown, duplicate and locked equipment', () => {
  assert.equal(typeof sanitizeCollection, 'function');
  const original = {
    unlocked: ['head-rare', 'head-rare', 'body-epic', 'unknown', null, {}],
    equipped: { head: 'head-rare', body: 'head-rare', charm: 'charm-legendary', unknown: 'body-epic' },
    best: 42.9, stage: 8
  };
  assert.deepEqual(sanitizeCollection(original), {
    unlocked: ['head-rare', 'body-epic'], equipped: { head: 'head-rare', body: null, charm: null }, best: 42
  });
  assert.equal(original.unlocked.length, 6);
  for (const malformed of [null, [], 42, 'broken', { unlocked: {}, equipped: [], best: -1 }, { best: Infinity }, { best: '999' }]) {
    assert.deepEqual(sanitizeCollection(malformed), createCollection());
  }
});

test('equipment bonuses grow with rarity and stay within all gameplay caps', () => {
  assert.equal(typeof getEquipmentBonuses, 'function');
  assert.deepEqual(getEquipmentBonuses(createCollection()), { damage: 0, defense: 0, reload: 0 });
  const totals = [];
  for (const rarity of ['common', 'rare', 'epic', 'legendary']) {
    const collection = createCollection();
    for (const slot of ['head', 'body', 'charm']) {
      unlockEquipment(collection, `${slot}-${rarity}`);
      equipItem(collection, `${slot}-${rarity}`);
    }
    const bonuses = getEquipmentBonuses(collection);
    assert.ok(bonuses.damage > 0 && bonuses.damage <= .2);
    assert.ok(bonuses.defense > 0 && bonuses.defense <= .15);
    assert.ok(bonuses.reload > 0 && bonuses.reload <= .1);
    totals.push(bonuses.damage + bonuses.defense + bonuses.reload);
  }
  assert.ok(totals.every((value, i) => i === 0 || value > totals[i - 1]));
  assert.deepEqual(getEquipmentBonuses({ equipped: { head: 'head-legendary' }, unlocked: [] }), { damage: 0, defense: 0, reload: 0 });
});

function memoryStorage() {
  const data = new Map([['ultima-chama-campaign-v2', '{"stage":8}']]);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test('collection survives campaign deletion and restores equipment and record', () => {
  assert.equal(typeof saveCollection, 'function');
  const storage = memoryStorage();
  const collection = createCollection();
  unlockEquipment(collection, 'body-legendary');
  equipItem(collection, 'body-legendary');
  collection.best = 12345;
  assert.equal(saveCollection(collection, storage), true);
  assert.equal(storage.data.get('ultima-chama-campaign-v2'), '{"stage":8}');
  storage.removeItem('ultima-chama-campaign-v2');
  assert.deepEqual(loadCollection(storage), collection);
  const restored = loadCollection(storage);
  restored.unlocked.push('head-common');
  assert.deepEqual(loadCollection(storage), collection);
});

test('unavailable and malformed browser storage never interrupts the game', () => {
  assert.equal(typeof loadCollection, 'function');
  for (const raw of ['{bad', 'null', '[]', '{"unlocked":"all","best":-99}', '{"equipped":{"head":"unknown"}}']) {
    assert.deepEqual(loadCollection({ getItem: () => raw }), createCollection());
  }
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } };
  assert.deepEqual(loadCollection(denied), createCollection());
  assert.equal(saveCollection(createCollection(), denied), false);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('SecurityError'); } });
    assert.deepEqual(loadCollection(), createCollection());
    assert.equal(saveCollection(createCollection()), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('kill chains multiply up to four and expire at the four second boundary', () => {
  assert.equal(typeof addScore, 'function');
  const state = { score: 0, best: 0, combo: 0, comboUntil: 0 };
  assert.equal(addScore(state, 100, 1000, true), 100);
  assert.deepEqual(state, { score: 100, best: 100, combo: 1, comboUntil: 5000 });
  assert.equal(addScore(state, 100, 2000, true), 200);
  assert.equal(addScore(state, 100, 3000, true), 300);
  assert.equal(addScore(state, 100, 4000, true), 400);
  assert.equal(addScore(state, 100, 5000, true), 400);
  assert.equal(state.combo, 4);
  assert.equal(addScore(state, 100, 9000, true), 100);
  assert.equal(state.combo, 1);
  assert.equal(state.best, 1500);
});

test('nonkill points do not multiply or extend chains and preserve a higher record', () => {
  assert.equal(typeof addScore, 'function');
  const state = { score: 100, best: 5000, combo: 3, comboUntil: 4000 };
  assert.equal(addScore(state, 25, 3000), 25);
  assert.deepEqual(state, { score: 125, best: 5000, combo: 3, comboUntil: 4000 });
  assert.equal(addScore(state, 25, 4000), 25);
  assert.equal(state.combo, 0);
  assert.equal(state.comboUntil, 0);
});

test('invalid score input cannot create negative or nonfinite points', () => {
  assert.equal(typeof addScore, 'function');
  const state = { score: NaN, best: -8, combo: Infinity, comboUntil: NaN };
  assert.equal(addScore(state, -100, 0), 0);
  assert.deepEqual(state, { score: 0, best: 0, combo: 0, comboUntil: 0 });
  assert.equal(addScore(state, Infinity, 0), 0);
  assert.equal(addScore(state, 10.8, 0), 10);
});
