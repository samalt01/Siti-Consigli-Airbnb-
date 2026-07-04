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
