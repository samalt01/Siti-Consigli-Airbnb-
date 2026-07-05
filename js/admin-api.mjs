// Wrapper Places API (New), Routes API e MyMemory. I parser sono puri (testati in Node).
const PLACES_FIELDS = 'id,displayName,internationalPhoneNumber,formattedAddress,location,regularOpeningHours.weekdayDescriptions,photos';

export function parsePlaceDetails(p) {
  return {
    placeId: p.id,
    name: p.displayName?.text ?? '',
    phone: p.internationalPhoneNumber ?? null,
    address: p.formattedAddress ?? null,
    coords: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
    hours: p.regularOpeningHours?.weekdayDescriptions
      ? { ...p.regularOpeningHours.weekdayDescriptions } : null,
  };
}

export function parseRoute(r) {
  const route = r.routes?.[0];
  if (!route) return null;
  return {
    km: Math.round(route.distanceMeters / 100) / 10,
    minutes: Math.round(parseInt(route.duration, 10) / 60),
  };
}

export function slugify(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function jsonOrThrow(res) {
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function searchPlaces(query, key) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress' },
    body: JSON.stringify({ textQuery: query, languageCode: 'it' }),
  });
  return (await jsonOrThrow(res)).places ?? [];
}

export async function fetchPlaceDetails(placeId, key) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=it`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': PLACES_FIELDS },
  });
  return jsonOrThrow(res); // JSON grezzo: il chiamante usa parsePlaceDetails + .photos
}

export async function fetchDistance(home, coords, key) {
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration' },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: home.lat, longitude: home.lng } } },
      destination: { location: { latLng: { latitude: coords.lat, longitude: coords.lng } } },
      travelMode: 'DRIVE',
    }),
  });
  return parseRoute(await jsonOrThrow(res));
}

export async function fetchPhotoBlob(photoName, key) {
  const res = await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=900&key=${key}`);
  if (!res.ok) throw new Error(`Foto ${res.status}`);
  return res.blob();
}

export async function translateItToEn(text) {
  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=it|en`);
  const data = await jsonOrThrow(res);
  const out = data.responseData?.translatedText ?? '';
  return data.responseStatus === 200 ? out : '';
}

// --- Descrizioni con IA (Claude) ---

const CATEGORY_LABEL = {
  food: 'ristorante/locale dove mangiare', places: 'luogo da visitare',
  kids: 'attrazione per bambini e famiglie', shopping: 'posto per lo shopping',
};

export function buildDescriptionPrompt(place) {
  const parts = [
    `Sei l'host di un appartamento vacanze sulla Costa dei Trabocchi (Abruzzo, vicino Ortona/San Vito Chietino).`,
    `Scrivi la scheda di un posto che consigli ai tuoi ospiti.`,
    ``,
    `Posto: ${place.name}`,
    `Tipo: ${CATEGORY_LABEL[place.category] ?? place.category}${place.tag === 'beach' ? ' (spiaggia)' : place.tag === 'experience' ? ' (esperienza/gita)' : ''}`,
    place.address ? `Indirizzo: ${place.address}` : null,
    place.distance ? `Distanza dall'appartamento: ${place.distance.km} km (${place.distance.minutes} min in auto)` : null,
    ``,
    `Tono: propositivo ma non eccessivamente entusiasta, da consiglio personale di un host che conosce la zona. 2-3 frasi, includi un suggerimento pratico se sensato (prenotare, orari, cosa portare). Niente superlativi gonfiati, niente emoji.`,
  ];
  return parts.filter(l => l !== null).join('\n');
}

export async function generateDescriptions(place, anthropicKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              descriptionIt: { type: 'string', description: 'Descrizione in italiano, 2-3 frasi' },
              descriptionEn: { type: 'string', description: 'Stessa descrizione in inglese naturale (non tradotta parola per parola)' },
            },
            required: ['descriptionIt', 'descriptionEn'],
            additionalProperties: false,
          },
        },
      },
      messages: [{ role: 'user', content: buildDescriptionPrompt(place) }],
    }),
  });
  const data = await jsonOrThrow(res);
  if (data.stop_reason === 'refusal') throw new Error('Richiesta rifiutata dal modello');
  const text = data.content?.find(b => b.type === 'text')?.text ?? '';
  return JSON.parse(text);
}
