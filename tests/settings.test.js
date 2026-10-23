import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings, saveSettings } from '../save-system.js';

test('new settings respect system motion preference and use automatic quality', () => {
  globalThis.localStorage = { getItem: () => null };
  globalThis.matchMedia = () => ({ matches: true });
  const settings = loadSettings();
  assert.equal(settings.reducedMotion, true);
  assert.equal(settings.graphicsQuality, 'auto');
  assert.equal(settings.showFps, false);
});

test('player choice overrides defaults and survives saving', () => {
  let value = null;
  globalThis.localStorage = { getItem: () => value, setItem: (_key, next) => { value = next; } };
  const choice = { reducedMotion: false, graphicsQuality: 'low', showFps: true, brightness: .8 };
  saveSettings(choice);
  const restored = loadSettings();
  for (const [key, expected] of Object.entries(choice)) assert.equal(restored[key], expected);
});

test('restricted or malformed storage falls back to playable settings', () => {
  for (const read of [() => '{broken', () => { throw new Error('storage unavailable'); }]) {
    globalThis.localStorage = { getItem: read };
    assert.equal(loadSettings().graphicsQuality, 'auto');
  }
});
