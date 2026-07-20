import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFavorites, isFavorite, toggleFavorite } from '../js/favorites.mjs';

const mem = () => {
  const data = {};
  return { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

test('toggleFavorite aggiunge e rimuove, persistendo', () => {
  const s = mem();
  assert.deepEqual(getFavorites(s), []);
  assert.deepEqual(toggleFavorite('a', s), ['a']);
  assert.deepEqual(toggleFavorite('b', s), ['a', 'b']);
  assert.deepEqual(toggleFavorite('a', s), ['b']);
  assert.deepEqual(getFavorites(s), ['b']);
});

test('isFavorite e storage corrotto', () => {
  assert.equal(isFavorite('a', ['a', 'b']), true);
  assert.equal(isFavorite('c', ['a', 'b']), false);
  const s = mem(); s.setItem('favorites', 'non-json');
  assert.deepEqual(getFavorites(s), []); // fallback su array vuoto
});
