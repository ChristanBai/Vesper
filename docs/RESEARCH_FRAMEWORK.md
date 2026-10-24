# Research framework / 投资研究框架

Checked / 核验日期: 2026-10-24. This is a candidate framework, not a validated investment model.
这是候选方法框架，不能将论文中的总体结果直接变成某只股票的盈利承诺。

## The decision process / 决策过程

Three technical rules describe price states; they do not determine valuation, suitability or position size.
三类技术规则只描述价格状态，不负责公司估值、客户适配或仓位预算。不同维度不可简单投票成为胜率。

| Layer / 层 | Inputs and decision / 输入与决策 | Current product / 当前状态 |
|---|---|---|
| Identity / 证券身份 | Exchange, currency, share class, corporate actions / 交易所、币种、类别、复权 | Input/provenance checks; cross-venue matching still needs acceptance / 部分实现 |
| Macro / 宏观 | Known schedule, expectations before release, actual surprise, sector channels / 排期、事前预期、公布意外、行业传导 | Dated official calendar implemented; surprise estimator absent / 日历已实现，意外模型未实现 |
| Business & value / 公司与估值 | Dated filings, cash flow, leverage, valuation scenarios / 财报、现金流、负债、估值情景 | Not a complete live fundamental model / 尚无完整实时基本面模型 |
| Long horizon / 长线 | 6–12 month relative or own returns, valuation and portfolio context / 中长期动量、估值、组合约束 | Candidate families; RSI is not academic momentum / 候选研究，不能与RSI等同 |
| Daily setup / 日线 | Completed daily trend, price/volume, invalidation / 已完成日线、价量、失效 | Three experimental shared-core rules; zero production weight / 三类已实现、生产权重零 |
| Implementation / 模拟执行 | Earliest next bar, gaps, spread, slippage, FX, costs / 下一根、跳空、价差、滑点、汇兑 | Existing historical simulation is limited; no broker execution / 模拟有限，不下单 |
| Portfolio / 仓位 | Liquidity, correlations, risk budget, current concentration / 流动性、相关性、预算、集中度 | Risk veto and conditional reduce plan; missing inputs abstain / 风险否决及条件减风险，缺失弃权 |
| Exit & review / 退出复核 | Thesis invalidation, rule exit, event change, time review / 逻辑失效、规则退出、事件变化、定期复核 | Candidate conditions visible; company thesis engine absent / 条件可见，公司逻辑引擎待建 |

Suggested cadence, not a fitted parameter / 建议工作频率，非优化参数：
company thesis after filings/material news; macro review before/after scheduled releases; daily rules
after completed sessions; monthly portfolio review. Intraday trading requires different data and validation.
财报与重大消息后复核公司，事件前后核对预期与事实，收盘后评价日线，每月复核组合。
周/月视图是上下文，不把同一价格序列的多个周期当成独立证据。

## Primary-source receipts / 原始来源记录

Six core sources below, plus one chronology extension. Reading depth is explicit; no full-text copies
are redistributed. 两篇 PDF 有限阅读摘要/方法，其余为出版机构摘要；不是全部精读或复现实验。

| Source / 来源 | Date and read depth / 日期与阅读深度 | Applicable lesson / 可用结论与限制 |
|---|---|---|
| [Lo, Mamaysky & Wang, Foundations of Technical Analysis](https://www.mit.edu/~wangj/pap/LoMamayskyWang00.pdf) | Journal of Finance, Aug 2000; abstract and opening methodology / 摘要与开篇方法 | Define patterns algorithmically and test conditional distributions; U.S. historical equities, not a net-return or single-stock timing guarantee / 算法化形态与条件分布，不是盈利保证 |
| [Moskowitz, Ooi & Pedersen, Time Series Momentum](https://www.aqr.com/Insights/Research/Journal-Article/Time-Series-Momentum) | May 2012; publisher summary / 出版摘要 | Own past returns across futures/forwards; not interchangeable with cross-sectional ranks or RSI14 / 跨资产期货证据不能直接迁移为单股RSI规则 |
| [Asness, Moskowitz & Pedersen, Value and Momentum Everywhere](https://www.aqr.com/insights/research/journal-article/value-and-momentum-everywhere) | Jun 2013; publisher summary / 出版摘要 | Valuation and momentum can provide distinct exposures; shared liquidity risks remain; not arbitrary equal voting / 估值与动量需分开，仍有共同风险 |
| [Daniel & Moskowitz, Momentum Crashes](https://www.nber.org/papers/w20439) | NBER 2014, JFE 2016; bibliographic/search abstract only, direct access 403 / 仅书目信息，正文未读 | Crash risk is a research question; this receipt does not establish a crash predictor / 不能据此声称已有崩盘预测。Corrects prior mistaken w20660 link / 更正错误编号 |
| [Bernanke & Kuttner, Stock Market Reaction to Fed Policy](https://www.newyorkfed.org/research/staff_reports/sr174.html) | Staff Report 174, 2003; official abstract / 官方摘要 | Study unexpected policy changes, not simply calendar dates or hike/cut labels / 关键是意外部分，不能把加息标签机械映射涨跌 |
| [Bailey et al., Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf) | Revision Feb 27, 2015; abstract and introduction / 摘要及引言 | Track all attempted variants and selection risk; a good selected backtest is insufficient / 记录所有试验，避免挑赢家。PBO/CSCV is not currently implemented / 尚未实现 |
| [Hurst, Ooi & Pedersen, Century of Trend Following](https://www.aqr.com/Insights/Research/Journal-Article/A-Century-of-Evidence-on-Trend-Following-Investing) | Oct 31, 2017; publisher summary / 出版摘要 | Long historical cross-asset context; not direct validation of a Trading 212 stock / 长历史跨资产背景，不是本产品单股验证 |

## Promotion experiment / 下一步验证实验

1. Freeze a security universe, instrument identity and point-in-time data manifest, including delisted names.
   冻结证券池、身份与时点数据，保留退市样本；目前未完成。
2. Define one horizon and entry/exit protocol per rule before testing. Compare buy-and-hold, cash and
   simple trend baselines. Avoid substituting hypothetical short/futures implementation for a long-only account.
   先定义周期和进入退出，再与持有、现金和简单趋势比较；现货账户不照搬期货/做空结果。
3. Use time-ordered untouched windows and record every threshold attempt. Purge overlapping labels when
   needed; report turnover, drawdown, exposure, abstention, costs, FX and parameter sensitivity.
   时间顺序样本外验证，记录全部参数尝试及交易成本，不只报告命中率。
4. Model gaps and adverse fills; a stop level does not cap overnight loss. Keep volatility risk distinct
   from return prediction. 财报跳空与滑点可突破止损预算；低波动不等于上涨概率高。
5. Collect prospective shadow outcomes without rewriting old forecasts; retain human promotion and
   rollback. Existing minimum observation gates are necessary internal conditions, not proof of profit.
   前瞻影子观察不改历史预测，人工晋级与回滚仍保留。

No new numerical weights, production rules or trading permissions are activated by this document.
本文件不激活新权重、生产规则或交易权限。Current gaps: full fundamentals, valuation, volatility sizing,
cross-market licensing and real customer-host acceptance / 当前缺口：基本面、估值、波动预算、授权与真实宿主验收。
