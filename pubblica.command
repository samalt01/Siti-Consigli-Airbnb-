#!/bin/zsh
# Doppio click per pubblicare le modifiche online.
cd "$(dirname "$0")"
git add -A
git commit -m "Aggiornamento posti $(date '+%Y-%m-%d %H:%M')" || echo "Niente da pubblicare."
git push && echo "✅ Pubblicato! Il sito si aggiorna in 1-2 minuti." || echo "❌ Errore: controlla la connessione o il remote."
read -k 1 "?Premi un tasto per chiudere…"
