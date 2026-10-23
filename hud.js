// In-game health, ammunition and the three selectable weapon slots.
export function createHUD(doc = document) {
  const healthBar = doc.getElementById('hudHealthBar');
  const healthValue = doc.getElementById('hudHealthValue');
  const weaponName = doc.getElementById('hudWeaponName');
  const ammoValue = doc.getElementById('hudAmmoCount');
  const weaponRows = [...(doc.querySelectorAll?.('[data-hud-weapon]') ?? [])].map(button => {
    const clearEquipAnimation = event => {
      if (event.target === button) setClass(button, 'just-equipped', false);
    };
    button.addEventListener('animationend', clearEquipAnimation);
    button.addEventListener('animationcancel', clearEquipAnimation);
    return {
      button,
      id: button.dataset.hudWeapon,
      ammo: button.querySelector('[data-hud-ammo]'),
      state: button.querySelector('[data-hud-weapon-state]')
    };
  });
  let selectedWeapon = null;

  function setText(element, value) {
    if (element && element.textContent !== value) element.textContent = value;
  }

  function setData(element, key, value) {
    if (element && element.dataset[key] !== value) element.dataset[key] = value;
  }

  function setAttribute(element, name, value) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }

  function setClass(element, name, enabled) {
    if (element.classList.contains(name) !== enabled) element.classList.toggle(name, enabled);
  }

  function updateHealth(health) {
    const value = Math.max(0, Math.min(100, health));
    if (healthBar) {
      const transform = `scaleX(${value / 100})`;
      if (healthBar.style.transform !== transform) healthBar.style.transform = transform;
      setData(healthBar, 'level', value <= 25 ? 'critical' : value <= 55 ? 'warning' : 'healthy');
    }
    setText(healthValue, `${Math.round(value)}%`);
  }

  function updateAmmo(currentWeapon, ammo = {}, weapons = {}, inventory) {
    // Older callers only provide ammo; an explicit inventory is authoritative.
    const ownsWeapon = id => Boolean(weapons[id] && (inventory ? inventory.has(id) : ammo[id]));
    const equipped = currentWeapon && ownsWeapon(currentWeapon) ? currentWeapon : null;
    const switched = equipped !== selectedWeapon;
    selectedWeapon = equipped;

    const activeAmmo = equipped ? ammo[equipped] ?? { mag: 0, reserve: 0 } : null;
    setText(weaponName, equipped ? weapons[equipped].name : 'TOCHA');
    setText(ammoValue, activeAmmo ? `${activeAmmo.mag} / ${activeAmmo.reserve}` : '— / —');
    setData(ammoValue, 'empty', activeAmmo?.mag === 0 ? 'true' : 'false');

    for (const row of weaponRows) {
      const available = ownsWeapon(row.id);
      const active = row.id === equipped;
      const slot = available ? ammo[row.id] ?? { mag: 0, reserve: 0 } : null;
      const ammoText = slot ? `${slot.mag} / ${slot.reserve}` : '— / —';
      const state = available ? active ? 'EQUIPADA' : 'DISPONÍVEL' : 'BLOQUEADA';
      setClass(row.button, 'is-selected', active);
      setClass(row.button, 'is-locked', !available);
      if (row.button.disabled !== !available) row.button.disabled = !available;
      setAttribute(row.button, 'aria-pressed', active ? 'true' : 'false');
      setAttribute(row.button, 'aria-disabled', available ? 'false' : 'true');
      const label = `${weapons[row.id]?.name ?? row.id.toUpperCase()} · ${state}${available ? ` · ${ammoText}` : ''}`;
      setAttribute(row.button, 'aria-label', label);
      setText(row.ammo, ammoText);
      setData(row.ammo, 'empty', slot?.mag === 0 ? 'true' : 'false');
      setText(row.state, state);
      // CSS owns the motion and reduced-motion preference. No layout reads are
      // needed, and normal ammo/health refreshes never restart this animation.
      if (switched) setClass(row.button, 'just-equipped', active);
    }
  }
  return { updateHealth, updateAmmo };
}
