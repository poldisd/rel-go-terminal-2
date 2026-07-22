# REL<GO> — Relationship Map Terminal

Bloomberg-Terminal-Style Beziehungsnetzwerk-Explorer (Holders, Board, Banks, Kunden, Lieferanten)
mit optionalen Live-Kursdaten von Finnhub und optionaler KI-Firmensuche über Claude.

## Deploy auf Vercel
1. Repo zu deinem GitHub pushen / hochladen
2. Auf vercel.com → "Add New" → "Project" → dieses Repo auswählen → Deploy

## Environment Variables (beide optional, aber empfohlen)

In Vercel → Project → Settings → Environment Variables:

| Name | Wert | Wofür |
|---|---|---|
| `FINNHUB_API_KEY` | Key von finnhub.io (Dashboard) | Live-Kurs, Market Cap, KGV, Dividendenrendite, 52-Wochen-Range, Beta beim Klick auf den Firmen-Mittelpunkt |
| `ANTHROPIC_API_KEY` | Key von console.anthropic.com | Freie Suche nach Firmen außerhalb der 4 Demo-Ticker (LNG, BKR, AAPL, TSLA) |

Nach dem Eintragen: **Deployments → neuestes Deployment → "Redeploy"** (Pflicht, sonst greifen die Keys nicht).

Ohne die Keys funktioniert das Tool trotzdem — dann zeigt es überall die eingebauten Beispieldaten
statt Live-Werten, klar gekennzeichnet im Modal ("LIVE-DATEN NICHT VERFÜGBAR").

## Wie die Live-Kurse funktionieren
Klick auf den Firmen-Mittelpunkt (z.B. "LNG") öffnet das Detail-Modal. Es zeigt sofort die
Beispieldaten, holt dann im Hintergrund über `/api/quote.js` (Vercel-Serverless-Funktion,
hält den Finnhub-Key sicher server-seitig) den aktuellen Kurs von Finnhub und tauscht die
Zahlen aus, sobald sie da sind. Das Beziehungsnetzwerk (Holders/Board/Banks/Kunden/Lieferanten)
bleibt immer Beispieldaten — dafür gibt's keine freie Datenquelle.

## Lokal öffnen
`index.html` direkt im Browser öffnen (Live-Kurse und Suche funktionieren dann nicht,
da `/api/*` einen Server braucht).
