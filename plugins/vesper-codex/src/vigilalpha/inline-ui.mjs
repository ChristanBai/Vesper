export const SETUP_UI_URI = "ui://vigilalpha/setup.html";
export const PORTFOLIO_FLOW_UI_URI = "ui://vigilalpha/portfolio-flow.html";
export const HOLDING_CHART_UI_URI = "ui://vigilalpha/holding-chart.html";
export const RISK_TIMELINE_UI_URI = "ui://vigilalpha/risk-timeline.html";

export function normalizeAppToolResult(response) {
  if (!response || typeof response !== "object") return {};
  return response.structuredContent
    || response.result?.structuredContent
    || response.mcp_tool_result?.structuredContent
    || response.call_tool_result?.structuredContent
    || response;
}

export function formatSetupStatus(data) {
  const status = data && typeof data === "object" ? data : {};
  const version = status.version || "未知";
  const source = status.credentialSource || status.credentials?.source || "missing";
  const verifiedAt = status.accountVerifiedAt || status.config?.accountVerifiedAt || null;
  if (!status.configured) {
    return `版本 ${version}；尚未检测到完整凭据。请确认 Live/Demo 环境与密钥来源一致。`;
  }
  const verified = verifiedAt ? `；验证时间 ${verifiedAt}` : "";
  return `版本 ${version}；已配置；凭据来源 ${source}${verified}；模式 read-only。`;
}

export function listInlineResources() {
  return [
    resource(SETUP_UI_URI, "VigilAlpha secure setup", "Local macOS Keychain setup card for Trading 212 read-only credentials."),
    resource(PORTFOLIO_FLOW_UI_URI, "VigilAlpha portfolio risk flow", "Account-to-holding allocation and explicit risk-source flow."),
    resource(HOLDING_CHART_UI_URI, "VigilAlpha holding chart", "OHLC chart with average cost, real Trading 212 executions and evidence state."),
    resource(RISK_TIMELINE_UI_URI, "VigilAlpha risk timeline", "Timeline built only from saved VigilAlpha-derived snapshots.")
  ];
}

export function readInlineResource(uri) {
  if (uri !== SETUP_UI_URI) return null;
  return content(uri, setupHtml());
}

export function readVisualizationResource(uri) {
  if (uri === PORTFOLIO_FLOW_UI_URI) return content(uri, portfolioFlowHtml());
  if (uri === HOLDING_CHART_UI_URI) return content(uri, holdingChartHtml());
  if (uri === RISK_TIMELINE_UI_URI) return content(uri, riskTimelineHtml());
  return null;
}

function resource(uri, name, description) {
  return { uri, name, description, mimeType: "text/html;profile=mcp-app" };
}

function content(uri, text) {
  return { uri, mimeType: "text/html;profile=mcp-app", text };
}

function setupHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{color-scheme:dark;--bg:#020617;--card:#0e1223;--line:#334155;--text:#f8fafc;--muted:#94a3b8;--accent:#22c55e;--danger:#ef4444}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{max-width:820px;margin:0 auto;padding:24px;border:1px solid var(--line);border-radius:18px;background:var(--card)}.eyebrow{color:var(--accent);font-weight:700;letter-spacing:.08em;text-transform:uppercase}h1{font-size:24px;margin:6px 0 8px}.muted{color:var(--muted)}.notice{margin:18px 0;padding:14px;border-left:3px solid var(--accent);background:#0f172a}.grid{display:grid;gap:14px}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}label{display:grid;gap:6px;font-weight:650}input,select,button{font:inherit;border-radius:10px}input,select{width:100%;padding:11px 12px;color:var(--text);background:#020617;border:1px solid var(--line)}input:focus,select:focus,button:focus,summary:focus{outline:3px solid #fff;outline-offset:2px}button{min-height:44px;padding:10px 16px;border:0;background:var(--accent);color:#052e16;font-weight:800;cursor:pointer}.secondary{background:#1e293b;color:var(--text);border:1px solid var(--line)}.danger{background:transparent;color:#fca5a5;border:1px solid #7f1d1d}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.status{min-height:24px;margin-top:14px;white-space:pre-wrap}.error{color:#fca5a5}details{margin-top:22px;border-top:1px solid var(--line);padding-top:18px}summary{cursor:pointer;font-weight:800}.advanced{margin-top:16px;padding:16px;border:1px solid var(--line);border-radius:14px;background:#080d1a}.advanced h2{font-size:15px;margin:18px 0 8px}.advanced h2:first-child{margin-top:0}.badge{display:inline-block;margin-left:8px;padding:2px 7px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:12px}@media(max-width:620px){.card{padding:18px;border-radius:0}.two{grid-template-columns:1fr}.actions button{width:100%}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
</style>
</head>
<body><main class="card">
<div class="eyebrow">VigilAlpha · Local only</div><h1>连接 Trading 212 / Connect Trading 212</h1>
<p class="muted">凭据只交给本地 MCP，并保存到 macOS Keychain。模型、聊天记录和工具结果不会收到密钥。</p>
<div class="notice"><strong>只开启读取权限。</strong><br>不要开启订单执行、修改 Pie 或任何写入权限。VigilAlpha 永久不提供下单能力。</div>
<form id="setup" class="grid">
<label for="environment">Environment</label><select id="environment" name="environment"><option value="live">Live Invest / ISA</option><option value="demo">Demo</option></select>
<label for="apiKey">Trading 212 API Key</label><input id="apiKey" name="apiKey" type="password" autocomplete="username" required>
<label for="apiSecret">Trading 212 API Secret</label><input id="apiSecret" name="apiSecret" type="password" autocomplete="current-password" required>
<label for="marketDataKey">Market data key (optional)</label><input id="marketDataKey" name="marketDataKey" type="password" autocomplete="off">
<label for="profile">Risk profile</label><select id="profile" name="profile"><option value="balanced">均衡 Balanced</option><option value="conservative">保守 Conservative</option><option value="growth">进取 Growth</option></select>
<div class="actions"><button type="submit" id="save">验证并保存 / Verify & save</button><button class="secondary" type="button" id="status">检查状态 / Check status</button></div>
</form><div id="result" class="status" role="status" aria-live="polite"></div>
<details><summary>高级参数 / Advanced settings <span class="badge">修改后未验证</span></summary>
<form id="preferences" class="advanced">
<p class="muted">自定义参数会记录独立版本和与官方默认值的差异，但不会提升策略成熟度。</p>
<h2>风险阈值</h2><div class="two">
<label>单一持仓上限 %<input name="maxPositionWeightPercent" type="number" min="1" max="100" step="0.1" placeholder="20"></label>
<label>回撤警戒线 %<input name="drawdownWarningPercent" type="number" min="1" max="95" step="0.1" placeholder="15"></label></div>
<h2>趋势与动量</h2><div class="two">
<label>趋势快线周期<input name="fastPeriod" type="number" min="2" max="100" step="1" placeholder="20"></label>
<label>趋势慢线周期<input name="slowPeriod" type="number" min="3" max="250" step="1" placeholder="50"></label>
<label>动量周期<input name="momentumPeriod" type="number" min="2" max="100" step="1" placeholder="14"></label>
<label>动量正向阈值<input name="momentumPositiveThreshold" type="number" min="50" max="99" step="0.1" placeholder="55"></label>
<label>动量负向阈值<input name="momentumNegativeThreshold" type="number" min="1" max="50" step="0.1" placeholder="45"></label></div>
<h2>均值回归与波动</h2><div class="two">
<label>均值回归周期<input name="meanReversionPeriod" type="number" min="2" max="250" step="1" placeholder="20"></label>
<label>均值偏离阈值 %<input name="meanReversionDeviationPercent" type="number" min="0.1" max="100" step="0.1" placeholder="8"></label>
<label>年化波动警戒 %<input name="annualizedVolatilityPercent" type="number" min="1" max="500" step="0.1" placeholder="50"></label></div>
<div class="actions"><button type="submit" id="savePreferences">保存自定义参数</button><button type="button" class="danger" id="resetPreferences">恢复官方默认值</button></div>
</form></details>
</main>
<script type="module">
const result=document.querySelector('#result');
${normalizeAppToolResult.toString()}
${formatSetupStatus.toString()}
async function call(name,args={}){if(!window.openai?.callTool)throw new Error('This host does not expose MCP App tool calls. Use the text setup instructions.');return window.openai.callTool(name,args)}
function values(form){const data={};for(const [key,value] of new FormData(form)){if(value==='')continue;data[key]=form.elements[key]?.type==='number'?Number(value):value}return data}
document.querySelector('#setup').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;const button=document.querySelector('#save');button.disabled=true;result.className='status';result.textContent='正在验证 Trading 212 只读访问…';const data=Object.fromEntries(new FormData(form));try{const response=normalizeAppToolResult(await call('configure_credentials',data));if(!response.configured)throw new Error('验证工具没有返回已配置状态。');result.textContent='验证通过，正在确认 Keychain 状态…';const status=normalizeAppToolResult(await call('setup_status',{}));if(!status.configured)throw new Error('验证已通过，但当前运行状态尚未读取到 Keychain。请重新打开配置卡后检查状态。');form.reset();result.className='status';result.textContent='验证成功，凭据已保存到 Keychain。\\n'+formatSetupStatus(status)}catch(error){result.className='status error';result.textContent=(error.message||'验证失败')+'\\n输入内容未清空；请核对环境、只读权限和 Key/Secret 后重试。'}finally{button.disabled=false}});
document.querySelector('#status').addEventListener('click',async()=>{const button=document.querySelector('#status');button.disabled=true;result.className='status';result.textContent='正在检查本地状态…';try{const response=normalizeAppToolResult(await call('setup_status',{}));result.className=response.configured?'status':'status error';result.textContent=formatSetupStatus(response)}catch(error){result.className='status error';result.textContent=(error.message||'状态检查失败')+'\\n请重新打开配置卡或重启 Codex 后重试。'}finally{button.disabled=false}});
document.querySelector('#preferences').addEventListener('submit',async(event)=>{event.preventDefault();const button=document.querySelector('#savePreferences');button.disabled=true;result.className='status';result.textContent='正在验证参数…';try{const data=normalizeAppToolResult(await call('configure_preferences',values(event.currentTarget)));const diff=Array.isArray(data?.differences)?data.differences.length:0;result.textContent='已保存自定义参数；与官方默认值相差 '+diff+' 项。这些参数标记为“未验证”。'}catch(error){result.className='status error';result.textContent=error.message||'参数无效，未保存。'}finally{button.disabled=false}});
document.querySelector('#resetPreferences').addEventListener('click',async()=>{const button=document.querySelector('#resetPreferences');button.disabled=true;try{await call('configure_preferences',{reset:true});document.querySelector('#preferences').reset();result.className='status';result.textContent='已恢复官方默认值。'}catch(error){result.className='status error';result.textContent=error.message||'恢复失败。'}finally{button.disabled=false}});
</script></body></html>`;
}

// Display helpers deliberately reject missing values instead of painting them as zero.
export function displayNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function selectHoldingBars(bars, count = 120) {
  return (Array.isArray(bars) ? bars : [])
    .filter((bar) => Number.isFinite(Date.parse(bar.time || bar.timestamp || ""))
      && [bar.open, bar.high, bar.low, bar.close].every((value) => displayNumber(value) !== null)
      && Number(bar.high) >= Math.max(Number(bar.open), Number(bar.close), Number(bar.low))
      && Number(bar.low) <= Math.min(Number(bar.open), Number(bar.close)))
    .slice().sort((a, b) => Date.parse(a.time || a.timestamp) - Date.parse(b.time || b.timestamp))
    .slice(-count);
}

export function visibleExecutions(markers, bars) {
  if (!bars.length) return [];
  // Daily candles and intraday fills share a UTC date; never move a fill to the next session.
  const dates = new Map(bars.map((bar, index) => [new Date(bar.time || bar.timestamp).toISOString().slice(0, 10), index]));
  return (Array.isArray(markers) ? markers : []).flatMap((marker) => {
    const timestamp = Date.parse(marker.timestamp || marker.time || "");
    const price = displayNumber(marker.executionPrice ?? marker.price);
    if (!Number.isFinite(timestamp) || price === null || !["BUY", "SELL"].includes(marker.side)) return [];
    const index = dates.get(new Date(timestamp).toISOString().slice(0, 10));
    return index === undefined ? [] : [{ ...marker, price, index }];
  });
}

function workspaceHeader(context, title, statusId) {
  return `<header><div class="identity"><svg class="brand" viewBox="0 0 256 256" aria-hidden="true"><rect x="16" y="16" width="224" height="224" rx="52" fill="white"/><path d="M49 174H208" stroke="#CBD5E1" stroke-width="10" stroke-linecap="round"/><path d="M50 158L89 119L126 139L160 101L199 146L218 78M202 78H218V94" stroke="#111827" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/></svg><div><span class="eyebrow">VigilAlpha / ${context}</span><h1 id="title">${title}</h1></div></div><span id="${statusId}" class="pill">等待数据 / Awaiting data</span></header>`;
}

function portfolioFlowHtml() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${visualStyles()}</style></head>
<body><main>${workspaceHeader('Portfolio', '持仓风险总览 / Portfolio exposure', 'cutoff')}
<div class="metric-strip"><div><small>账户总值 / Account value</small><strong id="total">—</strong></div><p id="summary" class="summary" role="status"></p></div>
<div class="workspace"><section class="plot-panel" aria-labelledby="allocation-heading"><div class="plot-heading"><h2 id="allocation-heading">配置暴露 / Allocation exposure</h2><span class="caption">快照 / Snapshot</span></div><p class="caption">连接宽度表示账户权重；不是实际资金流。 / Width shows account weight, not cash flow.</p><svg id="allocation" viewBox="0 0 760 440" role="img" aria-labelledby="flow-title flow-desc"><title id="flow-title">账户到持仓的配置暴露 / Account to holdings</title><desc id="flow-desc">按已知权重绘制，不猜测 ETF 行业构成。完整数据见下表。</desc></svg><div id="empty" class="empty hidden">暂无可用权重 / No verified weights</div><p id="coverage" class="caption"></p></section><aside class="inspector"><h2>风险检查 / Risk checks</h2><div id="risks"></div><p class="foot">ETF 缺少带日期的成分证据时，不进行穿透。 / No ETF lookthrough without dated holdings evidence.</p></aside></div>
<details><summary>全部持仓与权重 / Holdings & weights</summary><div class="table-wrap"><table><thead><tr><th>持仓 / Holding</th><th>市值 / Value</th><th>权重 / Weight</th></tr></thead><tbody id="rows"></tbody></table></div></details><p class="foot">本地只读研究 / Local read-only research · 未知不等于零 / Unknown is not zero</p></main><script>${sharedDataScript()}
function render(data) {
  const positions = Array.isArray(data.positions) ? data.positions : (data.topPositions || []);
  const summary = data.summary || {}, veto = data.riskVeto || {};
  setText('#cutoff', data.sourceCutoff ? '快照 / As of '+data.sourceCutoff : '数据时间未知 / Date unknown');
  setText('#total', money(summary.totalValue, summary.currency));
  setText('#summary', '研究 / Research: '+(data.signal || 'UNKNOWN')+' · 风险否决 / Veto: '+vetoLabel(veto.active));
  const reasons = Array.isArray(veto.reasons) ? veto.reasons.slice() : [];
  if(data.lookthrough && data.lookthrough.unknownNodeCount) reasons.push({code:'ETF_UNKNOWN',message:data.lookthrough.unknownNodeCount+' ETF 未穿透 / without dated component evidence'});
  document.querySelector('#risks').innerHTML = reasons.map(r=>'<div class="risk"><strong>'+escapeHtml(r.code || 'RISK')+'</strong><p>'+escapeHtml(r.message || '')+'</p></div>').join('') || '<p class="caption">'+(veto.active === false ? '未触发否决 / No veto triggered' : '风险未评估 / Risk not assessed')+'</p>';
  document.querySelector('#rows').innerHTML = positions.map(p=>'<tr><td>'+escapeHtml(p.symbol || '—')+'</td><td>'+money(p.marketValue,p.currency || summary.currency)+'</td><td>'+percent(p.weightPercent)+'</td></tr>').join('') || '<tr><td colspan="3">暂无数据 / No data</td></tr>';
  const known = positions.filter(p=>displayNumber(p.weightPercent)!==null && Number(p.weightPercent)>0).sort((a,b)=>b.weightPercent-a.weightPercent);
  const shown = known.slice(0,8), rest = known.slice(8).reduce((sum,p)=>sum+Number(p.weightPercent),0);
  if(rest>0) shown.push({symbol:'其余已知 / Other known',weightPercent:rest});
  const total = known.reduce((sum,p)=>sum+Number(p.weightPercent),0);
  const svg = clearPlot('#allocation');
  document.querySelector('#empty').classList.toggle('hidden',shown.length>0);
  svg.classList.toggle('hidden',!shown.length);
  setText('#coverage','已知持仓覆盖 / Known holding coverage: '+total.toFixed(2)+'% · '+positions.length+' 持仓 / holdings. 余额差额不推断为现金 / Remainder is not inferred as cash.');
  if(!shown.length)return;
  const height=240, scale=height/Math.max(total,100), sourceTop=52;
  const targetHeight=shown.reduce((sum,p)=>sum+Math.max(24,Number(p.weightPercent)*scale)+10,0);
  svg.setAttribute('viewBox','0 0 760 '+Math.max(360,targetHeight+90));
  const sourceHeight=total*scale;
  svg.appendChild(node('rect',{x:55,y:sourceTop,width:8,height:sourceHeight,rx:4,fill:'var(--text)'}));
  plotText(svg,55,30,'账户 / Account');
  let offset=sourceTop, targetOffset=sourceTop;
  shown.forEach((p,i)=>{
    const width=Number(p.weightPercent)*scale, target=targetOffset;
    const d='M63 '+offset+' C300 '+offset+' 380 '+target+' 538 '+target+' L538 '+(target+width)+' C380 '+(target+width)+' 300 '+(offset+width)+' 63 '+(offset+width)+' Z';
    const ribbon=node('path',{d,fill:'var(--accent)',opacity:0.12+i*0.045,class:'ribbon'});
    const title=node('title');title.textContent=p.symbol+' '+percent(p.weightPercent);ribbon.appendChild(title);svg.appendChild(ribbon);
    svg.appendChild(node('rect',{x:538,y:target,width:5,height:width,rx:2,fill:'var(--accent)'}));
    plotText(svg,557,target+16,String(p.symbol || '—'));plotText(svg,730,target+16,percent(p.weightPercent),'end','var(--muted)');offset+=width;targetOffset+=Math.max(width,24)+10;
  });
}
bind(render);</script></body></html>`;
}

function holdingChartHtml() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${visualStyles()}</style></head>
<body><main>${workspaceHeader('Holding research', '单股研究 / Holding research', 'signal')}
<div class="metric-strip"><div><small id="price-label">最新收盘 / Last close</small><strong id="last-price">—</strong></div><p id="summary" class="summary" role="status"></p></div>
<section class="plot-panel"><div class="toolbar"><div class="segmented" role="group" aria-label="图形 / Chart type"><button data-chart="candles" aria-pressed="true">K 线 / Candles</button><button data-chart="line" aria-pressed="false">折线 / Line</button></div><label class="range">日线数量 / Bars <select id="range"><option value="30">30</option><option value="60">60</option><option value="120" selected>120</option><option value="250">250</option></select></label></div>
<div class="chart-shell"><svg id="chart" viewBox="0 0 900 380" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">价格、成本线与真实成交 / Price, cost and fills</title><desc id="chart-desc">B / S 为真实买卖，◇ 为未验证的研究候选；可切换显示。数据见下方表格。</desc></svg><div id="empty" class="empty hidden">行情不可用 / Market data unavailable</div></div>
<div class="toolbar chart-options"><label><input id="fills" type="checkbox" checked> B/S 真实成交 / Fills</label><label><input id="cost" type="checkbox" checked> — 平均成本 / Cost</label><label><input id="research" type="checkbox"> ◇ 实验候选 / Research</label></div><p id="window-info" class="caption" aria-live="polite"></p></section>
<div id="risk" class="risk-strip" role="status"></div><section id="event-lane" class="risk-strip" aria-label="事件背景 / Event context"></section>
<details><summary>条件研究：进入、退出与失效 / Research conditions</summary><p class="caption">实验规则，权重为零；◇ 不是成交。已完成日期观察，最早下一根 K 线模拟。 / Experimental, zero weight; candidates are not fills.</p><div class="table-wrap"><table><thead><tr><th>规则 / State</th><th>进入 / Entry</th><th>退出 / Exit</th><th>失效 / Failure</th></tr></thead><tbody id="researchRows"></tbody></table></div></details>
<details><summary>真实成交与行情数据 / Executions & market data</summary><h2>最近成交 / Recent fills</h2><div class="table-wrap"><table><thead><tr><th>时间 / Time</th><th>类型 / Side</th><th>价格 / Price</th><th>数量 / Quantity</th></tr></thead><tbody id="rows"></tbody></table></div><h2>可见行情 / Visible bars</h2><div class="table-wrap"><table><thead><tr><th>日期 / Date</th><th>开 / Open</th><th>高 / High</th><th>低 / Low</th><th>收 / Close</th></tr></thead><tbody id="barRows"></tbody></table></div></details><p class="foot" id="foot"></p></main><script>${sharedDataScript()}
${selectHoldingBars.toString()}
${visibleExecutions.toString()}
let latest={}, chartType='candles';
function render(data) {
  latest=data;const holding=data.holding || {}, chartData=data.chart || {};
  const bars=selectHoldingBars(chartData.bars,Number(document.querySelector('#range').value));
  const markers=visibleExecutions(chartData.executionMarkers,bars), veto=data.riskVeto || {};
  setText('#title',(holding.symbol || data.symbol || '单股')+' / Holding research');
  setText('#signal',data.signal || 'UNKNOWN');
  setText('#last-price',bars.length ? decimal(bars.at(-1).close)+' '+(chartData.currency || data.marketData?.currency || data.evidence?.market?.currency || 'currency unknown') : '—');
  setText('#summary','权重 / Weight '+percent(holding.weightPercent)+' · 来源 / Source '+(data.evidence?.market?.source || data.evidence?.source || 'UNKNOWN')+' · 行情截止 / Market as of '+(data.evidence?.market?.cutoff || data.marketData?.sourceCutoff || data.sourceCutoff || 'UNKNOWN'));
  const events=data.eventContext;
  setText('#event-lane',events ? '官方排期 / Schedule: '+events.checkedAt+' · '+(events.requiresRefresh?'需刷新 / Refresh required':'日期快照 / Dated snapshot')+' · '+(events.events || []).map(e=>e.date+' '+e.title).join(' · ')+' · 结果未知，不是预测 / Outcomes unknown, not a forecast.' : '事件背景未提供 / Event context not provided. 不表示没有风险 / Does not mean no risk.');
  setText('#risk','风险否决 / Risk veto: '+vetoLabel(veto.active)+(Array.isArray(veto.reasons) && veto.reasons.length ? ' · '+veto.reasons.map(r=>r.message || r.code).join(' · ') : ''));
  const svg=clearPlot('#chart');svg.classList.toggle('hidden',!bars.length);document.querySelector('#empty').classList.toggle('hidden',!!bars.length);
  setText('#empty',chartData.status==='NOT_REQUESTED'?'图表未请求 / Chart not requested. Enable includeChart.':'行情不可用；不绘制假 K 线。 / No verified market bars.');
  const cost=document.querySelector('#cost').checked ? displayNumber(chartData.averageCost) : null;
  const showFills=document.querySelector('#fills').checked;
  const candidates=document.querySelector('#research').checked ? (chartData.strategyMarkers || []).filter(m=>m.kind==='RESEARCH_CANDIDATE' && m.isExecution===false) : [];
  const dates=new Map(bars.map((b,i)=>[new Date(b.time || b.timestamp).toISOString().slice(0,10),i]));
  const research=candidates.flatMap(m=>{const date=Date.parse(m.time || ''),price=displayNumber(m.price);if(!Number.isFinite(date)||price===null)return [];const index=dates.get(new Date(date).toISOString().slice(0,10));return index===undefined?[]:[{...m,index,price}]});
  if(bars.length){
    const values=bars.flatMap(b=>[Number(b.low),Number(b.high)]).concat(cost===null?[]:[cost],showFills?markers.map(m=>m.price):[],research.map(m=>m.price));
    const min=Math.min(...values),max=Math.max(...values),pad=Math.max((max-min)*.1,Math.abs(max)*.005,.01),lo=min-pad,hi=max+pad;
    const plotWidth=Math.max(320,svg.getBoundingClientRect().width||900);
    svg.setAttribute('viewBox','0 0 '+plotWidth+' 380');
    const left=12,right=plotWidth-76,top=26,bottom=320,step=(right-left)/bars.length;
    const x=i=>left+(i+.5)*step,y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);
    for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4,yy=y(v);svg.appendChild(node('line',{x1:left,x2:right,y1:yy,y2:yy,stroke:'var(--line)','stroke-dasharray':'3 5'}));plotText(svg,right+12,yy+4,decimal(v),'start','var(--muted)')}
    if(chartType==='line'){
      const path=node('path',{d:bars.map((b,i)=>(i?'L':'M')+x(i)+' '+y(Number(b.close))).join(' '),stroke:'var(--accent)','stroke-width':2.5,fill:'none',class:'price-path'});svg.appendChild(path);
      if(bars.length===1)svg.appendChild(node('circle',{cx:x(0),cy:y(Number(bars[0].close)),r:4,fill:'var(--accent)'}));
    } else bars.forEach((b,i)=>{const color=Number(b.close)>=Number(b.open)?'var(--accent)':'var(--warn)',g=node('g');const title=node('title');title.textContent=(b.time||b.timestamp)+' O '+b.open+' H '+b.high+' L '+b.low+' C '+b.close;g.appendChild(title);g.appendChild(node('line',{x1:x(i),x2:x(i),y1:y(Number(b.high)),y2:y(Number(b.low)),stroke:color}));g.appendChild(node('rect',{x:x(i)-Math.max(1,step*.28),y:Math.min(y(Number(b.open)),y(Number(b.close))),width:Math.max(2,step*.56),height:Math.max(1,Math.abs(y(Number(b.open))-y(Number(b.close)))),fill:color}));svg.appendChild(g)});
    if(cost!==null){svg.appendChild(node('line',{x1:left,x2:right,y1:y(cost),y2:y(cost),stroke:'var(--text)','stroke-dasharray':'6 5'}));plotText(svg,left+4,y(cost)-7,'成本 / Cost '+decimal(cost))}
    if(showFills)markers.forEach(m=>{svg.appendChild(node('circle',{cx:x(m.index),cy:y(m.price),r:9,fill:'var(--card)',stroke:m.side==='BUY'?'var(--accent)':'var(--warn)'}));plotText(svg,x(m.index),y(m.price)+4,m.side==='BUY'?'B':'S','middle')});
    research.forEach(m=>{const marker=node('text',{x:x(m.index),y:y(m.price)-13,fill:'var(--research)','text-anchor':'middle','font-size':18});marker.textContent='◇';const title=node('title');title.textContent='Research only: '+m.patternId+' '+m.state;marker.appendChild(title);svg.appendChild(marker)});
    plotText(svg,left,350,String(bars[0].time || bars[0].timestamp).slice(0,10),'start','var(--muted)');plotText(svg,right,350,String(bars.at(-1).time || bars.at(-1).timestamp).slice(0,10),'end','var(--muted)');
  }
  setText('#window-info',bars.length+' 根可用日线 / available daily bars · '+markers.length+' 个同日成交 / same-day fills · '+research.length+' 个实验候选 / research candidates. 快照图，非实时流 / Snapshot, not a live feed.');
  document.querySelector('#rows').innerHTML=(chartData.executionMarkers || []).slice(-20).reverse().map(m=>'<tr><td>'+escapeHtml(m.timestamp || m.time || '—')+'</td><td>'+escapeHtml(m.side || '—')+'</td><td>'+decimal(m.executionPrice ?? m.price)+'</td><td>'+decimal(m.quantity)+'</td></tr>').join('')||'<tr><td colspan="4">没有可验证的成交 / No verified fills</td></tr>';
  document.querySelector('#barRows').innerHTML=bars.slice().reverse().map(b=>'<tr><td>'+escapeHtml(b.time || b.timestamp)+'</td>'+['open','high','low','close'].map(k=>'<td>'+decimal(b[k])+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="5">暂无数据 / No data</td></tr>';
  document.querySelector('#researchRows').innerHTML=(data.conditionalResearch?.rules || []).map(r=>'<tr><td>'+escapeHtml(r.patternId+' / '+r.state)+'</td><td>'+escapeHtml(r.enter)+'</td><td>'+escapeHtml(r.exit)+'</td><td>'+escapeHtml(r.failure)+'</td></tr>').join('')||'<tr><td colspan="4">证据不足 / Insufficient completed daily bars</td></tr>';
  const completeness=data.tradeReview?.historyCompleteness;
  setText('#foot','历史完整性 / History: '+(typeof completeness==='object' ? completeness?.status || 'UNVERIFIED' : completeness || 'UNVERIFIED')+' · B/S = broker fills; ◇ = experimental observations. 不代表订单或收益保证 / No orders or profit guarantee.');
}
document.querySelectorAll('[data-chart]').forEach(button=>button.addEventListener('click',()=>{chartType=button.dataset.chart;document.querySelectorAll('[data-chart]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render(latest)}));
['range','fills','cost','research'].forEach(id=>document.querySelector('#'+id).addEventListener('change',()=>render(latest)));
bind(render);</script></body></html>`;
}

function riskTimelineHtml() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${visualStyles()}</style></head><body><main><header><div><span class="eyebrow">VigilAlpha · History</span><h1>风险变化时间线</h1></div><span id="status" class="pill">—</span></header><p id="summary" class="summary"></p><section class="chart-shell"><svg id="chart" viewBox="0 0 900 300" role="img" aria-labelledby="timeline-title timeline-desc"><title id="timeline-title">保存的组合总值时间线</title><desc id="timeline-desc">只使用 VigilAlpha 实际保存的派生快照。</desc></svg><div id="empty" class="empty hidden">至少需要两个真实保存的快照；不会用当前持仓伪造过去历史。</div></section><section><h2>变化明细</h2><div id="changes" class="change-list"></div></section><p class="foot">仅使用本地追加式派生快照，默认保留 12 个月。</p></main><script>${sharedDataScript()}
function render(data){var points=Array.isArray(data.timeline)?data.timeline:[];var changes=Array.isArray(data.changes)?data.changes:[];document.querySelector('#status').textContent=data.materialChange?'重要变化':'无重要变化';document.querySelector('#summary').textContent='比较状态：'+(data.status||'UNKNOWN')+'；快照数：'+points.length+'。';var svg=document.querySelector('#chart');while(svg.children.length>2)svg.removeChild(svg.lastChild);if(points.length<2){svg.classList.add('hidden');document.querySelector('#empty').classList.remove('hidden')}else{svg.classList.remove('hidden');document.querySelector('#empty').classList.add('hidden');var vals=points.map(function(p){return Number(p.totalValue)}).filter(Number.isFinite),lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals),span=Math.max(hi-lo,1),left=55,right=875,top=24,bottom=255;function x(i){return left+i*(right-left)/Math.max(points.length-1,1)}function y(v){return bottom-(v-lo)/span*(bottom-top)}var d=points.map(function(p,i){return(i?'L':'M')+x(i)+' '+y(Number(p.totalValue))}).join(' ');svg.appendChild((function(){var e=document.createElementNS('http://www.w3.org/2000/svg','path');e.setAttribute('d',d);e.setAttribute('fill','none');e.setAttribute('stroke','#38bdf8');e.setAttribute('stroke-width','3');return e})());points.forEach(function(p,i){var c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',x(i));c.setAttribute('cy',y(Number(p.totalValue)));c.setAttribute('r','5');c.setAttribute('fill','#f8fafc');svg.appendChild(c)})}document.querySelector('#changes').innerHTML=changes.length?changes.map(function(c){return '<article class="change"><strong>'+escapeHtml(c.code||'CHANGE')+(c.symbol?' · '+escapeHtml(c.symbol):'')+'</strong><span>'+escapeHtml(String(c.before))+' → '+escapeHtml(String(c.after))+'</span><em>'+(c.material?'重要':'记录')+'</em></article>'}).join(''):'<div class="empty">没有可报告的变化。</div>'}bind(render);
</script></body></html>`;
}

function visualStyles() {
  return `:root{color-scheme:light dark;--bg:#f5f5f7;--card:#fff;--line:#d4d7dc;--text:#1d1d1f;--muted:#5b616b;--accent:#256487;--warn:#a34c24;--research:#775ba5;--ok:#26704a;--hover:#e9edf1}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}main{max-width:1180px;margin:auto;padding:28px 32px}header,.identity,.toolbar,.metric-strip{display:flex;align-items:center;gap:20px}header{justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:1px solid var(--line)}.identity{gap:12px;min-width:0}.brand{width:42px;height:42px;min-height:0;flex:none;filter:drop-shadow(0 1px 2px #0001)}.eyebrow{font-size:12px;letter-spacing:.08em;color:var(--muted);font-weight:600}h1{font-size:clamp(19px,2.5vw,25px);font-weight:650;letter-spacing:-.035em;line-height:1.25;margin:4px 0}h2{font-size:15px;font-weight:650;margin:0 0 12px}.pill{font-size:12px;border:1px solid var(--line);border-radius:8px;padding:5px 9px;max-width:45%;overflow-wrap:anywhere;color:var(--muted)}.metric-strip{align-items:flex-end;padding:24px 0;justify-content:space-between}.metric-strip small{display:block;font-size:12px;color:var(--muted)}.metric-strip strong{display:block;font-size:clamp(25px,4vw,36px);font-weight:600;letter-spacing:-.04em;font-variant-numeric:tabular-nums}.summary{font-size:13px;max-width:56%;margin:0;color:var(--muted);overflow-wrap:anywhere}.workspace{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:24px}.plot-panel{min-width:0;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px 22px;box-shadow:0 2px 8px #00000003}.plot-heading{display:flex;justify-content:space-between;align-items:baseline;gap:12px}.caption,.foot{color:var(--muted);font-size:12px;line-height:1.6;overflow-wrap:anywhere}.foot{margin-top:20px}.plot-panel>.caption{margin:0 0 8px}.inspector{padding-top:16px;min-width:0}.risk{padding:12px 0;border-top:1px solid var(--line)}.risk strong{font-size:12px;color:var(--warn);overflow-wrap:anywhere}.risk p{font-size:13px;margin:6px 0;color:var(--muted);overflow-wrap:anywhere}.risk-strip{padding:16px 2px;font-size:13px;color:var(--muted);border-bottom:1px solid var(--line)}svg{display:block;width:100%;height:auto}#allocation{min-height:260px}.chart-shell{margin-top:14px;overflow:hidden}.toolbar{justify-content:space-between;flex-wrap:wrap;gap:12px}.segmented{display:flex;padding:3px;border-radius:10px;background:var(--bg);border:1px solid var(--line)}button,select{font:inherit;color:var(--text);cursor:pointer}button{border:0;background:transparent;border-radius:7px;padding:8px 12px;min-height:44px;font-size:13px;transition:background 160ms ease,box-shadow 160ms ease}button[aria-pressed=true]{background:var(--card);box-shadow:0 1px 4px #0002}button:hover{background:var(--hover)}button:active{box-shadow:inset 0 1px 4px #0002}.range{font-size:12px;color:var(--muted)}select{border:1px solid var(--line);border-radius:7px;background:var(--card);padding:8px;min-height:44px;margin-left:8px}.chart-options{justify-content:flex-start;gap:8px 20px;border-top:1px solid var(--line);padding-top:8px}.chart-options label{display:flex;align-items:center;min-height:44px;font-size:12px;cursor:pointer;gap:6px;color:var(--muted)}input{accent-color:var(--accent)}button:focus-visible,select:focus-visible,summary:focus-visible,input:focus-visible{outline:3px solid var(--accent);outline-offset:3px}details{border-bottom:1px solid var(--line);padding:0 2px}summary{cursor:pointer;min-height:52px;padding:16px 0;font-size:14px;font-weight:600}details[open]>.table-wrap,details[open]>p{animation:reveal 180ms ease-out}.table-wrap{overflow:auto;margin-bottom:16px;max-height:420px}table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}th,td{text-align:left;border-bottom:1px solid var(--line);padding:10px 12px;vertical-align:top}th{font-size:12px;font-weight:500;color:var(--muted)}td:first-child{font-weight:550}.empty{padding:72px 20px;text-align:center;color:var(--muted);font-size:14px}.hidden{display:none!important}.change{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}.change em{font-style:normal;color:var(--warn)}.ribbon{transition:opacity 160ms ease}.ribbon:hover{opacity:.7}.price-path{animation:reveal 180ms ease-out}@keyframes reveal{from{opacity:.45;transform:translateY(2px)}to{opacity:1;transform:translateY(0)}}@media(prefers-color-scheme:dark){:root{--bg:#17181b;--card:#202226;--line:#41454c;--text:#f2f3f5;--muted:#b0b6c0;--accent:#86bdd9;--warn:#edac88;--research:#c4a9e8;--ok:#91c8aa;--hover:#34383e}.plot-panel{box-shadow:none}}@media(max-width:800px){.workspace{grid-template-columns:1fr}.inspector{border-top:1px solid var(--line)}#risks{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0 24px}.inspector h2{margin-bottom:0}}@media(max-width:520px){main{padding:18px 14px}header{gap:12px;flex-wrap:wrap}.pill{max-width:100%}.metric-strip{display:block;padding:20px 0}.summary{max-width:100%;margin-top:10px}.plot-panel{padding:14px 10px;border-radius:12px}.toolbar{gap:8px}.chart-shell{margin:12px -6px 0}#allocation{min-height:210px}.plot-heading{display:block}.chart-options{gap:0 10px}.change{flex-direction:column}th,td{padding:9px 8px}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}`;
}

function sharedDataScript() {
  return `${displayNumber.toString()}
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function setText(selector,text){document.querySelector(selector).textContent=text}
function decimal(value){const n=displayNumber(value);return n===null?'—':new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(n)}
function percent(value){const n=displayNumber(value);return n===null?'—':n.toFixed(2)+'%'}
function money(value,currency){const n=displayNumber(value);if(n===null)return '—';if(!currency)return decimal(n)+' (currency unknown)';try{return new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:2}).format(n)}catch{return decimal(n)+' '+escapeHtml(currency)}}
function vetoLabel(active){return active===true?'已触发 / ACTIVE':active===false?'未触发 / CLEAR':'未评估 / UNKNOWN'}
function node(tag,attrs){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs||{}).forEach(([k,v])=>el.setAttribute(k,String(v)));return el}
function plotText(svg,x,y,text,anchor='start',fill='var(--text)'){const el=node('text',{x,y,fill,'text-anchor':anchor,'font-size':12});el.textContent=text;svg.appendChild(el);return el}
function clearPlot(selector){const svg=document.querySelector(selector);while(svg.children.length>2)svg.removeChild(svg.lastChild);return svg}
${normalizeAppToolResult.toString()}
function current(){return normalizeAppToolResult((window.openai&&window.openai.toolOutput)||{})}
function bind(render){function update(){const data=current();let note=document.querySelector('#demo-note');if(data.demo&&!note){note=document.createElement('p');note.id='demo-note';note.className='risk-strip';document.querySelector('main').prepend(note)}if(note){note.hidden=!data.demo;note.textContent='合成演示 / SYNTHETIC DEMO — 所有价格、账户及成交均为示例 / All prices, account values and fills are examples.'}render(data)}update();window.addEventListener('openai:set_globals',update);window.addEventListener('resize',update)}`;
}
