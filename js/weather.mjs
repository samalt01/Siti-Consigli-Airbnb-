// Meteo attuale via Open-Meteo (gratis, senza chiave). Icone dai codici WMO.

const ICONS = [
  [[0], '☀️'], [[1], '🌤️'], [[2], '⛅'], [[3], '☁️'],
  [[45, 48], '🌫️'],
  [[51, 53, 55, 56, 57], '🌦️'],
  [[61, 63, 65, 66, 67, 80, 81, 82], '🌧️'],
  [[71, 73, 75, 77, 85, 86], '🌨️'],
  [[95, 96, 99], '⛈️'],
];

export function weatherIcon(code) {
  for (const [codes, icon] of ICONS) if (codes.includes(code)) return icon;
  return '🌡️';
}

const LABELS = {
  it: { clear: 'Sereno', cloudy: 'Nuvoloso', fog: 'Nebbia', rain: 'Pioggia', snow: 'Neve', storm: 'Temporale' },
  en: { clear: 'Clear', cloudy: 'Cloudy', fog: 'Fog', rain: 'Rain', snow: 'Snow', storm: 'Storm' },
};

function category(code) {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'rain'; // 51–67, 80–82
}

export function weatherLabel(code, lang) {
  const key = category(code);
  return LABELS[lang]?.[key] ?? LABELS.it[key];
}

export async function fetchWeather(home) {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${home.lat}&longitude=${home.lng}` +
    `&current=temperature_2m,weather_code&timezone=auto`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(r.status);
  const d = await r.json();
  return { temp: Math.round(d.current.temperature_2m), code: d.current.weather_code };
}
