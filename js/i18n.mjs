export const STRINGS = {
  it: {
    food: 'Cibo', places: 'Places to go', kids: 'Per i più piccoli', shopping: 'Shopping',
    all: 'Tutti', beaches: 'Spiagge', experiences: 'Esperienze',
    call: 'Chiama', directions: 'Indicazioni', contactHost: 'Contatta il tuo host',
    back: 'Indietro', hours: 'Orari', address: 'Indirizzo',
    today: 'Oggi', checkOnGoogle: 'Verifica gli orari su Google',
    errorLoad: 'Impossibile caricare i consigli. Riprova più tardi.',
    emptyCategory: 'Nessun posto in questa sezione, per ora.',
    tagline: 'I posti che consiglio ai miei ospiti',
  },
  en: {
    food: 'Food', places: 'Places to go', kids: 'For the little ones', shopping: 'Shopping',
    all: 'All', beaches: 'Beaches', experiences: 'Experiences',
    call: 'Call', directions: 'Directions', contactHost: 'Contact your host',
    back: 'Back', hours: 'Hours', address: 'Address',
    today: 'Today', checkOnGoogle: 'Check hours on Google',
    errorLoad: 'Could not load the recommendations. Please try again later.',
    emptyCategory: 'No places in this section yet.',
    tagline: 'The places I recommend to my guests',
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
