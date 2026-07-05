# La Guida di Samuele — Guida per gli ospiti

Sito statico bilingue (IT/EN) con i posti consigliati agli ospiti, gestito
tramite pannello admin locale. Spec: `docs/superpowers/specs/`.

## Uso quotidiano (host)

1. Doppio click su `apri-admin.command` (avvia il server locale e apre
   l'admin in Chrome). ⚠️ Non aprire `admin.html` con doppio click: da
   `file://` i pulsanti non funzionano.
2. La prima volta: incolla la chiave API e salva; scegli la cartella del
   progetto; carica `places.json`.
3. Aggiungi/modifica posti (ricerca per nome o Place ID, voto, descrizione).
4. Doppio click su `pubblica.command` per mettere online le modifiche.

## Anteprima locale del sito

http://localhost:8000/ (aggiungi `?preview=1` per vedere anche le bozze).

## Test

`node --test tests/*.test.mjs`

## Prima configurazione (una tantum)

1. **Chiave API Google**: su console.cloud.google.com crea un progetto,
   abilita **Places API (New)** e **Routes API**, crea una API key.
   La chiave resta nel browser (localStorage), mai nel repository.
2. **GitHub**: crea un repo, poi
   `git remote add origin <url> && git push -u origin main`.
3. **Pages**: Settings → Pages → Source: **GitHub Actions**.
