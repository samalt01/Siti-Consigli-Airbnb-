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
