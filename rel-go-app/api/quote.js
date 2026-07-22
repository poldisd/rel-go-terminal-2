// Vercel serverless function (Node.js runtime).
// Fetches a live quote + company profile + key metrics from Finnhub
// and returns them in the shape the frontend expects. The Finnhub
// key stays server-side (env var), never exposed to the browser.
//
// Usage: GET /api/quote?symbol=AAPL

module.exports = async function handler(req, res) {
  const symbol = (req.query.symbol || "").toUpperCase().trim();
  if (!symbol) {
    res.status(400).json({ error: "Missing 'symbol' query parameter" });
    return;
  }

  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Server misconfigured: FINNHUB_API_KEY is not set in Vercel." });
    return;
  }

  try {
    const base = "https://finnhub.io/api/v1";
    const [quoteResp, profileResp, metricResp] = await Promise.all([
      fetch(`${base}/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`),
      fetch(`${base}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${key}`),
      fetch(`${base}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${key}`)
    ]);

    if (!quoteResp.ok) {
      throw new Error(`Finnhub /quote HTTP ${quoteResp.status}`);
    }
    const quote = await quoteResp.json();
    const profile = profileResp.ok ? await profileResp.json() : {};
    const metricData = metricResp.ok ? await metricResp.json() : {};
    const metric = metricData.metric || {};

    // Finnhub returns all zeros when a symbol doesn't exist / has no data
    if ((quote.c === 0 || quote.c == null) && (quote.pc === 0 || quote.pc == null)) {
      res.status(404).json({ error: `Kein Kurs für Symbol "${symbol}" gefunden (evtl. falscher Ticker).` });
      return;
    }

    const changeSign = (quote.dp != null && quote.dp < 0) ? "neg" : "pos";
    const fmtPct = (v) => (v == null ? "–" : (v >= 0 ? "+" : "") + v.toFixed(1) + "%");
    const fmtMoney = (v) => (v == null ? null : "$" + v.toFixed(2));
    const fmtCap = (v) => {
      if (v == null) return "–";
      if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "T";
      return "$" + (v / 1000).toFixed(1) + "B"; // Finnhub reports marketCapitalization in millions
    };

    res.status(200).json({
      symbol,
      name: profile.name || symbol,
      sector: profile.finnhubIndustry || null,
      price: fmtMoney(quote.c) || "–",
      change: fmtPct(quote.dp),
      changeSign,
      marketCap: fmtCap(profile.marketCapitalization),
      peRatio: metric.peBasicExclExtraTTM != null ? metric.peBasicExclExtraTTM.toFixed(1) : "–",
      divYield: metric.dividendYieldIndicatedAnnual != null ? metric.dividendYieldIndicatedAnnual.toFixed(2) + "%" : "0%",
      week52: (metric["52WeekLow"] != null && metric["52WeekHigh"] != null)
        ? `$${metric["52WeekLow"].toFixed(2)} – $${metric["52WeekHigh"].toFixed(2)}`
        : "–",
      beta: metric.beta != null ? metric.beta.toFixed(2) : "–"
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unexpected server error" });
  }
};
