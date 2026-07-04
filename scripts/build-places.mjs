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
