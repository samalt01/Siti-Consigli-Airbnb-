import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlaceDetails, parseRoute, slugify } from '../js/admin-api.mjs';

test('parsePlaceDetails mappa i campi della Places API (New)', () => {
  const api = {
    id: 'ChIJtest', displayName: { text: 'Trattoria Mario' },
    internationalPhoneNumber: '+39 085 123456',
    formattedAddress: 'Via Roma 1, 66026 Ortona CH',
    location: { latitude: 42.35, longitude: 14.40 },
    regularOpeningHours: { weekdayDescriptions: ['lunedì: 12–15', 'martedì: Chiuso'] },
  };
  assert.deepEqual(parsePlaceDetails(api), {
    placeId: 'ChIJtest', name: 'Trattoria Mario', phone: '+39 085 123456',
    address: 'Via Roma 1, 66026 Ortona CH', coords: { lat: 42.35, lng: 14.40 },
    hours: { 0: 'lunedì: 12–15', 1: 'martedì: Chiuso' },
  });
});

test('parsePlaceDetails tollera campi mancanti (es. spiagge senza telefono/orari)', () => {
  const r = parsePlaceDetails({ id: 'X', displayName: { text: 'Spiaggia' }, location: { latitude: 1, longitude: 2 } });
  assert.equal(r.phone, null);
  assert.equal(r.address, null);
  assert.equal(r.hours, null);
});

test('parseRoute converte metri e durata', () => {
  assert.deepEqual(parseRoute({ routes: [{ distanceMeters: 2340, duration: '372s' }] }), { km: 2.3, minutes: 6 });
  assert.equal(parseRoute({ routes: [] }), null);
});

test('slugify', () => {
  assert.equal(slugify("L'Angolino di Flavia"), 'l-angolino-di-flavia');
  assert.equal(slugify('Città Sant’Angelo!'), 'citta-sant-angelo');
});
