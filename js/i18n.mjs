export const STRINGS = {
  it: {
    food: 'Cibo', places: 'Places to go', kids: 'Per i più piccoli', shopping: 'Shopping',
    all: 'Tutti', beaches: 'Spiagge', experiences: 'Esperienze',
    sortBy: 'Ordina:', sortRating: 'Miglior voto', sortDistance: 'Più vicini',
    call: 'Chiama', directions: 'Indicazioni', contactHost: 'Contatta il tuo host',
    back: 'Indietro', hours: 'Orari', address: 'Indirizzo',
    today: 'Oggi', checkOnGoogle: 'Verifica gli orari su Google',
    errorLoad: 'Impossibile caricare i consigli. Riprova più tardi.',
    emptyCategory: 'Nessun posto in questa sezione, per ora.',
    tagline: 'I posti che consiglio ai miei ospiti',
    openNow: 'Aperto', closedNow: 'Chiuso',
    favorites: 'Preferiti', noFavorites: 'Nessun preferito qui. Tocca il cuore su un posto per salvarlo.',
    mapView: 'Mappa', listView: 'Lista', details: 'Dettagli', apartment: 'Appartamento',
  },
  en: {
    food: 'Food', places: 'Places to go', kids: 'For the little ones', shopping: 'Shopping',
    all: 'All', beaches: 'Beaches', experiences: 'Experiences',
    sortBy: 'Sort:', sortRating: 'Top rated', sortDistance: 'Nearest',
    call: 'Call', directions: 'Directions', contactHost: 'Contact your host',
    back: 'Back', hours: 'Hours', address: 'Address',
    today: 'Today', checkOnGoogle: 'Check hours on Google',
    errorLoad: 'Could not load the recommendations. Please try again later.',
    emptyCategory: 'No places in this section yet.',
    tagline: 'The places I recommend to my guests',
    openNow: 'Open', closedNow: 'Closed',
    favorites: 'Favorites', noFavorites: 'No favorites here yet. Tap the heart on a place to save it.',
    mapView: 'Map', listView: 'List', details: 'Details', apartment: 'Apartment',
  },
};

export function t(key, lang) {
  return STRINGS[lang]?.[key] ?? STRINGS.it[key] ?? key;
}

export function getLang(storage = globalThis.localStorage) {
  const v = storage.getItem('lang');
  return v === 'en' || v === 'it' ? v : 'it';
}

export function setLang(lang, storage = globalThis.localStorage) {
  if (lang === 'it' || lang === 'en') storage.setItem('lang', lang);
}
