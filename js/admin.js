import { searchPlaces, fetchPlaceDetails, parsePlaceDetails, fetchDistance,
  fetchPhotoBlob, translateItToEn, slugify, generateDescriptions } from './admin-api.mjs';

const $ = id => document.getElementById(id);
const status = msg => { $('status').textContent = msg; };
const state = { places: [], dirHandle: null, editingId: null, config: null };
window.adminState = state;

const getKey = () => localStorage.getItem('gmapsApiKey') ?? '';

// --- Impostazioni ---
$('api-key').value = getKey();
$('save-key').onclick = () => { localStorage.setItem('gmapsApiKey', $('api-key').value.trim()); status('Chiave salvata nel browser.'); };

const getGeminiKey = () => localStorage.getItem('geminiApiKey') ?? '';
$('gemini-key').value = getGeminiKey();
$('save-gemini-key').onclick = () => {
  localStorage.setItem('geminiApiKey', $('gemini-key').value.trim());
  status('Chiave Gemini salvata nel browser.');
};

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

$('ai-desc-btn').onclick = async () => {
  const aKey = getGeminiKey();
  if (!aKey) return status('Salva prima la chiave API Google Gemini nelle Impostazioni.');
  try {
    const p = collectForm();
    if (!p.name) return status('Serve almeno il nome del posto.');
    status('✨ L’IA sta scrivendo la descrizione…');
    const d = await generateDescriptions(p, aKey);
    $('f-desc-it').value = d.descriptionIt;
    $('f-desc-en').value = d.descriptionEn;
    status('Descrizioni generate (IT + EN): controlla e correggi se serve, poi salva.');
  } catch (e) { status(`Errore IA: ${e.message}`); }
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

// --- Foto: scarica fino a 5 immagini del posto (salta quelle già presenti) ---
const MAX_PHOTOS = 5;
async function syncPhotos(p, raw) {
  const key = getKey();
  const photos = (raw.photos ?? []).slice(0, MAX_PHOTOS);
  const urls = [];
  for (let i = 0; i < photos.length; i++) {
    const path = `img/places/${p.id}${i === 0 ? '' : '-' + (i + 1)}.jpg`;
    const already = (p.photoUrls ?? []).includes(path) || (i === 0 && p.photoUrl === path);
    if (!already) {
      const blob = await fetchPhotoBlob(photos[i].name, key);
      await writeProjectFile(path, blob);
    }
    urls.push(path);
  }
  if (urls.length) { p.photoUrls = urls; p.photoUrl = urls[0]; }
  return urls.length;
}

// --- Completamento dati Google di un posto ---
async function completePlace(p, rawDetails = null) {
  const key = getKey();
  const raw = rawDetails ?? await fetchPlaceDetails(p.placeId, key);
  const d = parsePlaceDetails(raw);
  Object.assign(p, { name: p.name || d.name, phone: d.phone, address: d.address,
    coords: d.coords, hours: d.hours });
  if (d.coords) p.distance = await fetchDistance(state.config.home, d.coords, key);
  await syncPhotos(p, raw);
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

// --- Batch: scarica più foto (fino a 5) per tutti i posti con placeId ---
$('more-photos').onclick = async () => {
  if (!state.dirHandle || !state.config) return status('Scegli cartella e carica places.json prima.');
  const targets = state.places.filter(p => p.placeId);
  let done = 0, errors = 0;
  for (const p of targets) {
    try {
      status(`🖼 (${done + errors + 1}/${targets.length}) ${p.name}…`);
      const raw = await fetchPlaceDetails(p.placeId, getKey());
      const n = await syncPhotos(p, raw);
      await persist();
      done++;
      console.log(p.id, `${n} foto`);
    } catch (e) { errors++; console.error(p.id, e); }
  }
  refreshList();
  status(`Foto aggiornate per ${done}/${targets.length} posti${errors ? ` — ${errors} errori (vedi console)` : ''}. Ricorda di pubblicare.`);
};
