# Guida Ospiti Airbnb — Design Spec

**Data:** 2026-07-04
**Stato:** approvata dal proprietario

## Obiettivo

Sito web mobile-first, bilingue IT/EN, con i consigli dell'host per gli ospiti
dell'appartamento (coordinate: **42.310869, 14.441397** — Ortona/costa dei
trabocchi). L'host aggiunge i posti tramite Google Place ID da un pannello
admin locale; gli ospiti consultano un sito statico veloce e gratuito.

## Architettura

**Sito statico + admin locale.** Nessun backend, nessun database.

```
Sito Airbnb Consigli/
├── index.html          → sito pubblico (ospiti)
├── admin.html          → pannello admin (solo locale, escluso dal deploy)
├── data/places.json    → posti: dati Google + voto + distanza + descrizioni
├── config.json         → nome sito, WhatsApp, coordinate casa
├── css/ js/ img/       → asset
└── docs/               → questa spec e i piani
```

- La **chiave API Google** (Places + Distance Matrix) è usata solo
  dall'admin in locale; non viene mai pubblicata (salvata in
  `localStorage` del browser dell'host, mai in file committati).
- **Deploy:** GitHub Pages. Script cliccabile `pubblica.command` che fa
  commit + push di `places.json` e degli asset. `admin.html` e la chiave
  non finiscono online (esclusione via `.nojekyll`/struttura o deploy da
  cartella dedicata — dettaglio nel piano di implementazione).

## Pannello Admin (`admin.html`, solo locale)

1. **Aggiunta posto:** incolla Place ID *oppure* cerca per nome
   (Places Text Search) → recupera nome, foto, telefono, indirizzo,
   orari, coordinate.
2. **Distanza:** calcolata una volta al salvataggio via Distance Matrix
   (auto; km + minuti) dall'appartamento; salvata nel JSON.
3. **Descrizione:** l'host scrive solo in italiano → traduzione EN
   automatica (API gratuita, es. MyMemory) generata al salvataggio e
   **modificabile** prima di salvare.
4. **Voto:** stelle da 1 a 5 con mezzi voti, assegnate dall'host.
5. **Sezione:** scelta tra le 4 categorie; per "Places to go" anche il
   tag 🏖️ Spiaggia / ⛰️ Esperienza.
6. **Gestione:** lista dei posti esistenti con modifica ed eliminazione.
7. **Completa dati:** pulsante che, per i posti precaricati come bozza,
   recupera in batch tutti i dati Google mancanti.
8. **Salvataggio:** scrittura di `data/places.json` (download/File System
   Access API — dettaglio nel piano).

## Sito pubblico (`index.html`)

- **Header:** nome sito ("La Guida di Samuel", configurabile) + selettore
  lingua 🇮🇹/🇬🇧; la scelta è ricordata (localStorage), default IT.
- **Home:** 4 sezioni a tab/schede:
  🍕 Cibo · 📍 Places to go · 👶 Per i più piccoli · 🛍️ Shopping.
  In "Places to go" filtro interno Spiagge/Esperienze.
- **Lista posti:** card con foto, nome, stelle (mezzi voti resi
  graficamente), distanza ("2,3 km · 6 min in auto"),
  **ordinate per voto decrescente** (a pari voto: distanza crescente).
- **Scheda posto** (dettaglio): foto, descrizione IT/EN secondo lingua,
  stelle, distanza, orari, indirizzo + tre pulsanti grandi:
  - **📞 Chiama** → `tel:` (nascosto se il posto non ha telefono, es. spiagge)
  - **🗺️ Indicazioni** → Google Maps con percorso dall'appartamento
  - **💬 WhatsApp** → chat con l'host
- **Fondo home:** pulsante WhatsApp "Contatta il tuo host".
- **WhatsApp host:** `https://wa.me/393665316952` con messaggio
  precompilato bilingue.
- **Mobile-first:** layout a colonna singola, pulsanti touch-friendly,
  immagini lazy-load; su desktop griglia a più colonne.

## Dati precaricati (28 posti, come bozze)

Tutti i posti, con Place ID e descrizioni IT/EN già scritte (tono
propositivo ma sobrio), sono in **`data/seed-places.json`** — la fonte di
verità per il precaricamento. Voti da assegnare dall'admin.

- 27/28 posti hanno il Place ID verificato (i mancanti nel file sorgente
  sono stati recuperati e confermati tramite indirizzo/sito/coordinate).
- Unica eccezione: **Centro Commerciale Oasi** (`placeId: null`) — da
  confermare dall'admin con la ricerca per nome.
- "Eremo di San Celestino V" è stato identificato con l'host come
  **Eremo di Sant'Onofrio al Morrone** (Sulmona).
- "Centro commerciale Ortona" corrisponde su Maps a **Ortona Center**.
- Le descrizioni EN dei posti precaricati sono già redatte a mano (niente
  traduzione automatica per questi); la traduzione automatica resta per i
  posti aggiunti in futuro dall'admin.

**🍕 Cibo (14)** · **📍 Places to go (10:** 5 spiagge + 5 esperienze **)**
· **👶 Per i più piccoli (4)** · **🛍️ Shopping (5)**

## Modello dati (`places.json`, per posto)

```json
{
  "id": "trabocco-punta-fornace",
  "placeId": "ChIJzfk3Oj0DMRMRF8ZezIFBDOQ",
  "category": "food",            // food | places | kids | shopping
  "tag": null,                    // per places: "beach" | "experience"
  "name": "Trabocco Punta Fornace",
  "rating": 4.5,                  // 1–5, step 0.5, null se bozza
  "descriptionIt": "…",
  "descriptionEn": "…",
  "phone": "+39 …",              // null se assente
  "address": "…",
  "coords": { "lat": 0, "lng": 0 },
  "distance": { "km": 2.3, "minutes": 6 },
  "photoUrl": "img/places/….jpg", // foto salvata localmente
  "hours": { "…": "…" },
  "draft": false                  // true finché i dati Google non sono completi
}
```

Le foto vengono scaricate dall'admin e salvate in `img/places/` per non
dipendere dalle URL Google (che richiedono la chiave API).

## Gestione errori

- Posto in bozza (dati incompleti): visibile solo nell'admin, non sul
  sito pubblico.
- Nessun telefono: pulsante Chiama nascosto.
- Traduzione automatica fallita: campo EN resta vuoto e l'admin lo
  segnala; il sito mostra la descrizione IT come fallback.
- API Google in errore/quota: messaggio chiaro nell'admin, nessun
  salvataggio parziale.
- `places.json` mancante/corrotto sul sito: messaggio cortese bilingue.

## Test

- Unit test (Node, senza framework pesanti) per: ordinamento per
  voto/distanza, formattazione distanza, rendering stelle a mezzi voti,
  fallback lingua.
- Verifica manuale mobile via anteprima browser (viewport 375px).

## Fuori scope (YAGNI)

- Voti degli ospiti, recensioni, login, backend, analytics,
  aggiornamento automatico dei dati Google.
