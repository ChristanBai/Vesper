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

function portfolioFlowHtml() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${visualStyles()}</style></head>
<body><main><header><div><span class="eyebrow">VigilAlpha · Portfolio</span><h1>资金与风险流向</h1></div><span id="cutoff" class="pill">数据时间未知</span></header><p id="summary" class="summary"></p><section class="flow"><div class="account node"><small>账户 / Account</small><strong id="total">—</strong><span id="currency"></span></div><div id="positions" class="positions"></div><div id="risks" class="risks"></div></section><section><h2>可访问表格 / Accessible table</h2><div class="table-wrap"><table><thead><tr><th>持仓</th><th>市值</th><th>权重</th><th>风险状态</th></tr></thead><tbody id="rows"></tbody></table></div></section><p class="foot">图形只使用当前账户事实。ETF 没有带日期的成分证据时不会穿透。</p></main>
<script>${sharedDataScript()}
function money(v,c){return Number.isFinite(Number(v))?new Intl.NumberFormat(undefined,{style:'currency',currency:c||'GBP',maximumFractionDigits:2}).format(Number(v)):'—'}
function render(data){var positions=Array.isArray(data.positions)?data.positions:(Array.isArray(data.topPositions)?data.topPositions:[]);var veto=data.riskVeto||{reasons:[]};document.querySelector('#cutoff').textContent=data.sourceCutoff?'截止 '+data.sourceCutoff:'数据时间未知';document.querySelector('#total').textContent=money(data.summary&&data.summary.totalValue,data.summary&&data.summary.currency);document.querySelector('#currency').textContent=data.summary&&data.summary.currency||'';document.querySelector('#summary').textContent='研究状态：'+(data.signalLabel||data.signal||'未知')+'；风险否决：'+(veto.active?'已触发':'未触发')+'。';var max=Math.max.apply(null,positions.map(function(p){return Number(p.weightPercent)||0}).concat([1]));document.querySelector('#positions').innerHTML=positions.length?positions.map(function(p){var w=Number(p.weightPercent)||0;return '<div class="position node"><div><strong>'+escapeHtml(p.symbol||'—')+'</strong><span>'+w.toFixed(2)+'%</span></div><div class="bar"><i style="width:'+Math.max(2,w/max*100)+'%"></i></div><small>'+money(p.marketValue,p.currency||data.summary.currency)+'</small></div>'}).join(''):'<div class="empty">暂无持仓数据</div>';var reasons=Array.isArray(veto.reasons)?veto.reasons:[];if(data.lookthrough&&data.lookthrough.unknownNodeCount){reasons=reasons.concat([{code:'ETF_UNKNOWN',message:data.lookthrough.unknownNodeCount+' 个 ETF 缺少带日期的成分证据，未进行穿透。'}])}document.querySelector('#risks').innerHTML=reasons.length?reasons.map(function(r){return '<div class="risk node"><strong>'+escapeHtml(r.code||'RISK')+'</strong><span>'+escapeHtml(r.message||'')+'</span></div>'}).join(''):'<div class="risk node clear"><strong>NO VETO</strong><span>当前未触发不可隐藏的风险否决。</span></div>';document.querySelector('#rows').innerHTML=positions.map(function(p){var related=reasons.filter(function(r){return String(r.message||'').indexOf(p.symbol||'')>=0}).map(function(r){return r.code}).join(', ')||'—';return '<tr><td>'+escapeHtml(p.symbol||'—')+'</td><td>'+money(p.marketValue,p.currency||data.summary.currency)+'</td><td>'+Number(p.weightPercent||0).toFixed(2)+'%</td><td>'+escapeHtml(related)+'</td></tr>'}).join('')||'<tr><td colspan="4">暂无可用数据</td></tr>'}bind(render);
</script></body></html>`;
}

function holdingChartHtml() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${visualStyles()}</style></head>
<body><main><header><div><span class="eyebrow">VigilAlpha · Holding</span><h1 id="title">持仓 K 线</h1></div><span id="signal" class="pill">—</span></header><p id="summary" class="summary"></p><section class="chart-shell"><svg id="chart" viewBox="0 0 900 360" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">持仓价格、成本线与真实买卖点</title><desc id="chart-desc">绿色与红色蜡烛同时用上涨下跌文字和表格说明；B/S 表示真实历史买卖点。</desc></svg><div id="empty" class="empty hidden">行情不可用；不会绘制假 K 线。</div></section><div class="legend"><span><i class="up"></i>上涨 Up</span><span><i class="down"></i>下跌 Down</span><span>— 平均成本</span><span>B/S 真实买/卖</span></div><section><h2>条件研究：进入、退出与失效</h2><p>以下是实验规则，权重为零；与 B/S 真实成交分开。信号在已完成日期观察，最早下一根 K 线模拟。</p><div class="table-wrap"><table><thead><tr><th>规则 / 状态</th><th>进入条件</th><th>退出条件</th><th>失效场景</th></tr></thead><tbody id="researchRows"></tbody></table></div></section><section><h2>证据与最近成交</h2><div class="table-wrap"><table><thead><tr><th>时间</th><th>类型</th><th>价格</th><th>数量</th></tr></thead><tbody id="rows"></tbody></table></div></section><p class="foot" id="foot"></p></main>
<script>${sharedDataScript()}
var NS='http://www.w3.org/2000/svg';function n(tag,attrs){var el=document.createElementNS(NS,tag);Object.keys(attrs||{}).forEach(function(k){el.setAttribute(k,String(attrs[k]))});return el}function num(v){if(v===null||v===undefined||v==='')return null;var x=Number(v);return Number.isFinite(x)?x:null}function render(data){var holding=data.holding||{};var chartData=data.chart||{};var bars=(Array.isArray(chartData.bars)?chartData.bars:[]).slice(-120);var markers=Array.isArray(chartData.executionMarkers)?chartData.executionMarkers:[];document.querySelector('#title').textContent=(holding.symbol||'持仓')+' K 线与成本';document.querySelector('#signal').textContent=data.signal||'WATCH';document.querySelector('#summary').textContent='权重 '+(num(holding.weightPercent)===null?'—':num(holding.weightPercent).toFixed(2)+'%')+'；风险否决 '+(data.riskVeto&&data.riskVeto.active===null?'未评估':data.riskVeto&&data.riskVeto.active?'已触发':'未触发')+'；行情来源 '+escapeHtml(data.evidence&&data.evidence.market&&data.evidence.market.source||'不可用')+'。';document.querySelector('#empty').textContent=chartData.status==='NOT_REQUESTED'?'图表未请求；需要图表时启用 includeChart。':'行情不可用；不会绘制假 K 线。';var svg=document.querySelector('#chart');while(svg.children.length>2)svg.removeChild(svg.lastChild);if(!bars.length){svg.classList.add('hidden');document.querySelector('#empty').classList.remove('hidden')}else{svg.classList.remove('hidden');document.querySelector('#empty').classList.add('hidden');var values=[];bars.forEach(function(b){['open','high','low','close'].forEach(function(k){var v=num(b[k]);if(v!==null)values.push(v)})});var cost=num(chartData.averageCost);if(cost!==null)values.push(cost);var lo=Math.min.apply(null,values),hi=Math.max.apply(null,values),span=Math.max(hi-lo,1),left=50,right=880,top=24,bottom=320,step=(right-left)/Math.max(bars.length,1);function y(v){return bottom-(v-lo)/span*(bottom-top)}bars.forEach(function(b,i){var o=num(b.open),h=num(b.high),l=num(b.low),c=num(b.close);if([o,h,l,c].some(function(v){return v===null}))return;var x=left+i*step+step/2,up=c>=o,color=up?'#38bdf8':'#f97316';svg.appendChild(n('line',{x1:x,y1:y(h),x2:x,y2:y(l),stroke:color,'stroke-width':1}));svg.appendChild(n('rect',{x:x-Math.max(1,step*.28),y:Math.min(y(o),y(c)),width:Math.max(2,step*.56),height:Math.max(2,Math.abs(y(o)-y(c))),fill:color}));});if(cost!==null){svg.appendChild(n('line',{x1:left,y1:y(cost),x2:right,y2:y(cost),stroke:'#f8fafc','stroke-width':1.5,'stroke-dasharray':'8 5'}));var label=n('text',{x:left+4,y:y(cost)-6,fill:'#f8fafc','font-size':12});label.textContent='平均成本 '+cost.toFixed(2);svg.appendChild(label)}markers.forEach(function(m){var t=Date.parse(m.timestamp||m.time||''),idx=bars.findIndex(function(b){return Date.parse(b.time||b.timestamp||'')>=t});if(idx<0)return;var price=num(m.executionPrice||m.price);if(price===null)return;var text=n('text',{x:left+idx*step+step/2,y:y(price)+(m.side==='BUY'?18:-8),fill:m.side==='BUY'?'#38bdf8':'#f97316','font-size':13,'font-weight':800,'text-anchor':'middle'});text.textContent=m.side==='BUY'?'B':'S';svg.appendChild(text)})}document.querySelector('#rows').innerHTML=markers.slice(-20).reverse().map(function(m){return '<tr><td>'+escapeHtml(m.timestamp||m.time||'—')+'</td><td>'+escapeHtml(m.side||'—')+'</td><td>'+escapeHtml(String(m.executionPrice||m.price||'—'))+'</td><td>'+escapeHtml(String(m.quantity||'—'))+'</td></tr>'}).join('')||'<tr><td colspan="4">没有可验证的成交标记</td></tr>';document.querySelector('#researchRows').innerHTML=((data.conditionalResearch&&data.conditionalResearch.rules)||[]).map(function(r){return '<tr><td>'+escapeHtml(r.patternId+' / '+r.state)+'</td><td>'+escapeHtml(r.enter)+'</td><td>'+escapeHtml(r.exit)+'</td><td>'+escapeHtml(r.failure)+'</td></tr>'}).join('')||'<tr><td colspan="4">没有足够的已完成日线；不生成候选方向。</td></tr>';document.querySelector('#foot').textContent='历史完整性：'+(data.tradeReview&&data.tradeReview.historyCompleteness||'UNVERIFIED')+'。图表是研究证据，不是订单。'}bind(render);
</script></body></html>`;
}

function riskTimelineHtml() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${visualStyles()}</style></head><body><main><header><div><span class="eyebrow">VigilAlpha · History</span><h1>风险变化时间线</h1></div><span id="status" class="pill">—</span></header><p id="summary" class="summary"></p><section class="chart-shell"><svg id="chart" viewBox="0 0 900 300" role="img" aria-labelledby="timeline-title timeline-desc"><title id="timeline-title">保存的组合总值时间线</title><desc id="timeline-desc">只使用 VigilAlpha 实际保存的派生快照。</desc></svg><div id="empty" class="empty hidden">至少需要两个真实保存的快照；不会用当前持仓伪造过去历史。</div></section><section><h2>变化明细</h2><div id="changes" class="change-list"></div></section><p class="foot">仅使用本地追加式派生快照，默认保留 12 个月。</p></main><script>${sharedDataScript()}
function render(data){var points=Array.isArray(data.timeline)?data.timeline:[];var changes=Array.isArray(data.changes)?data.changes:[];document.querySelector('#status').textContent=data.materialChange?'重要变化':'无重要变化';document.querySelector('#summary').textContent='比较状态：'+(data.status||'UNKNOWN')+'；快照数：'+points.length+'。';var svg=document.querySelector('#chart');while(svg.children.length>2)svg.removeChild(svg.lastChild);if(points.length<2){svg.classList.add('hidden');document.querySelector('#empty').classList.remove('hidden')}else{svg.classList.remove('hidden');document.querySelector('#empty').classList.add('hidden');var vals=points.map(function(p){return Number(p.totalValue)}).filter(Number.isFinite),lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals),span=Math.max(hi-lo,1),left=55,right=875,top=24,bottom=255;function x(i){return left+i*(right-left)/Math.max(points.length-1,1)}function y(v){return bottom-(v-lo)/span*(bottom-top)}var d=points.map(function(p,i){return(i?'L':'M')+x(i)+' '+y(Number(p.totalValue))}).join(' ');svg.appendChild((function(){var e=document.createElementNS('http://www.w3.org/2000/svg','path');e.setAttribute('d',d);e.setAttribute('fill','none');e.setAttribute('stroke','#38bdf8');e.setAttribute('stroke-width','3');return e})());points.forEach(function(p,i){var c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',x(i));c.setAttribute('cy',y(Number(p.totalValue)));c.setAttribute('r','5');c.setAttribute('fill','#f8fafc');svg.appendChild(c)})}document.querySelector('#changes').innerHTML=changes.length?changes.map(function(c){return '<article class="change"><strong>'+escapeHtml(c.code||'CHANGE')+(c.symbol?' · '+escapeHtml(c.symbol):'')+'</strong><span>'+escapeHtml(String(c.before))+' → '+escapeHtml(String(c.after))+'</span><em>'+(c.material?'重要':'记录')+'</em></article>'}).join(''):'<div class="empty">没有可报告的变化。</div>'}bind(render);
</script></body></html>`;
}

function visualStyles() {
  return `:root{color-scheme:dark;--bg:#020617;--card:#0e1223;--line:#334155;--text:#f8fafc;--muted:#a8b5c7;--accent:#38bdf8;--warn:#f97316;--ok:#22c55e}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1100px;margin:auto;padding:22px}header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.eyebrow{color:var(--accent);font-weight:800;letter-spacing:.08em;text-transform:uppercase}h1{font-size:24px;margin:4px 0}h2{font-size:16px;margin:24px 0 10px}.pill{padding:6px 10px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-variant-numeric:tabular-nums}.summary,.foot{color:var(--muted)}.flow{display:grid;grid-template-columns:minmax(150px,.7fr) minmax(260px,1.5fr) minmax(220px,1fr);gap:14px;align-items:start}.node,.chart-shell,.change{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:14px}.account{display:grid;gap:4px}.account strong{font-size:22px}.positions,.risks,.change-list{display:grid;gap:10px}.position>div:first-child{display:flex;justify-content:space-between}.bar{height:8px;border-radius:999px;background:#1e293b;overflow:hidden;margin:8px 0}.bar i{display:block;height:100%;background:var(--accent)}.risk{display:grid;gap:4px;border-left:3px solid var(--warn)}.risk.clear{border-left-color:var(--ok)}.chart-shell{min-height:260px;padding:8px;overflow:hidden}svg{width:100%;height:auto;min-height:240px}.legend{display:flex;gap:16px;flex-wrap:wrap;margin:10px 0;color:var(--muted)}.legend i{display:inline-block;width:10px;height:10px;margin-right:5px}.up{background:var(--accent)}.down{background:var(--warn)}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px}table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-size:12px}.change{display:grid;grid-template-columns:1fr auto auto;gap:12px}.change em{color:var(--warn);font-style:normal}.empty{padding:24px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:12px}.hidden{display:none!important}@media(max-width:720px){main{padding:16px}.flow{grid-template-columns:1fr}header{display:grid}.change{grid-template-columns:1fr}.chart-shell{min-height:220px}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;
}

function sharedDataScript() {
  return `function escapeHtml(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'})[c]})}function current(){return(window.openai&&window.openai.toolOutput)||{}}function bind(render){render(current());window.addEventListener('openai:set_globals',function(){render(current())})}`;
}
