// Vercel serverless function (Node.js runtime).
// Generates an illustrative relationship map for any company using
// Google Gemini. The API key stays server-side (env var GEMINI_API_KEY),
// never exposed to the browser.
//
// Usage: POST /api/generate  with body { "query": "Nvidia" }

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { query } = req.body || {};
  if (!query || typeof query !== "string" || !query.trim()) {
    res.status(400).json({ error: "Missing 'query' in request body" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server misconfigured: GEMINI_API_KEY is not set in Vercel." });
    return;
  }

  const prompt = `Erstelle ein illustratives Beziehungsnetzwerk für die Firma oder den Ticker "${query.trim()}" für ein Finanz-Demo-Tool.
Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt, ohne Markdown-Codeblöcke, ohne Kommentar davor oder danach, exakt in diesem Schema:
{
  "name": "vollständiger Firmenname",
  "ticker": "BÖRSENKÜRZEL",
  "sector": "kurze Branche",
  "price": "$123.45",
  "change": "+1.2%",
  "changeSign": "pos oder neg",
  "marketCap": "z.B. $52.3B",
  "peRatio": "z.B. 19.4",
  "divYield": "z.B. 1.2% (oder 0% falls keine Dividende)",
  "week52": "z.B. $155 – $258",
  "volume": "z.B. 1.8M",
  "beta": "z.B. 0.85",
  "desc": "ein kurzer Satz auf Deutsch, was die Firma macht",
  "holders": [ {"name":"...", "desc":"kurze deutsche Erklärung, wer/was das ist"} ] (4 Einträge, reale bekannte institutionelle Investoren wo plausibel),
  "board": [ {"name":"Name (CEO)", "desc":"..."}, {"name":"...", "desc":"..."} ] (4 Einträge, erster ist CEO, kurze deutsche Erklärung der Rolle, keine erfundenen Details),
  "banks": [ {"name":"...", "desc":"kurze deutsche Erklärung: Investmentbank mit Coverage"} ] (3 Einträge),
  "customers": [ {"name":"...", "size":"large|medium|small", "desc":"kurze deutsche Erklärung, wer das ist und warum Kunde"} ] (3-4 Einträge, Größe nach Vertragsvolumen),
  "suppliers": [ {"name":"...", "size":"large|medium|small", "desc":"kurze deutsche Erklärung"} ] (3-4 Einträge)
}
Alle "desc"-Texte auf Deutsch, maximal 15 Wörter, sachlich, keine Spekulation. Nur das JSON-Objekt, sonst nichts.`;

  try {
    const model = "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      const msg = data.error?.message || `Gemini HTTP ${upstream.status}`;
      res.status(upstream.status).json({ error: msg });
      return;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      res.status(502).json({ error: "Gemini lieferte keine verwertbare Antwort." });
      return;
    }

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unexpected server error" });
  }
};