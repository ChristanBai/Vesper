import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { simpleMovingAverage } from "../src/analysis/technical.mjs";
import { conditionalPatterns } from "../src/vigilalpha/conditional-patterns.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const bars = Array.from({ length: 180 }, (_, i) => {
  const close = 100 + (i < 90 ? i * .4 : 36 - (i - 90) * .55) + Math.sin(i / 8) * 5;
  return { time: new Date(Date.UTC(2025, 0, i + 1)).toISOString(), open: close - 1,
    high: close + 2, low: close - 2, close, volume: 1000 };
});
const plans = conditionalPatterns({ interval: "1D", currency: "USD", bars }, { asOf: "2025-07-01T00:00:00Z" });
const x = (i) => 55 + i * 5;
const y = (p) => 350 - (p - 70) * 3;
const closes = bars.map((b) => b.close);
function line(period, color) {
  const points = bars.flatMap((_, i) => {
    const value = period ? simpleMovingAverage(closes.slice(0, i + 1), period) : closes[i];
    return value === null ? [] : [`${x(i)},${y(value)}`];
  });
  return `<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="2"/>`;
}
const markers = plans.markers.filter((m) => m.patternId === "sma-trend-cross").map((m) => {
  const i = bars.findIndex((b) => b.time === m.time);
  const label = m.state === "ENTRY_CANDIDATE" ? "ENTRY candidate" : "EXIT candidate";
  return `<circle cx="${x(i)}" cy="${y(m.price)}" r="6" fill="#fff" stroke="#111827"/><text x="${x(i) + 8}" y="${y(m.price) - 12}" font-size="14">${label}</text>`;
}).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500" role="img" aria-labelledby="title desc">
<title id="title">VigilAlpha conditional trend research example</title><desc id="desc">Original synthetic price series, SMA20 and SMA50. Entry and exit markers are research candidates, not real trades.</desc>
<rect width="1000" height="500" fill="#f8fafc"/><g font-family="Arial,sans-serif" fill="#0f172a">
<text x="40" y="38" font-size="24" font-weight="700">Conditional rules made inspectable</text>
<text x="40" y="65" font-size="14">SYNTHETIC DATA · illustrative research · production weight 0 · not a forecast</text>
<path d="M55 100V365H960" fill="none" stroke="#94a3b8"/>
${line(0, "#94a3b8")}${line(20, "#0369a1")}${line(50, "#c2410c")}${markers}
<text x="40" y="405" font-size="15">Grey: synthetic close     Blue: SMA20     Orange: SMA50</text>
<text x="40" y="435" font-size="14">Entry regime: SMA20 &gt; SMA50. Exit regime: SMA20 &lt;= SMA50.</text>
<text x="40" y="463" font-size="14">Completed dates only. Next-bar hypothetical execution; costs and risk gates remain separate.</text>
</g></svg>`;
await mkdir(path.join(root, "docs/images"), { recursive: true });
await writeFile(path.join(root, "docs/images/conditional-research-example.svg"), svg);
console.log("Wrote docs/images/conditional-research-example.svg (synthetic, no account data).");
