import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, getLang, setLang, STRINGS } from '../js/i18n.mjs';

test('t traduce e fa fallback', () => {
  assert.equal(t('call', 'it'), 'Chiama');
  assert.equal(t('call', 'en'), 'Call');
  assert.equal(t('chiave-inesistente', 'en'), 'chiave-inesistente');
});

test('getLang/setLang con storage iniettato', () => {
  const mem = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  assert.equal(getLang(mem), 'it');
  setLang('en', mem);
  assert.equal(getLang(mem), 'en');
  setLang('xx', mem); // ignorato
  assert.equal(getLang(mem), 'en');
});

test('tutte le chiavi IT esistono anche in EN', () => {
  assert.deepEqual(Object.keys(STRINGS.en).sort(), Object.keys(STRINGS.it).sort());
});
