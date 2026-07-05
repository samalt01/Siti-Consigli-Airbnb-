#!/bin/zsh
# Doppio click per aprire il pannello admin in Chrome (avvia anche il server locale).
cd "$(dirname "$0")"

PORT=8000
# Avvia il server solo se non è già in ascolto
if ! lsof -i :$PORT >/dev/null 2>&1; then
  nohup python3 -m http.server $PORT >/dev/null 2>&1 &
  sleep 1
fi

URL="http://localhost:$PORT/admin.html"
if open -a "Google Chrome" "$URL" 2>/dev/null; then
  echo "✅ Admin aperto in Chrome: $URL"
else
  open "$URL"
  echo "⚠️  Chrome non trovato: aperto nel browser predefinito."
  echo "   Per salvare i file (places.json e foto) serve Google Chrome."
fi
sleep 2
