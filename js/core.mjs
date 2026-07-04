// Funzioni pure condivise da sito pubblico e admin. Nessuna dipendenza dal DOM.

export function visiblePlaces(places, { category, tag = null, includeDrafts = false }) {
  const key = (v, dir = 1) => (v === null || v === undefined ? Infinity : dir * v);
  return places
    .filter(p => p.category === category)
    .filter(p => (tag ? p.tag === tag : true))
    .filter(p => includeDrafts || !p.draft)
    .sort((a, b) =>
      key(a.rating, -1) - key(b.rating, -1) ||
      key(a.distance?.km) - key(b.distance?.km));
}

export function formatDistance(distance, lang) {
  if (!distance) return '';
  const km = lang === 'it' ? String(distance.km).replace('.', ',') : String(distance.km);
  const mode = lang === 'it' ? 'in auto' : 'by car';
  return `${km} km · ${distance.minutes} min ${mode}`;
}

export function starsHtml(rating) {
  if (rating === null || rating === undefined) return '';
  const pct = (rating / 5) * 100;
  return `<span class="stars" role="img" aria-label="${rating}/5">` +
    `<span class="stars-fill" style="width:${pct}%">★★★★★</span>★★★★★</span>`;
}

export function descriptionFor(place, lang) {
  return lang === 'en' && place.descriptionEn ? place.descriptionEn : place.descriptionIt;
}

export function mapsUrl(place, home) {
  const u = new URL('https://www.google.com/maps/dir/');
  u.searchParams.set('api', '1');
  u.searchParams.set('origin', `${home.lat},${home.lng}`);
  if (place.placeId) {
    u.searchParams.set('destination', place.name);
    u.searchParams.set('destination_place_id', place.placeId);
  } else if (place.coords) {
    u.searchParams.set('destination', `${place.coords.lat},${place.coords.lng}`);
  } else {
    u.searchParams.set('destination', place.name);
  }
  return u.toString();
}

const WA_MSG = {
  it: 'Ciao! Sono un ospite dell\'appartamento e avrei una domanda.',
  en: 'Hi! I\'m a guest at the apartment and I have a question.',
};

export function waUrl(number, lang) {
  return `https://wa.me/${number}?text=${encodeURIComponent(WA_MSG[lang] ?? WA_MSG.it)}`;
}

export function telUrl(phone) {
  return phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null;
}
