import test from 'node:test';
import assert from 'node:assert/strict';
import { createHUD } from '../hud.js';
import { WEAPONS } from '../config.js';

// A small DOM surface keeps these HUD behavior tests runnable in Node.
class Element extends EventTarget {
  constructor(dataset = {}, children = {}) {
    super();
    this.mutations = 0;
    this.children = children;
    this.attributes = new Map();
    this._text = '';
    this._disabled = false;
    const tracked = initial => new Proxy(initial, {
      set: (target, key, value) => { this.mutations++; target[key] = value; return true; }
    });
    this.dataset = tracked(dataset);
    this.style = tracked({});
    const classes = new Set();
    this.classList = {
      contains: name => classes.has(name),
      add: name => { this.mutations++; classes.add(name); },
      remove: name => { this.mutations++; classes.delete(name); },
      toggle: (name, force) => {
        this.mutations++;
        const active = force ?? !classes.has(name);
        if (active) classes.add(name); else classes.delete(name);
        return active;
      }
    };
  }
  get textContent() { return this._text; }
  set textContent(value) { this.mutations++; this._text = value; }
  get disabled() { return this._disabled; }
  set disabled(value) { this.mutations++; this._disabled = value; }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.mutations++; this.attributes.set(name, String(value)); }
  querySelector(selector) { return this.children[selector] ?? null; }
}

function fixture({ rows = true } = {}) {
  const ids = Object.fromEntries(['hudHealthBar', 'hudHealthValue', 'hudWeaponName', 'hudAmmoCount'].map(id => [id, new Element()]));
  const weaponRows = rows ? ['ak', 'shotgun', 'pistol'].map(id => new Element({ hudWeapon: id }, {
    '[data-hud-ammo]': new Element(),
    '[data-hud-weapon-state]': new Element()
  })) : [];
  const elements = [...Object.values(ids), ...weaponRows.flatMap(row => [row, ...Object.values(row.children)])];
  return {
    hud: createHUD({
      getElementById: id => ids[id],
      querySelectorAll: selector => selector === '[data-hud-weapon]' ? weaponRows : []
    }),
    ids,
    row: id => weaponRows.find(row => row.dataset.hudWeapon === id),
    mutationCount: () => elements.reduce((sum, element) => sum + element.mutations, 0)
  };
}

test('torch-only play shows no equipped gun and keeps all weapon rows locked', () => {
  const { hud, ids, row } = fixture();
  hud.updateAmmo(null, {}, WEAPONS, new Set());

  assert.equal(ids.hudWeaponName.textContent, 'TOCHA');
  assert.equal(ids.hudAmmoCount.textContent, '— / —');
  assert.equal(ids.hudAmmoCount.dataset.empty, 'false');
  for (const id of ['ak', 'shotgun', 'pistol']) {
    const button = row(id);
    assert.equal(button.disabled, true);
    assert.equal(button.getAttribute('aria-disabled'), 'true');
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.match(button.getAttribute('aria-label'), /BLOQUEADA/);
    assert.equal(button.classList.contains('is-locked'), true);
    assert.equal(button.classList.contains('is-selected'), false);
    assert.equal(button.classList.contains('just-equipped'), false);
    assert.equal(button.querySelector('[data-hud-ammo]').textContent, '— / —');
  }
});

test('inventory controls availability and every unlocked row shows its own ammunition', () => {
  const { hud, row, ids } = fixture();
  const ammo = { pistol: { mag: 7, reserve: 24 }, ak: { mag: 30, reserve: 90 }, shotgun: { mag: 6, reserve: 12 } };
  hud.updateAmmo('pistol', ammo, WEAPONS, new Set(['pistol', 'ak']));

  assert.equal(row('pistol').disabled, false);
  assert.equal(row('pistol').getAttribute('aria-disabled'), 'false');
  assert.equal(row('pistol').getAttribute('aria-pressed'), 'true');
  assert.equal(row('pistol').classList.contains('is-selected'), true);
  assert.equal(row('pistol').querySelector('[data-hud-ammo]').textContent, '7 / 24');
  assert.equal(row('ak').disabled, false);
  assert.equal(row('ak').getAttribute('aria-pressed'), 'false');
  assert.equal(row('ak').querySelector('[data-hud-ammo]').textContent, '30 / 90');
  assert.match(row('ak').getAttribute('aria-label'), /AK-47.*30 \/ 90/);
  assert.equal(row('shotgun').disabled, true, 'stale ammunition cannot unlock a missing inventory item');
  assert.equal(row('shotgun').querySelector('[data-hud-ammo]').textContent, '— / —');
  assert.equal(ids.hudWeaponName.textContent, 'PISTOLA');
  assert.equal(ids.hudAmmoCount.textContent, '7 / 24');
});

test('switching weapons highlights the new row once, while shots and refreshes keep the animation settled', () => {
  const { hud, ids, row, mutationCount } = fixture();
  const ammo = { pistol: { mag: 2, reserve: 24 }, ak: { mag: 30, reserve: 90 } };
  const inventory = new Set(['pistol', 'ak']);
  hud.updateAmmo('pistol', ammo, WEAPONS, inventory);
  assert.equal(row('pistol').classList.contains('just-equipped'), true);
  row('pistol').dispatchEvent(new Event('animationend'));
  assert.equal(row('pistol').classList.contains('just-equipped'), false);

  const beforeRefresh = mutationCount();
  hud.updateAmmo('pistol', ammo, WEAPONS, inventory);
  assert.equal(mutationCount(), beforeRefresh, 'an unchanged refresh must not write to the DOM');
  ammo.pistol.mag = 0;
  hud.updateAmmo('pistol', ammo, WEAPONS, inventory);
  assert.equal(row('pistol').classList.contains('just-equipped'), false);
  assert.equal(ids.hudAmmoCount.textContent, '0 / 24');
  assert.equal(ids.hudAmmoCount.dataset.empty, 'true');
  assert.equal(row('pistol').querySelector('[data-hud-ammo]').textContent, '0 / 24');
  ammo.ak.reserve = 120;
  hud.updateAmmo('pistol', ammo, WEAPONS, inventory);
  assert.equal(row('ak').querySelector('[data-hud-ammo]').textContent, '30 / 120');
  assert.equal(row('ak').classList.contains('just-equipped'), false);

  hud.updateAmmo('ak', ammo, WEAPONS, inventory);
  assert.equal(row('ak').classList.contains('just-equipped'), true);
  assert.equal(row('ak').classList.contains('is-selected'), true);
  assert.equal(row('ak').getAttribute('aria-pressed'), 'true');
  assert.equal(row('pistol').classList.contains('is-selected'), false);
  assert.equal(row('pistol').getAttribute('aria-pressed'), 'false');
  assert.equal(ids.hudAmmoCount.dataset.empty, 'false');

  hud.updateAmmo('pistol', ammo, WEAPONS, inventory);
  assert.equal(row('ak').classList.contains('just-equipped'), false);
  assert.equal(row('pistol').classList.contains('just-equipped'), true, 'returning to a gun triggers its next equip animation');
  hud.updateAmmo(null, {}, WEAPONS, new Set());
  assert.equal(row('pistol').classList.contains('just-equipped'), false);
  assert.equal(ids.hudAmmoCount.dataset.empty, 'false');
});

test('legacy callers infer owned weapons from ammunition and support markup without selector rows', () => {
  const ammo = { shotgun: { mag: 3, reserve: 12 } };
  const modern = fixture();
  modern.hud.updateAmmo('shotgun', ammo, WEAPONS);
  assert.equal(modern.row('shotgun').disabled, false);
  assert.equal(modern.row('shotgun').classList.contains('is-selected'), true);
  assert.equal(modern.row('pistol').disabled, true);

  const legacy = fixture({ rows: false });
  legacy.hud.updateAmmo('shotgun', ammo, WEAPONS);
  assert.equal(legacy.ids.hudWeaponName.textContent, 'SHOTGUN');
  assert.equal(legacy.ids.hudAmmoCount.textContent, '3 / 12');
});

test('health remains readable at damage boundaries and unchanged health avoids DOM writes', () => {
  const { hud, ids, mutationCount } = fixture();
  hud.updateHealth(24.6);
  assert.equal(ids.hudHealthValue.textContent, '25%');
  assert.equal(ids.hudHealthBar.dataset.level, 'critical');
  const beforeRefresh = mutationCount();
  hud.updateHealth(24.6);
  assert.equal(mutationCount(), beforeRefresh);
  hud.updateHealth(500);
  assert.equal(ids.hudHealthValue.textContent, '100%');
  assert.equal(ids.hudHealthBar.style.transform, 'scaleX(1)');
  hud.updateHealth(-5);
  assert.equal(ids.hudHealthValue.textContent, '0%');
  assert.equal(ids.hudHealthBar.style.transform, 'scaleX(0)');
});
