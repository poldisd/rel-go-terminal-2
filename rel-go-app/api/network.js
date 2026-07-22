// Vercel serverless function (Node.js runtime).
// Real data for two of the five relationship categories:
//  - "Banks"  -> analyst recommendation trends + price target (aggregate, no bank names available on Finnhub)
//  - "Board"  -> most recent insider transactions (real people, real filings; not a literal board roster)
// Holders / Customers / Suppliers have no accessible free data source and
// stay as sample data in the frontend — this endpoint only returns what's real.
//
// Usage: GET /api/network?symbol=AAPL

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

  const base = "https://finnhub.io/api/v1";
  let banks = [];
  let board = [];
  const warnings = [];

  // --- Banks: analyst recommendation trends + price target ---
  try {
    const recResp = await fetch(`${base}/stock/recommendation-trends?symbol=${encodeURIComponent(symbol)}&token=${key}`);
    if (!recResp.ok) throw new Error(`recommendation-trends HTTP ${recResp.status}`);
    const recData = await recResp.json();
    const latest = Array.isArray(recData) && recData.length ? recData[0] : null;

    if (latest) {
      const buckets = [
        { name: "Strong Buy", key: "strongBuy" },
        { name: "Buy", key: "buy" },
        { name: "Hold", key: "hold" },
        { name: "Sell", key: "sell" },
        { name: "Strong Sell", key: "strongSell" }
      ];
      const total = buckets.reduce((s, b) => s + (latest[b.key] || 0), 0);
      if (total > 0) {
        banks = buckets
          .filter(b => (latest[b.key] || 0) > 0)
          .map(b => {
            const count = latest[b.key];
            const size = count >= total * 0.35 ? "large" : count >= total * 0.15 ? "medium" : "small";
            return {
              name: `${b.name} (${count})`,
              size,
              desc: `${count} von ${total} Analysten stufen die Aktie aktuell als "${b.name}" ein (Stand: ${latest.period}).`
            };
          });
      }
    }
  } catch (err) {
    warnings.push("banks: " + err.message);
  }

  try {
    const ptResp = await fetch(`${base}/stock/price-target?symbol=${encodeURIComponent(symbol)}&token=${key}`);
    if (ptResp.ok) {
      const pt = await ptResp.json();
      if (pt && pt.targetMean) {
        banks.push({
          name: "Ø Kursziel",
          size: "medium",
          desc: `Durchschnittliches Analysten-Kursziel: $${pt.targetMean} (Spanne $${pt.targetLow}–$${pt.targetHigh}, Stand ${pt.lastUpdated}).`
        });
      }
    }
  } catch (err) {
    warnings.push("price-target: " + err.message);
  }

  // --- Board: most recent distinct insiders from Form 3/4/5 filings ---
  try {
    const insResp = await fetch(`${base}/stock/insider-transactions?symbol=${encodeURIComponent(symbol)}&token=${key}`);
    if (!insResp.ok) throw new Error(`insider-transactions HTTP ${insResp.status}`);
    const insData = await insResp.json();
    const rows = insData.data || [];
    const seen = new Set();
    for (const r of rows) {
      if (!r.name || seen.has(r.name)) continue;
      seen.add(r.name);
      const change = r.change || 0;
      const isBuy = r.transactionCode === "P" || change > 0;
      const shares = Math.abs(change || r.share || 0);
      board.push({
        name: r.name,
        desc: `Insider-Meldung: ${isBuy ? "Kauf" : "Verkauf"} von ${shares.toLocaleString("de-DE")} Aktien am ${r.transactionDate || r.filingDate}.`
      });
      if (board.length >= 5) break;
    }
  } catch (err) {
    warnings.push("board: " + err.message);
  }

  res.status(200).json({ banks, board, warnings });
};