// Vercel serverless function (Node.js runtime).
// Generates an illustrative relationship map for any company using
// OpenRouter's free-tier models (OpenAI-compatible API). The API key
// stays server-side (env var OPENROUTER_API_KEY), never exposed to
// the browser.
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

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server misconfigured: OPENROUTER_API_KEY is not set in Vercel." });
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

  // OpenRouter rotates which models are free fairly often, so try a
  // short list in order and fall through to the next if one is gone.
  const FREE_MODELS = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "google/gemma-2-9b-it:free"
  ];

  let lastError = "Kein Modell verfügbar";
  for (const model of FREE_MODELS) {
    try {
      const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await upstream.json();

      if (!upstream.ok) {
        lastError = data.error?.message || `OpenRouter HTTP ${upstream.status}`;
        continue; // try next model
      }

      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        lastError = "OpenRouter lieferte keine verwertbare Antwort.";
        continue;
      }

      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      res.status(200).json(parsed);
      return;
    } catch (err) {
      lastError = err.message || "Unexpected server error";
    }
  }

  res.status(502).json({ error: lastError });
};