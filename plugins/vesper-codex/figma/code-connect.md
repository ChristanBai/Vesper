# Figma Code Connect mapping

Create Figma variables from `figma/tokens.json`, then map these components to the dashboard implementation:

| Figma component | Code node |
| --- | --- |
| `MetricCard` | `dashboard/index.html` `.metric-card` |
| `MarketChart` | `dashboard/app.js` `drawChart` |
| `BuyMarker` | `dashboard/app.js` marker rendering, `.legend-dot.buy` |
| `SellMarker` | `dashboard/app.js` marker rendering, `.legend-dot.sell` |
| `PositionRow` | `dashboard/app.js` `renderSnapshot` |
| `PieCard` | `dashboard/app.js` `renderSnapshot` |
| `DailyBrief` | Dashboard daily brief rendered from MCP `daily_brief` |
| `StatusBadge` | `dashboard/index.html` `.source-badge` |
| `Sidebar` | `dashboard/index.html` `.sidebar` |

Keep component states monochrome except buy, sell and warning semantics. Use the chart canvas as the primary visual object rather than adding decorative containers.
