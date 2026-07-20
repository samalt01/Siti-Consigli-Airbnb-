// Preferiti dell'ospite, salvati nel browser (localStorage).

export function getFavorites(storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem('favorites') || '[]'); } catch { return []; }
}

export function isFavorite(id, favs) {
  return favs.includes(id);
}

export function toggleFavorite(id, storage = globalThis.localStorage) {
  const favs = getFavorites(storage);
  const next = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
  storage.setItem('favorites', JSON.stringify(next));
  return next;
}
