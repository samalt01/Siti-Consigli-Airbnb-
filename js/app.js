import { visiblePlaces, formatDistance, starsHtml, descriptionFor, mapsUrl, waUrl, telUrl, photosOf, isOpenNow } from './core.mjs?v=3';
import { t, getLang, setLang } from './i18n.mjs?v=3';
import { fetchWeather, weatherIcon, weatherLabel } from './weather.mjs?v=3';
import { getFavorites, isFavorite, toggleFavorite } from './favorites.mjs?v=3';

const CATEGORIES = [
  { id: 'food', emoji: '🍕' }, { id: 'places', emoji: '📍' },
  { id: 'kids', emoji: '👶' }, { id: 'shopping', emoji: '🛍️' },
];
const CAT_EMOJI = Object.fromEntries(CATEGORIES.map(c => [c.id, c.emoji]));
const SORTS = [
  { id: 'rating', icon: '⭐', label: 'sortRating' },
  { id: 'distance', icon: '📍', label: 'sortDistance' },
];
const state = {
  lang: getLang(), category: 'food', tag: null, sort: 'rating',
  favOnly: false, view: 'list', favs: getFavorites(), map: null, markers: null,
  preview: new URLSearchParams(location.search).has('preview'),
  config: null, places: [], weather: null,
};
const $ = id => document.getElementById(id);

async function loadData() {
  const [cfg, data] = await Promise.all([
    fetch('config.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch('data/places.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
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
  renderWeatherChip();
}

function renderWeatherChip() {
  const el = $('weather');
  if (!state.weather) { el.hidden = true; return; }
  const { temp, code } = state.weather;
  el.textContent = `${weatherIcon(code)} ${temp}° · ${weatherLabel(code, state.lang)}`;
  const q = encodeURIComponent(`meteo ${state.config.area ?? ''}`.trim());
  el.href = `https://www.google.com/search?q=${q}`;
  el.hidden = false;
}

async function loadWeather() {
  try {
    state.weather = await fetchWeather(state.config.home);
    renderWeatherChip();
  } catch { /* meteo non disponibile: chip resta nascosto */ }
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

function renderSort() {
  $('sort').innerHTML = `<span class="sort-label">${t('sortBy', state.lang)}</span>` +
    SORTS.map(s =>
      `<button class="chip ${s.id === state.sort ? 'active' : ''}" data-sort="${s.id}">${s.icon} ${t(s.label, state.lang)}</button>`).join('') +
    `<button class="chip fav-chip ${state.favOnly ? 'active' : ''}" data-favonly type="button">❤️ ${t('favorites', state.lang)}</button>`;
}

function renderViewToggle() {
  $('view-toggle').textContent = state.view === 'list'
    ? `🗺️ ${t('mapView', state.lang)}` : `☰ ${t('listView', state.lang)}`;
}

// Lista filtrata corrente (categoria + tag + preferiti), condivisa da schede e mappa.
function currentList() {
  const list = visiblePlaces(state.places,
    { category: state.category, tag: state.tag, includeDrafts: state.preview, sort: state.sort });
  return state.favOnly ? list.filter(p => isFavorite(p.id, state.favs)) : list;
}

function badgeHtml(place) {
  const open = isOpenNow(place);
  if (open === null) return '';
  return `<span class="badge ${open ? 'open' : 'closed'}">${open ? '🟢 ' + t('openNow', state.lang) : '🔴 ' + t('closedNow', state.lang)}</span>`;
}

function heartHtml(place, extra = '') {
  const fav = isFavorite(place.id, state.favs);
  return `<button class="heart ${extra} ${fav ? 'active' : ''}" data-fav="${place.id}" type="button" aria-label="Preferiti" aria-pressed="${fav}">${fav ? '❤️' : '🤍'}</button>`;
}

function renderCards() {
  const list = currentList();
  $('cards').innerHTML = list.length ? list.map((p, i) => `
    <article class="card" data-id="${p.id}" style="--i:${i}">
      ${heartHtml(p)}
      ${p.photoUrl ? `<img src="${p.photoUrl}" alt="" loading="lazy">` : `<div class="noimg">📷</div>`}
      <div class="card-body">
        <h3>${p.name}</h3>
        ${starsHtml(p.rating)}
        <div class="meta">${formatDistance(p.distance, state.lang)}</div>
        ${badgeHtml(p)}
      </div>
    </article>`).join('')
    : `<p class="msg">${t(state.favOnly ? 'noFavorites' : 'emptyCategory', state.lang)}</p>`;
}

function updateHearts(id) {
  const fav = isFavorite(id, state.favs);
  document.querySelectorAll(`.heart[data-fav="${id}"]`).forEach(b => {
    b.classList.toggle('active', fav);
    b.setAttribute('aria-pressed', String(fav));
    b.textContent = fav ? '❤️' : '🤍';
  });
}

function toggleFav(id) {
  state.favs = toggleFavorite(id);
  updateHearts(id);
  if (state.favOnly && state.view === 'list') renderCards();
  if (state.view === 'map') renderMarkers();
}

// --- Vista mappa (Leaflet + OpenStreetMap) ---
function ensureMap() {
  if (state.map || !window.L) return;
  const home = state.config.home;
  state.map = L.map('map', { scrollWheelZoom: true }).setView([home.lat, home.lng], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap',
  }).addTo(state.map);
  L.marker([home.lat, home.lng]).addTo(state.map).bindPopup(`🏠 ${t('apartment', state.lang)}`);
  state.markers = L.layerGroup().addTo(state.map);
}

function renderMarkers() {
  if (!state.map || !state.markers) return;
  state.markers.clearLayers();
  const home = state.config.home;
  const bounds = [[home.lat, home.lng]];
  currentList().filter(p => p.coords).forEach(p => {
    const stars = p.rating ? '★'.repeat(Math.round(p.rating)) + (p.rating % 1 ? '½' : '') : '';
    const m = L.marker([p.coords.lat, p.coords.lng]).bindPopup(
      `<b>${CAT_EMOJI[p.category] ?? ''} ${p.name}</b><br>` +
      `<span style="color:#f5a623">${stars}</span> ${p.rating ?? ''}<br>` +
      `<a href="${mapsUrl(p, home)}" target="_blank" rel="noopener">🗺️ ${t('directions', state.lang)}</a> · ` +
      `<a href="#" data-detail="${p.id}">${t('details', state.lang)}</a>`);
    state.markers.addLayer(m);
    bounds.push([p.coords.lat, p.coords.lng]);
  });
  if (bounds.length > 1) state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  setTimeout(() => state.map.invalidateSize(), 60);
}

function setView(view) {
  state.view = view;
  $('cards').hidden = view !== 'list';
  $('map').hidden = view !== 'map';
  renderViewToggle();
  if (view === 'map') { ensureMap(); renderMarkers(); }
}

// Orari: riga di oggi in evidenza, settimana ripiegata, link a Google per il dato fresco.
function hoursHtml(place) {
  if (!place.hours) return '';
  const week = Object.values(place.hours);
  const todayIdx = (new Date().getDay() + 6) % 7; // hours[0] = lunedì
  const today = week[todayIdx] ?? '';
  const gUrl = place.placeId
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.placeId}`
    : null;
  return `
    <p class="info hours-today">🕐 ${t('today', state.lang)}: ${today.replace(/^[^:]+:\s*/, '')}</p>
    <details>
      <summary>${t('hours', state.lang)}</summary>
      <p class="info">${week.join('\n')}${gUrl ? `\n<a href="${gUrl}" target="_blank" rel="noopener">${t('checkOnGoogle', state.lang)} ↗</a>` : ''}</p>
    </details>`;
}

function closeDetail() {
  const d = $('detail');
  d.hidden = true;
  d.innerHTML = '';
}

// Foto della scheda: singola o carosello swipabile con pallini.
function heroHtml(place) {
  const photos = photosOf(place);
  if (!photos.length) return '<div class="hero"></div>';
  if (photos.length === 1) return `<img class="hero" src="${photos[0]}" alt="">`;
  return `
    <div class="carousel">
      <div class="carousel-track">
        ${photos.map(u => `<img src="${u}" alt="" loading="lazy">`).join('')}
      </div>
      <div class="carousel-dots">
        ${photos.map((_, i) => `<span class="dot${i === 0 ? ' active' : ''}"></span>`).join('')}
      </div>
    </div>`;
}

function bindCarousel(root) {
  const track = root.querySelector('.carousel-track');
  if (!track) return;
  const dots = [...root.querySelectorAll('.carousel-dots .dot')];
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    dots.forEach((d, j) => d.classList.toggle('active', j === i));
  }, { passive: true });
}

function renderDetail(place) {
  const d = $('detail');
  const call = telUrl(place.phone);
  d.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${place.name}">
      <div class="sheet-handle"></div>
      <button class="back-btn" id="back" aria-label="${t('back', state.lang)}">✕</button>
      ${heartHtml(place, 'heart-detail')}
      ${heroHtml(place)}
      <div class="content">
        <h2>${place.name}</h2>
        ${starsHtml(place.rating)} ${badgeHtml(place)}
        <p class="info">${formatDistance(place.distance, state.lang)}</p>
        <p class="desc">${descriptionFor(place, state.lang)}</p>
        ${place.address ? `<p class="info">📍 ${place.address}</p>` : ''}
        ${hoursHtml(place)}
        <div class="actions">
          ${call ? `<a class="btn btn-call" href="${call}">📞 ${t('call', state.lang)}</a>` : ''}
          <a class="btn btn-maps" href="${mapsUrl(place, state.config.home)}" target="_blank" rel="noopener">🗺️ ${t('directions', state.lang)}</a>
          <a class="btn btn-wa" href="${waUrl(state.config.whatsapp, state.lang)}" target="_blank" rel="noopener">💬 ${t('contactHost', state.lang)}</a>
        </div>
      </div>
    </div>`;
  d.hidden = false;
  d.querySelector('#back').onclick = closeDetail;
  bindCarousel(d);
  // tocco sullo sfondo (fuori dalla scheda) → chiude; cuore → preferito
  d.onclick = e => {
    const h = e.target.closest('[data-fav]');
    if (h) { e.stopPropagation(); toggleFav(h.dataset.fav); return; }
    if (e.target === d) closeDetail();
  };
}

function renderAll() {
  renderHeader(); renderTabs(); renderSort(); renderViewToggle(); renderCards();
  if (state.view === 'map') renderMarkers();
}

function bindEvents() {
  $('tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (b) { state.category = b.dataset.cat; state.tag = null; renderAll(); }
  });
  $('subfilters').addEventListener('click', e => {
    const b = e.target.closest('[data-tag]');
    if (b) { state.tag = b.dataset.tag || null; renderAll(); }
  });
  $('sort').addEventListener('click', e => {
    const s = e.target.closest('[data-sort]');
    if (s) { state.sort = s.dataset.sort; renderSort(); renderCards(); if (state.view === 'map') renderMarkers(); return; }
    const f = e.target.closest('[data-favonly]');
    if (f) { state.favOnly = !state.favOnly; renderSort(); renderCards(); if (state.view === 'map') renderMarkers(); }
  });
  $('view-toggle').onclick = () => setView(state.view === 'list' ? 'map' : 'list');
  $('cards').addEventListener('click', e => {
    const h = e.target.closest('[data-fav]');
    if (h) { e.stopPropagation(); toggleFav(h.dataset.fav); return; }
    const card = e.target.closest('[data-id]');
    if (card) renderDetail(state.places.find(p => p.id === card.dataset.id));
  });
  // link "Dettagli" nei popup della mappa
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-detail]');
    if (d) { e.preventDefault(); const p = state.places.find(x => x.id === d.dataset.detail); if (p) renderDetail(p); }
  });
  $('lang-it').onclick = () => { state.lang = 'it'; setLang('it'); renderAll(); };
  $('lang-en').onclick = () => { state.lang = 'en'; setLang('en'); renderAll(); };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('detail').hidden) closeDetail();
  });
}

loadData().then(() => { bindEvents(); renderAll(); loadWeather(); })
  .catch(() => { $('cards').innerHTML = `<p class="msg">${t('errorLoad', getLang())}</p>`; });
