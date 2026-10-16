// Minimal in-game HUD: health and ammunition only. No telemetry panels or control list.
export function createHUD(doc = document) {
  const healthBar = doc.getElementById('hudHealthBar');
  const healthValue = doc.getElementById('hudHealthValue');
  const weaponName = doc.getElementById('hudWeaponName');
  const ammoValue = doc.getElementById('hudAmmoCount');

  function updateHealth(health) {
    const value = Math.max(0, Math.min(100, health));
    if (healthBar) {
      healthBar.style.transform = `scaleX(${value / 100})`;
      healthBar.dataset.level = value <= 25 ? 'critical' : value <= 55 ? 'warning' : 'healthy';
    }
    if (healthValue) healthValue.textContent = `${Math.round(value)}%`;
  }

  function updateAmmo(currentWeapon, ammo, weapons) {
    if (!currentWeapon || !weapons[currentWeapon] || !ammo[currentWeapon]) {
      if (weaponName) weaponName.textContent = 'TOCHA';
      if (ammoValue) ammoValue.textContent = '— / —';
      return;
    }
    const slot = ammo[currentWeapon];
    if (weaponName) weaponName.textContent = weapons[currentWeapon].name;
    if (ammoValue) ammoValue.textContent = `${slot.mag} / ${slot.reserve}`;
    if (ammoValue) ammoValue.dataset.empty = slot.mag === 0 ? 'true' : 'false';
  }
  return { updateHealth, updateAmmo };
}
