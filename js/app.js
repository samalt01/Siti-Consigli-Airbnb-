import { visiblePlaces, formatDistance, starsHtml, descriptionFor, mapsUrl, waUrl, telUrl, photosOf } from './core.mjs';
import { t, getLang, setLang } from './i18n.mjs';
import { fetchWeather, weatherIcon, weatherLabel } from './weather.mjs';

const CATEGORIES = [
  { id: 'food', emoji: '🍕' }, { id: 'places', emoji: '📍' },
  { id: 'kids', emoji: '👶' }, { id: 'shopping', emoji: '🛍️' },
];
const state = {
  lang: getLang(), category: 'food', tag: null,
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

function renderCards() {
  const list = visiblePlaces(state.places,
    { category: state.category, tag: state.tag, includeDrafts: state.preview });
  $('cards').innerHTML = list.length ? list.map((p, i) => `
    <article class="card" data-id="${p.id}" style="--i:${i}">
      ${p.photoUrl ? `<img src="${p.photoUrl}" alt="" loading="lazy">` : `<div class="noimg">📷</div>`}
      <div class="card-body">
        <h3>${p.name}</h3>
        ${starsHtml(p.rating)}
        <div class="meta">${formatDistance(p.distance, state.lang)}</div>
      </div>
    </article>`).join('')
    : `<p class="msg">${t('emptyCategory', state.lang)}</p>`;
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
      ${heroHtml(place)}
      <div class="content">
        <h2>${place.name}</h2>
        ${starsHtml(place.rating)}
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
  // tocco sullo sfondo (fuori dalla scheda) → chiude
  d.onclick = e => { if (e.target === d) closeDetail(); };
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
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('detail').hidden) closeDetail();
  });
}

loadData().then(() => { bindEvents(); renderAll(); loadWeather(); })
  .catch(() => { $('cards').innerHTML = `<p class="msg">${t('errorLoad', getLang())}</p>`; });
