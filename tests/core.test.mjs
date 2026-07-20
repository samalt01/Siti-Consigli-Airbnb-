import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visiblePlaces, formatDistance, starsHtml, descriptionFor, mapsUrl, waUrl, telUrl, photosOf, isOpenNow } from '../js/core.mjs';

const P = (over) => ({ id: 'x', placeId: 'PID', category: 'food', tag: null, name: 'X',
  rating: null, descriptionIt: 'it', descriptionEn: 'en', draft: false,
  phone: null, address: null, coords: null, distance: null, photoUrl: null, hours: null, ...over });

test('visiblePlaces: filtra draft e categoria, ordina rating desc poi km asc, null in coda', () => {
  const places = [
    P({ id: 'a', rating: 4, distance: { km: 9, minutes: 12 } }),
    P({ id: 'b', rating: 4.5 }),
    P({ id: 'c', rating: 4, distance: { km: 2, minutes: 4 } }),
    P({ id: 'd', rating: null }),
    P({ id: 'e', rating: 5, draft: true }),
    P({ id: 'f', rating: 5, category: 'kids' }),
  ];
  assert.deepEqual(visiblePlaces(places, { category: 'food' }).map(p => p.id), ['b', 'c', 'a', 'd']);
});

test('visiblePlaces: ordinamento per distanza (km asc, null in coda)', () => {
  const places = [
    P({ id: 'a', rating: 4, distance: { km: 9, minutes: 12 } }),
    P({ id: 'b', rating: 4.5 }),                                   // distanza null → in coda
    P({ id: 'c', rating: 4, distance: { km: 2, minutes: 4 } }),
    P({ id: 'd', rating: 5, distance: { km: 5, minutes: 8 } }),
  ];
  assert.deepEqual(
    visiblePlaces(places, { category: 'food', sort: 'distance' }).map(p => p.id),
    ['c', 'd', 'a', 'b']);
});

test('visiblePlaces: includeDrafts e filtro tag', () => {
  const places = [
    P({ id: 'a', category: 'places', tag: 'beach' }),
    P({ id: 'b', category: 'places', tag: 'experience' }),
    P({ id: 'c', category: 'places', tag: 'beach', draft: true }),
  ];
  assert.deepEqual(visiblePlaces(places, { category: 'places', tag: 'beach', includeDrafts: true }).map(p => p.id), ['a', 'c']);
  assert.deepEqual(visiblePlaces(places, { category: 'places', tag: 'beach' }).map(p => p.id), ['a']);
});

test('formatDistance', () => {
  assert.equal(formatDistance({ km: 2.3, minutes: 6 }, 'it'), '2,3 km · 6 min in auto');
  assert.equal(formatDistance({ km: 2.3, minutes: 6 }, 'en'), '2.3 km · 6 min by car');
  assert.equal(formatDistance(null, 'it'), '');
});

test('starsHtml', () => {
  assert.match(starsHtml(4.5), /width:90%/);
  assert.match(starsHtml(4.5), /aria-label="4.5\/5"/);
  assert.equal(starsHtml(null), '');
});

test('descriptionFor: fallback su IT', () => {
  assert.equal(descriptionFor(P({}), 'en'), 'en');
  assert.equal(descriptionFor(P({ descriptionEn: '' }), 'en'), 'it');
  assert.equal(descriptionFor(P({}), 'it'), 'it');
});

test('mapsUrl con e senza placeId', () => {
  const home = { lat: 42.310869, lng: 14.441397 };
  const u = mapsUrl(P({}), home);
  assert.match(u, /origin=42.310869%2C14.441397|origin=42.310869,14.441397/);
  assert.match(u, /destination_place_id=PID/);
  const u2 = mapsUrl(P({ placeId: null, coords: { lat: 42.35, lng: 14.4 } }), home);
  assert.match(u2, /destination=42.35%2C14.4|destination=42.35,14.4/);
  assert.doesNotMatch(u2, /destination_place_id/);
});

test('waUrl e telUrl', () => {
  assert.match(waUrl('393665316952', 'it'), /^https:\/\/wa\.me\/393665316952\?text=/);
  assert.equal(telUrl('+39 085 123 456'), 'tel:+39085123456');
  assert.equal(telUrl(null), null);
});

test('photosOf: array photoUrls, fallback photoUrl singola, vuoto', () => {
  assert.deepEqual(photosOf(P({ photoUrls: ['a.jpg', 'b.jpg'], photoUrl: 'a.jpg' })), ['a.jpg', 'b.jpg']);
  assert.deepEqual(photosOf(P({ photoUrl: 'solo.jpg' })), ['solo.jpg']);
  assert.deepEqual(photosOf(P({})), []);
  assert.deepEqual(photosOf(P({ photoUrls: [] , photoUrl: 'x.jpg' })), ['x.jpg']);
});

test('isOpenNow: intervalli, chiuso, oltre mezzanotte, senza orari', () => {
  const p = { hours: { 0: 'lunedì: 13:00–14:00, 20:00–21:30', 6: 'domenica: Chiuso', 4: 'venerdì: 20:00–01:00' } };
  // lunedì 2026-01-05
  assert.equal(isOpenNow(p, new Date('2026-01-05T13:30:00')), true);
  assert.equal(isOpenNow(p, new Date('2026-01-05T15:00:00')), false);
  assert.equal(isOpenNow(p, new Date('2026-01-05T20:30:00')), true);
  // domenica 2026-01-11: chiuso
  assert.equal(isOpenNow(p, new Date('2026-01-11T12:00:00')), false);
  // venerdì 2026-01-09: oltre mezzanotte
  assert.equal(isOpenNow(p, new Date('2026-01-09T00:30:00')), true);
  assert.equal(isOpenNow(p, new Date('2026-01-09T19:00:00')), false);
  // nessun orario
  assert.equal(isOpenNow({ hours: null }, new Date('2026-01-05T13:30:00')), null);
});
