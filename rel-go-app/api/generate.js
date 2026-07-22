// Vercel serverless function (Node.js runtime).
// Keeps the real Anthropic API key server-side (in an env var),
// so it's never exposed to the browser. The frontend calls
// POST /api/generate with { query } and gets back the raw
// Anthropic Messages API response.

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server misconfigured: ANTHROPIC_API_KEY is not set in Vercel." });
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
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data.error?.message || "Anthropic API error" });
      return;
    }

    const textBlocks = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const clean = textBlocks.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unexpected server error" });
  }
};
