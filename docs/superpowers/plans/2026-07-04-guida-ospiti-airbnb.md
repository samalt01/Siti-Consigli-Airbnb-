# Guida Ospiti Airbnb — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sito statico mobile-first bilingue IT/EN con i consigli dell'host (4 categorie, stelle, distanze, pulsanti chiama/mappe/WhatsApp) + pannello admin locale che aggiunge posti via Google Place ID.

**Architecture:** Vanilla HTML/CSS/JS ES-modules, nessun framework e nessuna build. Il sito pubblico legge `config.json` + `data/places.json`. L'admin (solo locale, Chrome) chiama Places API (New), Routes API e MyMemory, e scrive file via File System Access API. Deploy su GitHub Pages via GitHub Actions escludendo l'admin.

**Tech Stack:** HTML5, CSS3, JavaScript ES2022 modules, Node 18+ (`node:test`) per i test, GitHub Actions/Pages.

## Global Constraints

- Coordinate appartamento: `42.310869, 14.441397` (da `config.json`, mai hardcoded altrove).
- WhatsApp host: `393665316952` (link `https://wa.me/…`).
- Nome sito default: `La Guida di Samuel` (da `config.json`).
- Lingue: `it` (default) e `en`; scelta persistita in `localStorage` chiave `lang`.
- Categorie: `food | places | kids | shopping`; tag solo per `places`: `beach | experience`.
- Rating: 1–5 step 0.5, `null` consentito (posto non ancora votato → in coda all'ordinamento, stelle nascoste).
- I posti con `draft: true` NON compaiono sul sito pubblico (salvo `?preview=1`).
- La chiave API Google vive SOLO in `localStorage` del browser dell'host (chiave `gmapsApiKey`); mai in file committati.
- `admin.html`, `docs/`, `scripts/`, `tests/` esclusi dal deploy pubblico.
- Test: `node --test tests/` senza dipendenze npm (nessun `package.json` necessario; usare `.mjs`).
- Nessuna libreria esterna runtime.

---

### Task 1: Scaffold + generazione `data/places.json` dal seed

**Files:**
- Create: `.gitignore`, `config.json`, `scripts/build-places.mjs`, `img/places/.gitkeep`
- Create (generato): `data/places.json`

**Interfaces:**
- Produces: `config.json` con `{siteName, whatsapp, home:{lat,lng}}`; `data/places.json` con `{places:[…]}` — ogni posto ha i campi del seed **più** `phone:null, address:null, coords:null, distance:null, photoUrl:null, hours:null` se mancanti. Lo script è idempotente: se `places.json` esiste, aggiunge solo i posti del seed con `id` nuovi (non sovrascrive dati completati).

- [ ] **Step 1: Crea `.gitignore` e `config.json`**

`.gitignore`:
```
.DS_Store
```

`config.json`:
```json
{
  "siteName": "La Guida di Samuel",
  "whatsapp": "393665316952",
  "home": { "lat": 42.310869, "lng": 14.441397 }
}
```

- [ ] **Step 2: Scrivi `scripts/build-places.mjs`**

```js
#!/usr/bin/env node
// Genera/aggiorna data/places.json a partire da data/seed-places.json.
// Idempotente: non tocca i posti già presenti (per id).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DEFAULTS = { phone: null, address: null, coords: null, distance: null, photoUrl: null, hours: null };
const seed = JSON.parse(readFileSync('data/seed-places.json', 'utf8')).places;
const existing = existsSync('data/places.json')
  ? JSON.parse(readFileSync('data/places.json', 'utf8')).places
  : [];
const known = new Set(existing.map(p => p.id));
const added = seed.filter(p => !known.has(p.id)).map(p => ({ ...DEFAULTS, ...p }));
const places = [...existing, ...added];
writeFileSync('data/places.json', JSON.stringify({ places }, null, 2) + '\n');
console.log(`places.json: ${places.length} posti (${added.length} aggiunti)`);
```

- [ ] **Step 3: Esegui e verifica**

Run: `node scripts/build-places.mjs && node scripts/build-places.mjs`
Expected: prima riga `places.json: 33 posti (33 aggiunti)`, seconda `places.json: 33 posti (0 aggiunti)` (idempotenza).

- [ ] **Step 4: Crea cartella foto e commit**

```bash
mkdir -p img/places && touch img/places/.gitkeep
git add .gitignore config.json scripts/build-places.mjs data/places.json img/places/.gitkeep
git commit -m "feat: scaffold, config e generazione places.json dal seed"
```

---

### Task 2: Modulo core (ordinamento, distanza, stelle, URL) con TDD

**Files:**
- Create: `js/core.mjs`
- Test: `tests/core.test.mjs`

**Interfaces:**
- Produces (usati da Task 5 e 6):
  - `visiblePlaces(places, {category, tag=null, includeDrafts=false})` → array filtrato e ordinato: rating desc, `null` in coda; a pari rating `distance.km` asc, `null` in coda.
  - `formatDistance(distance, lang)` → `"2,3 km · 6 min in auto"` (it) / `"2.3 km · 6 min by car"` (en); `''` se `distance` è `null`.
  - `starsHtml(rating)` → stringa HTML `<span class="stars"…>` con overlay a larghezza `rating/5*100`%; `''` se `rating` è `null`.
  - `descriptionFor(place, lang)` → `descriptionEn` se `lang==='en'` e non vuota, altrimenti `descriptionIt`.
  - `mapsUrl(place, home)` → Google Maps directions dall'appartamento; usa `destination_place_id` se presente, altrimenti destinazione = nome (o coords se presenti).
  - `waUrl(number, lang)` → `https://wa.me/<number>?text=<msg>` con messaggio precompilato per lingua.
  - `telUrl(phone)` → `tel:+39…` senza spazi; `null` se `phone` falsy.

- [ ] **Step 1: Scrivi i test (falliranno)**

`tests/core.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visiblePlaces, formatDistance, starsHtml, descriptionFor, mapsUrl, waUrl, telUrl } from '../js/core.mjs';

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
```

- [ ] **Step 2: Verifica che falliscano**

Run: `node --test tests/core.test.mjs`
Expected: FAIL (`Cannot find module '../js/core.mjs'`).

- [ ] **Step 3: Implementa `js/core.mjs`**

```js
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
  it: 'Ciao! Sono un ospite dell’appartamento e avrei una domanda.',
  en: 'Hi! I’m a guest at the apartment and I have a question.',
};

export function waUrl(number, lang) {
  return `https://wa.me/${number}?text=${encodeURIComponent(WA_MSG[lang] ?? WA_MSG.it)}`;
}

export function telUrl(phone) {
  return phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null;
}
```

- [ ] **Step 4: Verifica che passino**

Run: `node --test tests/core.test.mjs`
Expected: PASS (8 test).

- [ ] **Step 5: Commit**

```bash
git add js/core.mjs tests/core.test.mjs
git commit -m "feat: modulo core con ordinamento, distanza, stelle e URL (TDD)"
```

---

### Task 3: Modulo i18n con TDD

**Files:**
- Create: `js/i18n.mjs`
- Test: `tests/i18n.test.mjs`

**Interfaces:**
- Produces (usati da Task 5):
  - `STRINGS` — dizionario `{it:{…}, en:{…}}`.
  - `t(key, lang)` → stringa tradotta; fallback su `it`; ritorna `key` se assente ovunque.
  - `getLang(storage)` / `setLang(lang, storage)` — `storage` è un oggetto tipo `localStorage` (iniettato per testabilità); default `'it'`, accetta solo `'it'|'en'`.

- [ ] **Step 1: Scrivi i test (falliranno)**

`tests/i18n.test.mjs`:
```js
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
```

- [ ] **Step 2: Verifica che falliscano**

Run: `node --test tests/i18n.test.mjs`
Expected: FAIL (`Cannot find module '../js/i18n.mjs'`).

- [ ] **Step 3: Implementa `js/i18n.mjs`**

```js
export const STRINGS = {
  it: {
    food: 'Cibo', places: 'Places to go', kids: 'Per i più piccoli', shopping: 'Shopping',
    all: 'Tutti', beaches: 'Spiagge', experiences: 'Esperienze',
    call: 'Chiama', directions: 'Indicazioni', contactHost: 'Contatta il tuo host',
    back: 'Indietro', hours: 'Orari', address: 'Indirizzo',
    errorLoad: 'Impossibile caricare i consigli. Riprova più tardi.',
    emptyCategory: 'Nessun posto in questa sezione, per ora.',
    tagline: 'I posti che consiglio ai miei ospiti',
  },
  en: {
    food: 'Food', places: 'Places to go', kids: 'For the little ones', shopping: 'Shopping',
    all: 'All', beaches: 'Beaches', experiences: 'Experiences',
    call: 'Call', directions: 'Directions', contactHost: 'Contact your host',
    back: 'Back', hours: 'Hours', address: 'Address',
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
```

- [ ] **Step 4: Verifica che passino**

Run: `node --test tests/`
Expected: PASS (tutti i test di core + i18n).

- [ ] **Step 5: Commit**

```bash
git add js/i18n.mjs tests/i18n.test.mjs
git commit -m "feat: modulo i18n IT/EN con fallback (TDD)"
```

---

### Task 4: Shell HTML + CSS mobile-first del sito pubblico

**Files:**
- Create: `index.html`, `css/style.css`

**Interfaces:**
- Produces (usati da Task 5): elementi con id `#site-name`, `#tagline`, `#lang-it`, `#lang-en`, `#tabs`, `#subfilters`, `#cards`, `#detail`, `#wa-footer`. Il dettaglio è un overlay (`#detail`, nascosto con `hidden`).

- [ ] **Step 1: Scrivi `index.html`**

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>La Guida di Samuel</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header class="header">
    <div>
      <h1 id="site-name">…</h1>
      <p id="tagline" class="tagline"></p>
    </div>
    <div class="lang-switch" role="group" aria-label="Lingua / Language">
      <button id="lang-it" class="lang-btn" type="button">🇮🇹</button>
      <button id="lang-en" class="lang-btn" type="button">🇬🇧</button>
    </div>
  </header>

  <nav id="tabs" class="tabs" role="tablist"></nav>
  <div id="subfilters" class="subfilters" hidden></div>

  <main id="cards" class="cards" aria-live="polite"></main>

  <footer class="footer">
    <a id="wa-footer" class="btn btn-wa" href="#" target="_blank" rel="noopener">💬 <span></span></a>
  </footer>

  <section id="detail" class="detail" hidden></section>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Scrivi `css/style.css`**

```css
:root {
  --accent: #0e7c66; --accent-dark: #0a5c4c; --wa: #25d366;
  --bg: #f7f6f3; --card: #fff; --text: #1f2a2e; --muted: #6b7a80;
  --star: #f5a623; --radius: 14px;
  --shadow: 0 2px 10px rgba(0,0,0,.08);
}
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
  background: var(--bg); color: var(--text); padding-bottom: 90px; }

.header { display: flex; justify-content: space-between; align-items: center;
  padding: 16px; background: var(--accent); color: #fff; }
.header h1 { margin: 0; font-size: 1.25rem; }
.tagline { margin: 2px 0 0; font-size: .8rem; opacity: .85; }
.lang-btn { font-size: 1.3rem; background: none; border: 2px solid transparent;
  border-radius: 8px; padding: 2px 6px; cursor: pointer; }
.lang-btn.active { border-color: #fff; background: rgba(255,255,255,.15); }

.tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 12px; }
.tab { border: none; background: var(--card); border-radius: var(--radius);
  padding: 10px 4px; font-size: .78rem; cursor: pointer; box-shadow: var(--shadow);
  display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--text); }
.tab .emoji { font-size: 1.4rem; }
.tab.active { background: var(--accent); color: #fff; }

.subfilters { display: flex; gap: 8px; padding: 0 12px 8px; }
.chip { border: 1px solid var(--accent); background: none; color: var(--accent);
  border-radius: 999px; padding: 6px 14px; font-size: .8rem; cursor: pointer; }
.chip.active { background: var(--accent); color: #fff; }

.cards { display: grid; gap: 12px; padding: 12px; }
.card { background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow);
  overflow: hidden; cursor: pointer; display: grid; grid-template-columns: 110px 1fr; }
.card img, .card .noimg { width: 110px; height: 100%; min-height: 96px; object-fit: cover;
  background: #dfe7e5; display: flex; align-items: center; justify-content: center; font-size: 2rem; }
.card-body { padding: 10px 12px; }
.card-body h3 { margin: 0 0 4px; font-size: 1rem; }
.card .meta { color: var(--muted); font-size: .78rem; margin-top: 4px; }

.stars { position: relative; display: inline-block; color: #d7dcdb; font-size: .95rem;
  line-height: 1; letter-spacing: 2px; }
.stars-fill { position: absolute; top: 0; left: 0; overflow: hidden;
  white-space: nowrap; color: var(--star); }

.footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 12px 16px;
  background: linear-gradient(transparent, var(--bg) 40%); }
.btn { display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 13px; border-radius: var(--radius); font-weight: 600; text-decoration: none;
  border: none; font-size: 1rem; cursor: pointer; }
.btn-wa { background: var(--wa); color: #fff; box-shadow: var(--shadow); }
.btn-call { background: var(--accent); color: #fff; }
.btn-maps { background: var(--accent-dark); color: #fff; }

.detail { position: fixed; inset: 0; background: var(--bg); overflow-y: auto; z-index: 10; }
.detail .hero { width: 100%; height: 220px; object-fit: cover; background: #dfe7e5; }
.detail .content { padding: 16px; padding-bottom: 110px; }
.detail h2 { margin: 8px 0 4px; }
.detail .desc { line-height: 1.55; }
.detail .info { color: var(--muted); font-size: .85rem; white-space: pre-line; }
.detail .actions { display: grid; gap: 10px; margin: 16px 0; }
.back-btn { position: absolute; top: 12px; left: 12px; background: rgba(0,0,0,.55);
  color: #fff; border: none; border-radius: 999px; padding: 8px 14px; cursor: pointer; }

.msg { text-align: center; color: var(--muted); padding: 40px 20px; }

@media (min-width: 700px) {
  .cards { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); max-width: 1100px; margin: 0 auto; }
  .tabs { max-width: 1100px; margin: 0 auto; }
  .detail { max-width: 640px; left: 50%; transform: translateX(-50%);
    box-shadow: var(--shadow); }
}
```

- [ ] **Step 3: Verifica visiva della shell**

Run: `open index.html` (o server locale). La pagina mostra header verde, footer WhatsApp; niente contenuto (arriva col Task 5). Nessun errore in console **eccetto** l'eventuale 404/CORS di `app.js` non ancora esistente — accettabile in questo task.

- [ ] **Step 4: Commit**

```bash
git add index.html css/style.css
git commit -m "feat: shell HTML e CSS mobile-first del sito pubblico"
```

---

### Task 5: Rendering del sito pubblico (`js/app.js`)

**Files:**
- Create: `js/app.js`
- Modify: nessuno

**Interfaces:**
- Consumes: tutto da `js/core.mjs` e `js/i18n.mjs` (firme nei Task 2–3); DOM ids dal Task 4.
- Produces: sito funzionante; `?preview=1` mostra anche i draft (per anteprima host).

- [ ] **Step 1: Scrivi `js/app.js`**

```js
import { visiblePlaces, formatDistance, starsHtml, descriptionFor, mapsUrl, waUrl, telUrl } from './core.mjs';
import { t, getLang, setLang } from './i18n.mjs';

const CATEGORIES = [
  { id: 'food', emoji: '🍕' }, { id: 'places', emoji: '📍' },
  { id: 'kids', emoji: '👶' }, { id: 'shopping', emoji: '🛍️' },
];
const state = {
  lang: getLang(), category: 'food', tag: null,
  preview: new URLSearchParams(location.search).has('preview'),
  config: null, places: [],
};
const $ = id => document.getElementById(id);

async function loadData() {
  const [cfg, data] = await Promise.all([
    fetch('config.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch('data/places.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  ]);
  state.config = cfg;
  state.places = data.places;
}

function renderHeader() {
  $('site-name').textContent = state.config.siteName;
  $('tagline').textContent = t('tagline', state.lang);
  document.documentElement.lang = state.lang;
  $('lang-it').classList.toggle('active', state.lang === 'it');
  $('lang-en').classList.toggle('active', state.lang === 'en');
  const wa = $('wa-footer');
  wa.href = waUrl(state.config.whatsapp, state.lang);
  wa.querySelector('span').textContent = t('contactHost', state.lang);
}

function renderTabs() {
  $('tabs').innerHTML = CATEGORIES.map(c =>
    `<button class="tab ${c.id === state.category ? 'active' : ''}" role="tab" data-cat="${c.id}">
       <span class="emoji">${c.emoji}</span>${t(c.id, state.lang)}</button>`).join('');
  const sub = $('subfilters');
  if (state.category === 'places') {
    sub.hidden = false;
    sub.innerHTML = [
      ['', t('all', state.lang)], ['beach', `🏖️ ${t('beaches', state.lang)}`],
      ['experience', `⛰️ ${t('experiences', state.lang)}`],
    ].map(([v, label]) =>
      `<button class="chip ${(state.tag ?? '') === v ? 'active' : ''}" data-tag="${v}">${label}</button>`).join('');
  } else { sub.hidden = true; sub.innerHTML = ''; }
}

function renderCards() {
  const list = visiblePlaces(state.places,
    { category: state.category, tag: state.tag, includeDrafts: state.preview });
  $('cards').innerHTML = list.length ? list.map(p => `
    <article class="card" data-id="${p.id}">
      ${p.photoUrl ? `<img src="${p.photoUrl}" alt="" loading="lazy">` : `<div class="noimg">📷</div>`}
      <div class="card-body">
        <h3>${p.name}</h3>
        ${starsHtml(p.rating)}
        <div class="meta">${formatDistance(p.distance, state.lang)}</div>
      </div>
    </article>`).join('')
    : `<p class="msg">${t('emptyCategory', state.lang)}</p>`;
}

function renderDetail(place) {
  const d = $('detail');
  const call = telUrl(place.phone);
  const hours = place.hours ? Object.values(place.hours).join('\n') : '';
  d.innerHTML = `
    <button class="back-btn" id="back">← ${t('back', state.lang)}</button>
    ${place.photoUrl ? `<img class="hero" src="${place.photoUrl}" alt="">` : `<div class="hero"></div>`}
    <div class="content">
      <h2>${place.name}</h2>
      ${starsHtml(place.rating)}
      <p class="info">${formatDistance(place.distance, state.lang)}</p>
      <p class="desc">${descriptionFor(place, state.lang)}</p>
      ${place.address ? `<p class="info"><strong>${t('address', state.lang)}:</strong> ${place.address}</p>` : ''}
      ${hours ? `<p class="info"><strong>${t('hours', state.lang)}:</strong>\n${hours}</p>` : ''}
      <div class="actions">
        ${call ? `<a class="btn btn-call" href="${call}">📞 ${t('call', state.lang)}</a>` : ''}
        <a class="btn btn-maps" href="${mapsUrl(place, state.config.home)}" target="_blank" rel="noopener">🗺️ ${t('directions', state.lang)}</a>
        <a class="btn btn-wa" href="${waUrl(state.config.whatsapp, state.lang)}" target="_blank" rel="noopener">💬 ${t('contactHost', state.lang)}</a>
      </div>
    </div>`;
  d.hidden = false;
  d.querySelector('#back').onclick = () => { d.hidden = true; d.innerHTML = ''; };
}

function renderAll() { renderHeader(); renderTabs(); renderCards(); }

function bindEvents() {
  $('tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (b) { state.category = b.dataset.cat; state.tag = null; renderAll(); }
  });
  $('subfilters').addEventListener('click', e => {
    const b = e.target.closest('[data-tag]');
    if (b) { state.tag = b.dataset.tag || null; renderAll(); }
  });
  $('cards').addEventListener('click', e => {
    const card = e.target.closest('[data-id]');
    if (card) renderDetail(state.places.find(p => p.id === card.dataset.id));
  });
  $('lang-it').onclick = () => { state.lang = 'it'; setLang('it'); renderAll(); };
  $('lang-en').onclick = () => { state.lang = 'en'; setLang('en'); renderAll(); };
}

loadData().then(() => { bindEvents(); renderAll(); })
  .catch(() => { $('cards').innerHTML = `<p class="msg">${t('errorLoad', getLang())}</p>`; });
```

- [ ] **Step 2: Verifica manuale con server locale**

Run: `python3 -m http.server 8000` poi apri `http://localhost:8000/?preview=1` (i moduli ES richiedono un server, `open index.html` non basta).
Expected, in modalità preview: 4 tab funzionanti; in "Places to go" i chip Tutti/Spiagge/Esperienze; card con nome e descrizione; tap su card → dettaglio con pulsanti Indicazioni (link Maps con origin = coordinate casa) e WhatsApp; pulsante Chiama assente (telefoni non ancora recuperati); switch 🇬🇧 → tutte le etichette e descrizioni in inglese; ricarica pagina → lingua ricordata. Senza `?preview=1`: messaggio "Nessun posto…" (tutti draft — corretto).

- [ ] **Step 3: Esegui i test esistenti (regressione)**

Run: `node --test tests/`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat: rendering sito pubblico con tab, dettaglio, i18n e preview"
```

---

### Task 6: Admin — parsing API Google con TDD + UI ricerca/modifica

**Files:**
- Create: `js/admin-api.mjs`, `admin.html`, `js/admin.js`
- Test: `tests/admin-api.test.mjs`

**Interfaces:**
- Consumes: `core.mjs` (`starsHtml`), `data/places.json`.
- Produces (usati da Task 7):
  - `js/admin-api.mjs`: `parsePlaceDetails(apiJson)` → `{placeId, name, phone, address, coords, hours}`; `parseRoute(apiJson)` → `{km, minutes}` o `null`; `searchPlaces(query, key)`, `fetchPlaceDetails(placeId, key)`, `fetchDistance(home, coords, key)`, `translateItToEn(text)` (fetch async); `slugify(name)` → id kebab-case.
  - `admin.html` con form completo; `js/admin.js` con `window.adminState = { places, dirHandle }` e funzione `refreshList()`.

- [ ] **Step 1: Scrivi i test dei parser (falliranno)**

`tests/admin-api.test.mjs`:
```js
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
```

- [ ] **Step 2: Verifica che falliscano**

Run: `node --test tests/admin-api.test.mjs`
Expected: FAIL (`Cannot find module '../js/admin-api.mjs'`).

- [ ] **Step 3: Implementa `js/admin-api.mjs`**

```js
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
```

- [ ] **Step 4: Verifica che i test passino**

Run: `node --test tests/admin-api.test.mjs`
Expected: PASS (4 test).

- [ ] **Step 5: Scrivi `admin.html`**

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin — Guida Ospiti</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    body { padding: 16px 16px 40px; max-width: 760px; margin: 0 auto; }
    fieldset { border: 1px solid #ccc; border-radius: 10px; margin-bottom: 16px; }
    label { display: block; margin: 10px 0 4px; font-weight: 600; font-size: .85rem; }
    input[type=text], input[type=password], textarea, select {
      width: 100%; padding: 9px; border: 1px solid #bbb; border-radius: 8px; font: inherit; }
    textarea { min-height: 90px; }
    .row { display: flex; gap: 8px; align-items: end; }
    .row > * { flex: 1; }
    button { padding: 10px 14px; border: none; border-radius: 8px; background: var(--accent);
      color: #fff; font-weight: 600; cursor: pointer; }
    button.secondary { background: #666; }
    .place-row { display: flex; justify-content: space-between; align-items: center;
      padding: 8px; border-bottom: 1px solid #eee; gap: 8px; }
    .place-row .draft-badge { color: #b00; font-size: .75rem; }
    #status { position: fixed; bottom: 0; left: 0; right: 0; background: #1f2a2e;
      color: #fff; padding: 10px 16px; font-size: .85rem; min-height: 20px; }
    .rating-input { font-size: 1.6rem; }
  </style>
</head>
<body>
  <h1>Admin — Guida Ospiti</h1>

  <fieldset>
    <legend>Impostazioni</legend>
    <label>Chiave API Google (Places + Routes)</label>
    <div class="row">
      <input type="password" id="api-key" placeholder="AIza…">
      <button id="save-key" style="flex:0 0 auto">Salva chiave</button>
    </div>
    <div class="row" style="margin-top:10px">
      <button id="pick-dir">📁 Scegli cartella del progetto</button>
      <button id="load-places" class="secondary">↻ Carica places.json</button>
    </div>
  </fieldset>

  <fieldset>
    <legend>Aggiungi / cerca posto</legend>
    <div class="row">
      <input type="text" id="search-q" placeholder="Cerca per nome (es. 'Da Gino Vallevò') o incolla un Place ID">
      <button id="search-btn" style="flex:0 0 auto">Cerca</button>
    </div>
    <div id="search-results"></div>
  </fieldset>

  <fieldset id="edit-box" hidden>
    <legend id="edit-title">Modifica posto</legend>
    <label>Nome</label><input type="text" id="f-name">
    <label>Place ID</label><input type="text" id="f-placeid">
    <div class="row">
      <div><label>Categoria</label>
        <select id="f-category">
          <option value="food">🍕 Cibo</option><option value="places">📍 Places to go</option>
          <option value="kids">👶 Più piccoli</option><option value="shopping">🛍️ Shopping</option>
        </select></div>
      <div><label>Tag (solo Places)</label>
        <select id="f-tag"><option value="">—</option>
          <option value="beach">🏖️ Spiaggia</option><option value="experience">⛰️ Esperienza</option>
        </select></div>
    </div>
    <label>Voto: <span id="f-rating-label">—</span></label>
    <input type="range" id="f-rating" min="0" max="5" step="0.5" value="0" class="rating-input">
    <label>Descrizione (italiano)</label>
    <textarea id="f-desc-it"></textarea>
    <div class="row"><button id="translate-btn" class="secondary">Traduci in EN →</button></div>
    <label>Description (english)</label>
    <textarea id="f-desc-en"></textarea>
    <div class="row" style="margin-top:12px">
      <button id="fetch-google">⬇️ Recupera dati Google (telefono, foto, distanza)</button>
      <button id="save-place">💾 Salva posto</button>
      <button id="delete-place" class="secondary">🗑 Elimina</button>
    </div>
  </fieldset>

  <fieldset>
    <legend>Posti (<span id="count">0</span>) — <button id="complete-all" class="secondary">⚡️ Completa dati di tutte le bozze</button></legend>
    <div id="places-list"></div>
  </fieldset>

  <div id="status">Pronto. 1) Salva la chiave · 2) Scegli la cartella del progetto · 3) Carica places.json</div>
  <script type="module" src="js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 6: Scrivi `js/admin.js` (ricerca, form, lista; salvataggio file nel Task 7)**

```js
import { searchPlaces, fetchPlaceDetails, parsePlaceDetails, fetchDistance,
  fetchPhotoBlob, translateItToEn, slugify } from './admin-api.mjs';

const $ = id => document.getElementById(id);
const status = msg => { $('status').textContent = msg; };
const state = { places: [], dirHandle: null, editingId: null, config: null };
window.adminState = state;

const getKey = () => localStorage.getItem('gmapsApiKey') ?? '';

// --- Impostazioni ---
$('api-key').value = getKey();
$('save-key').onclick = () => { localStorage.setItem('gmapsApiKey', $('api-key').value.trim()); status('Chiave salvata nel browser.'); };

// --- Ricerca ---
$('search-btn').onclick = async () => {
  const q = $('search-q').value.trim();
  if (!q) return;
  try {
    if (/^ChIJ[\w-]+$/.test(q)) return startEditFromPlaceId(q);
    status('Cerco…');
    const results = await searchPlaces(q, getKey());
    $('search-results').innerHTML = results.slice(0, 5).map(p =>
      `<div class="place-row"><span>${p.displayName.text}<br><small>${p.formattedAddress ?? ''}</small></span>
       <button data-pid="${p.id}">Usa</button></div>`).join('') || '<p>Nessun risultato.</p>';
    status('Scegli un risultato.');
  } catch (e) { status(`Errore ricerca: ${e.message}`); }
};
$('search-results').addEventListener('click', e => {
  const b = e.target.closest('[data-pid]');
  if (b) startEditFromPlaceId(b.dataset.pid);
});

async function startEditFromPlaceId(placeId) {
  try {
    status('Recupero dettagli…');
    const raw = await fetchPlaceDetails(placeId, getKey());
    const d = parsePlaceDetails(raw);
    openEditor({
      id: slugify(d.name), placeId: d.placeId, category: 'food', tag: null, name: d.name,
      rating: null, descriptionIt: '', descriptionEn: '', draft: true,
      phone: d.phone, address: d.address, coords: d.coords, distance: null,
      photoUrl: null, hours: d.hours, _photos: raw.photos ?? [],
    });
    status('Dettagli caricati. Compila descrizione e voto, poi "Recupera dati Google" e salva.');
  } catch (e) { status(`Errore dettagli: ${e.message}`); }
}

// --- Editor ---
function openEditor(place) {
  state.editingId = place.id;
  state._editing = place;
  $('edit-box').hidden = false;
  $('edit-title').textContent = place.name || 'Nuovo posto';
  $('f-name').value = place.name;
  $('f-placeid').value = place.placeId ?? '';
  $('f-category').value = place.category;
  $('f-tag').value = place.tag ?? '';
  $('f-rating').value = place.rating ?? 0;
  $('f-rating-label').textContent = place.rating ? `${place.rating} ⭐` : '—';
  $('f-desc-it').value = place.descriptionIt;
  $('f-desc-en').value = place.descriptionEn;
  $('edit-box').scrollIntoView({ behavior: 'smooth' });
}

$('f-rating').oninput = () => {
  const v = parseFloat($('f-rating').value);
  $('f-rating-label').textContent = v ? `${v} ⭐` : '—';
};

$('translate-btn').onclick = async () => {
  try {
    status('Traduco…');
    $('f-desc-en').value = await translateItToEn($('f-desc-it').value);
    status($('f-desc-en').value ? 'Tradotto: controlla e correggi se serve.' : 'Traduzione non riuscita: scrivi l’inglese a mano.');
  } catch (e) { status(`Errore traduzione: ${e.message}`); }
};

function collectForm() {
  const p = state._editing;
  const rating = parseFloat($('f-rating').value) || null;
  return { ...p, name: $('f-name').value.trim(), placeId: $('f-placeid').value.trim() || null,
    category: $('f-category').value, tag: $('f-tag').value || null, rating,
    descriptionIt: $('f-desc-it').value.trim(), descriptionEn: $('f-desc-en').value.trim() };
}

// --- Lista ---
export function refreshList() {
  $('count').textContent = state.places.length;
  $('places-list').innerHTML = state.places.map(p =>
    `<div class="place-row"><span>${p.name} <small>(${p.category}${p.tag ? '/' + p.tag : ''})</small>
       ${p.draft ? '<span class="draft-badge">BOZZA</span>' : ''} ${p.rating ? p.rating + '⭐' : ''}</span>
     <button data-edit="${p.id}">Modifica</button></div>`).join('');
}
$('places-list').addEventListener('click', e => {
  const b = e.target.closest('[data-edit]');
  if (b) openEditor({ ...state.places.find(p => p.id === b.dataset.edit) });
});

window.adminHelpers = { collectForm, openEditor, refreshList, status, getKey,
  fetchDistance, fetchPhotoBlob, fetchPlaceDetails, parsePlaceDetails };
```

- [ ] **Step 7: Verifica manuale (senza chiave API)**

Run: `python3 -m http.server 8000` → apri `http://localhost:8000/admin.html` in Chrome.
Expected: form visibile, salvataggio chiave in localStorage funziona (ricarica e ritrovi la chiave), slider voto aggiorna l'etichetta a step 0.5, "Traduci in EN" traduce un testo di prova via MyMemory (funziona senza chiave Google). La ricerca senza chiave mostra "Errore ricerca: API 4xx…" nello status — comportamento corretto.

- [ ] **Step 8: Regressione + commit**

Run: `node --test tests/`
Expected: PASS.

```bash
git add js/admin-api.mjs js/admin.js admin.html tests/admin-api.test.mjs
git commit -m "feat: admin con ricerca posti, editor, traduzione e parser testati"
```

---

### Task 7: Admin — cartella progetto, salvataggio, foto e "Completa dati"

**Files:**
- Modify: `js/admin.js` (aggiungere in coda; nessuna modifica alle funzioni esistenti)

**Interfaces:**
- Consumes: `window.adminHelpers` e `state` dal Task 6; `fetchDistance/fetchPhotoBlob` da `admin-api.mjs`; `config.json` (coordinate casa).
- Produces: scrittura reale di `data/places.json` e `img/places/<id>.jpg` nella cartella scelta (File System Access API, Chrome).

- [ ] **Step 1: Aggiungi a `js/admin.js` la gestione file e i pulsanti restanti**

```js
// --- File System Access ---
$('pick-dir').onclick = async () => {
  try {
    state.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    status(`Cartella scelta: ${state.dirHandle.name}. Ora "Carica places.json".`);
  } catch { /* annullato */ }
};

async function readProjectFile(path) {
  let dir = state.dirHandle;
  const parts = path.split('/');
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
  const fh = await dir.getFileHandle(parts.at(-1));
  return (await fh.getFile()).text();
}

async function writeProjectFile(path, content) {
  let dir = state.dirHandle;
  const parts = path.split('/');
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
  const fh = await dir.getFileHandle(parts.at(-1), { create: true });
  const w = await fh.createWritable();
  await w.write(content);
  await w.close();
}

$('load-places').onclick = async () => {
  if (!state.dirHandle) return status('Prima scegli la cartella del progetto.');
  try {
    state.places = JSON.parse(await readProjectFile('data/places.json')).places;
    state.config = JSON.parse(await readProjectFile('config.json'));
    refreshList();
    status(`Caricati ${state.places.length} posti.`);
  } catch (e) { status(`Errore lettura: ${e.message}`); }
};

async function persist() {
  await writeProjectFile('data/places.json', JSON.stringify({ places: state.places }, null, 2) + '\n');
}

// --- Completamento dati Google di un posto ---
async function completePlace(p, rawDetails = null) {
  const key = getKey();
  const raw = rawDetails ?? await fetchPlaceDetails(p.placeId, key);
  const d = parsePlaceDetails(raw);
  Object.assign(p, { name: p.name || d.name, phone: d.phone, address: d.address,
    coords: d.coords, hours: d.hours });
  if (d.coords) p.distance = await fetchDistance(state.config.home, d.coords, key);
  const photo = (raw.photos ?? [])[0];
  if (photo && !p.photoUrl) {
    const blob = await fetchPhotoBlob(photo.name, key);
    await writeProjectFile(`img/places/${p.id}.jpg`, blob);
    p.photoUrl = `img/places/${p.id}.jpg`;
  }
  p.draft = !(p.descriptionIt && p.coords);
  return p;
}

// --- Pulsanti editor ---
$('fetch-google').onclick = async () => {
  if (!state.dirHandle || !state.config) return status('Scegli cartella e carica places.json prima.');
  try {
    const p = collectForm();
    if (!p.placeId) return status('Serve un Place ID per recuperare i dati.');
    status('Recupero dati Google…');
    await completePlace(p);
    state._editing = p;
    status(`Fatto: ${p.phone ?? 'nessun telefono'} · ${p.distance ? p.distance.km + ' km / ' + p.distance.minutes + ' min' : 'distanza n/d'} · ${p.photoUrl ? 'foto ok' : 'nessuna foto'}. Ora salva.`);
  } catch (e) { status(`Errore: ${e.message}`); }
};

$('save-place').onclick = async () => {
  if (!state.dirHandle) return status('Scegli la cartella del progetto prima di salvare.');
  const p = collectForm();
  delete p._photos;
  const i = state.places.findIndex(x => x.id === p.id);
  if (i >= 0) state.places[i] = p; else state.places.push(p);
  await persist();
  refreshList();
  $('edit-box').hidden = true;
  status(`Salvato "${p.name}".`);
};

$('delete-place').onclick = async () => {
  if (!confirm('Eliminare questo posto?')) return;
  state.places = state.places.filter(x => x.id !== state.editingId);
  await persist();
  refreshList();
  $('edit-box').hidden = true;
  status('Eliminato.');
};

// --- Batch: completa tutte le bozze con placeId ---
$('complete-all').onclick = async () => {
  if (!state.dirHandle || !state.config) return status('Scegli cartella e carica places.json prima.');
  const drafts = state.places.filter(p => p.draft && p.placeId);
  let done = 0, errors = 0;
  for (const p of drafts) {
    try {
      status(`(${done + errors + 1}/${drafts.length}) ${p.name}…`);
      await completePlace(p);
      await persist();
      done++;
    } catch (e) { errors++; console.error(p.id, e); }
  }
  refreshList();
  status(`Completati ${done}/${drafts.length}${errors ? ` — ${errors} errori (vedi console)` : ''}.`);
};
```

- [ ] **Step 2: Verifica manuale del flusso file (senza chiave API)**

In Chrome su `http://localhost:8000/admin.html`: "Scegli cartella del progetto" → seleziona `Sito Airbnb Consigli` → "Carica places.json" → lista mostra 33 posti con badge BOZZA. Apri un posto, cambia il voto a 4.5, salva → `git diff data/places.json` mostra solo il rating cambiato. Ripristina con `git checkout data/places.json`.

- [ ] **Step 3: Verifica manuale con chiave API (richiede l'host, può essere rimandata)**

Con la chiave salvata: aprire una bozza → "Recupera dati Google" → status mostra telefono/distanza/foto; "Salva" → `img/places/<id>.jpg` creato e `places.json` completato. "⚡️ Completa dati" processa tutte le bozze. Documentare l'esito nel messaggio di commit.

- [ ] **Step 4: Regressione + commit**

Run: `node --test tests/`
Expected: PASS.

```bash
git add js/admin.js
git commit -m "feat: admin salva places.json e foto via File System Access, batch completa dati"
```

---

### Task 8: Deploy GitHub Pages + script di pubblicazione + README

**Files:**
- Create: `.github/workflows/deploy.yml`, `pubblica.command`, `README.md`

**Interfaces:**
- Consumes: repo git esistente; GitHub remote (da creare dall'host, istruzioni nel README).
- Produces: deploy automatico su push a `main` che esclude `admin.html`, `docs/`, `scripts/`, `tests/`, `posti consigliati.rtf`.

- [ ] **Step 1: Scrivi `.github/workflows/deploy.yml`**

```yaml
name: Deploy su GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - name: Prepara sito pubblico (esclude admin e file di lavoro)
        run: |
          mkdir _site
          rsync -a --exclude admin.html --exclude 'js/admin*' --exclude docs \
            --exclude scripts --exclude tests --exclude .github \
            --exclude '*.rtf' --exclude _site ./ _site/
      - uses: actions/upload-pages-artifact@v3
        with: { path: _site }
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Scrivi `pubblica.command` e rendilo eseguibile**

```bash
#!/bin/zsh
# Doppio click per pubblicare le modifiche online.
cd "$(dirname "$0")"
git add -A
git commit -m "Aggiornamento posti $(date '+%Y-%m-%d %H:%M')" || echo "Niente da pubblicare."
git push && echo "✅ Pubblicato! Il sito si aggiorna in 1-2 minuti." || echo "❌ Errore: controlla la connessione o il remote."
read -k 1 "?Premi un tasto per chiudere…"
```

Run: `chmod +x pubblica.command`

- [ ] **Step 3: Scrivi `README.md`**

```markdown
# La Guida di Samuel — Guida per gli ospiti

Sito statico bilingue (IT/EN) con i posti consigliati agli ospiti, gestito
tramite pannello admin locale. Spec: `docs/superpowers/specs/`.

## Uso quotidiano (host)

1. Apri `admin.html` in **Chrome** con un server locale:
   `python3 -m http.server 8000` → http://localhost:8000/admin.html
2. La prima volta: incolla la chiave API e salva; scegli la cartella del
   progetto; carica `places.json`.
3. Aggiungi/modifica posti (ricerca per nome o Place ID, voto, descrizione).
4. Doppio click su `pubblica.command` per mettere online le modifiche.

## Anteprima locale del sito

http://localhost:8000/ (aggiungi `?preview=1` per vedere anche le bozze).

## Test

`node --test tests/`

## Prima configurazione (una tantum)

1. **Chiave API Google**: su console.cloud.google.com crea un progetto,
   abilita **Places API (New)** e **Routes API**, crea una API key.
   La chiave resta nel browser (localStorage), mai nel repository.
2. **GitHub**: crea un repo, poi
   `git remote add origin <url> && git push -u origin main`.
3. **Pages**: Settings → Pages → Source: **GitHub Actions**.
```

- [ ] **Step 4: Verifica e commit**

Run: `zsh -n pubblica.command && node --test tests/`
Expected: nessun errore di sintassi; test PASS.

```bash
git add .github/workflows/deploy.yml pubblica.command README.md
git commit -m "feat: deploy GitHub Pages (senza admin), script pubblica e README"
```

---

## Note per l'esecutore

- Verifiche manuali browser: usare sempre `python3 -m http.server 8000` (i moduli ES non funzionano da `file://`).
- Il Task 7 Step 3 richiede la chiave API dell'host: se non disponibile, completare il task con lo Step 2 e segnalarlo nel riepilogo finale.
- Non modificare `data/seed-places.json`: è la fonte del precaricamento; `places.json` è il file vivo.
```
