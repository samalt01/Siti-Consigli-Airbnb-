import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherIcon, weatherLabel } from '../js/weather.mjs';

test('weatherIcon mappa i codici WMO principali', () => {
  assert.equal(weatherIcon(0), '☀️');
  assert.equal(weatherIcon(3), '☁️');
  assert.equal(weatherIcon(61), '🌧️');
  assert.equal(weatherIcon(75), '🌨️');
  assert.equal(weatherIcon(95), '⛈️');
  assert.equal(weatherIcon(999), '🌡️'); // fallback
});

test('weatherLabel bilingue con fallback IT', () => {
  assert.equal(weatherLabel(0, 'it'), 'Sereno');
  assert.equal(weatherLabel(0, 'en'), 'Clear');
  assert.equal(weatherLabel(65, 'it'), 'Pioggia');
  assert.equal(weatherLabel(95, 'en'), 'Storm');
  assert.equal(weatherLabel(0, 'xx'), 'Sereno'); // lingua sconosciuta → IT
});
