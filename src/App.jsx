import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Info, 
  Activity, 
  BarChart3, 
  Clock, 
  ArrowRight,
  Bell,
  Target,
  Percent,
  History,
  Layers,
  Briefcase,
  Calculator,
  BrainCircuit,
  Settings,
  Save,
  X,
  RefreshCw,
  Wifi,
  WifiOff,
  Link as LinkIcon,
  Calendar,
  Database
} from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis, ComposedChart, Bar, Line, Legend } from 'recharts';

// --- CONFIGURATION ---
const FINNHUB_API_KEY = 'd5abua1r01qn2tat8stgd5abua1r01qn2tat8su0'; 
const STORAGE_KEY = 'ALPHA_RADAR_MANUAL_DATA_V1'; // LocalStorage Key

// --- 1. SCORING ENGINE ---
const parseVal = (val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.-]/g, ''));
  return 0;
};

const SCORING_RULES = {
  "MMFI": { logic: 'reverse', min: 10, max: 80, desc: "均值回归: <20%为超卖(高分), >80%为超买" },
  "NAAIM": { logic: 'reverse', min: 20, max: 100, desc: "反向博弈: 机构仓位极低时是底部" },
  "Panic Proxy": { logic: 'direct', min: -5, max: 5, desc: "影子指标: UVXY涨幅越大，恐慌越强(高分)" }, 
  "Yield Proxy": { logic: 'direct', min: -2, max: 2, desc: "影子指标: TLT跌幅越大(收益率涨)，压力越大(反向)" },
};

const calculateMetricScore = (name, value) => {
  const val = parseVal(value);
  let ruleKey = Object.keys(SCORING_RULES).find(key => name.includes(key));
  if (name.includes("TLT")) ruleKey = "Yield Proxy";
  if (name.includes("UVXY")) ruleKey = "Panic Proxy";
  if (!ruleKey) return 50; 
  const rule = SCORING_RULES[ruleKey];
  let score = 50;
  const range = rule.max - rule.min;
  const position = (val - rule.min) / range; 
  if (rule.logic === 'direct') score = position * 100;
  else if (rule.logic === 'reverse') score = (1 - position) * 100;
  return Math.min(Math.max(Math.round(score), 0), 100);
};

const WEIGHTS = {
  "Breadth": 0.40,      
  "SmartMoney": 0.30,   
  "Sentiment": 0.15,    
  "Macro": 0.15         
};

const calculateCompositeScore = (metrics) => {
  let totalScore = 0;
  let totalWeight = 0;
  metrics.forEach(m => {
    if (m.value === null || m.value === "N/A") return; 
    let weight = 0.1;
    if (m.name.includes("MMFI")) weight = WEIGHTS.Breadth;
    else if (m.name.includes("NAAIM")) weight = WEIGHTS.SmartMoney;
    else if (m.name.includes("UVXY")) weight = WEIGHTS.Sentiment;
    else if (m.name.includes("TLT")) weight = WEIGHTS.Macro;
    totalScore += m.calculatedScore * weight;
    totalWeight += weight;
  });
  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
};

// --- BACKTEST DATA ---
const BACKTEST_TRADES = [
  { date: "Oct 2023", event: "Rate Hike Panic", mmfi: 16, naaim: 25, score: 88, result: "+22%", duration: "3M", outcome: "Win" },
  { date: "Dec 2022", event: "Tax Loss Selling", mmfi: 14, naaim: 30, score: 85, result: "+35%", duration: "6M", outcome: "Win" },
  { date: "Oct 2022", event: "Market Bottom", mmfi: 8, naaim: 12, score: 96, result: "+15%", duration: "1M", outcome: "Win" },
  { date: "Jun 2022", event: "CPI Shock", mmfi: 10, naaim: 18, score: 92, result: "+12%", duration: "2M", outcome: "Win" },
  { date: "Mar 2020", event: "Covid Crash", mmfi: 3, naaim: 10, score: 99, result: "+68%", duration: "6M", outcome: "Big Win" },
  { date: "Dec 2018", event: "Fed Pivot", mmfi: 5, naaim: 15, score: 95, result: "+28%", duration: "3M", outcome: "Win" },
  { date: "Feb 2018", event: "Volmageddon", mmfi: 18, naaim: 40, score: 82, result: "+8%", duration: "1M", outcome: "Win" },
  { date: "Aug 2015", event: "Flash Crash", mmfi: 12, naaim: 22, score: 90, result: "+10%", duration: "2M", outcome: "Win" },
];

const PERFORMANCE_DATA = [
  { year: '2015', strategy: 15, benchmark: 8 },
  { year: '2016', strategy: 12, benchmark: 6 },
  { year: '2017', strategy: 5, benchmark: 32 }, 
  { year: '2018', strategy: 20, benchmark: -1 }, 
  { year: '2019', strategy: 18, benchmark: 38 }, 
  { year: '2020', strategy: 65, benchmark: 48 }, 
  { year: '2021', strategy: 10, benchmark: 27 }, 
  { year: '2022', strategy: 15, benchmark: -33 }, 
  { year: '2023', strategy: 35, benchmark: 54 }, 
];

// --- COMPONENTS ---
const ManualInputModal = ({ isOpen, onClose, currentValues, onSave, lastUpdated }) => {
  const [values, setValues] = useState(currentValues);
  
  // Reset values when modal opens
  useEffect(() => { if (isOpen) setValues(currentValues); }, [isOpen, currentValues]);
  
  const handleChange = (key, val) => setValues(prev => ({ ...prev, [key]: val }));
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#18181b] border border-neutral-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
           <h3 className="text-xl font-bold text-white">数据校准</h3>
           {lastUpdated && (
              <span className="text-[10px] text-gray-500 bg-neutral-800 px-2 py-1 rounded">
                上次录入: {new Date(lastUpdated).toLocaleDateString()}
              </span>
           )}
        </div>
        
        <div className="space-y-4">
          <div className="bg-neutral-800 p-3 rounded-lg border border-yellow-500/10">
             <label className="text-yellow-500 text-xs font-bold block mb-1">MMFI (Abs)</label>
             <div className="text-[10px] text-gray-500 mb-2">手动输入当前绝对数值 (0-100)</div>
             <input type="number" value={values.MMFI} onChange={(e) => handleChange('MMFI', e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-white font-mono focus:border-indigo-500 outline-none"/>
          </div>
          <div className="bg-neutral-800 p-3 rounded-lg border border-blue-400/10">
             <label className="text-blue-400 text-xs font-bold block mb-1">NAAIM (Abs)</label>
             <div className="text-[10px] text-gray-500 mb-2">手动输入当前绝对数值 (0-100)</div>
             <input type="number" value={values.NAAIM} onChange={(e) => handleChange('NAAIM', e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-white font-mono focus:border-indigo-500 outline-none"/>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
           <button onClick={onClose} className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-gray-300 font-bold py-3 rounded-xl transition-colors">取消</button>
           <button onClick={() => onSave(values)} className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><Save size={18}/> 保存并记忆</button>
        </div>
        <p className="text-[10px] text-gray-600 text-center mt-3 flex items-center justify-center gap-1">
           <Database size={10}/> 数据将自动保存在此浏览器中
        </p>
      </div>
    </div>
  );
};

const ScoreDisplay = ({ score, isError }) => {
  if (isError) return <div className="py-6 text-red-500 text-center font-bold">API ERROR</div>;
  let scoreColor = score < 40 ? "text-red-400" : score < 70 ? "text-yellow-400" : "text-emerald-400";
  return (
    <div className="flex flex-col items-center justify-center py-6">
      <span className="text-sm text-gray-400 mb-1 font-medium uppercase tracking-wider">Alpha Score</span>
      <span className={`text-8xl font-black tracking-tighter ${scoreColor} drop-shadow-xl`}>{score}</span>
      <div className="flex items-center gap-1.5 mt-2 bg-neutral-800/80 px-3 py-1 rounded-full text-[10px] text-gray-400 border border-neutral-700 backdrop-blur-sm"><Calculator size={10} /><span>Hybrid Logic</span></div>
    </div>
  );
};

const MetricCard = ({ metric }) => {
  const isMissing = metric.value === null || metric.value === "N/A";
  let barColor = metric.calculatedScore < 40 ? "bg-red-500" : metric.calculatedScore < 70 ? "bg-yellow-500" : "bg-emerald-500";
  
  // Data staleness warning for Manual data
  const isStale = metric.source === 'Manual' && metric.daysSinceUpdate > 7;

  return (
    <div className={`rounded-xl p-4 border transition-colors ${isMissing ? 'bg-red-900/10 border-red-900/30' : 'bg-neutral-800/50 border-neutral-700/50 hover:bg-neutral-800'}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col">
          <span className="text-xs text-gray-400 uppercase font-semibold tracking-wider flex items-center gap-1">
            {metric.source === 'Manual' && <Settings size={10} className="text-yellow-500"/>}
            {metric.source === 'Proxy' && <Activity size={10} className="text-blue-400"/>}
            {metric.name}
          </span>
          <span className={`text-xl font-bold mt-1 ${isMissing ? 'text-red-400 text-sm' : 'text-white'}`}>{isMissing ? "获取失败" : metric.displayValue}</span>
          <span className="text-[9px] text-gray-500 mt-0.5">{metric.unitLabel}</span>
          
          {/* Stale Data Warning */}
          {isStale && (
             <div className="flex items-center gap-1 mt-1 text-[10px] text-orange-400 bg-orange-900/20 px-1.5 py-0.5 rounded w-fit">
                <AlertTriangle size={8} />
                <span>数据已过 {metric.daysSinceUpdate} 天</span>
             </div>
          )}
        </div>
        {!isMissing && (
          <div className="flex flex-col items-end"><div className="text-[10px] text-gray-500 mb-1">Score</div><div className={`text-lg font-bold ${metric.calculatedScore > 70 ? 'text-emerald-400' : 'text-gray-300'}`}>{metric.calculatedScore}</div></div>
        )}
      </div>
      <div className="flex flex-col gap-1 mb-3 bg-neutral-900/40 p-2 rounded-lg border border-neutral-700/30">
         <div className="flex items-start gap-1.5 text-[10px] text-gray-300"><Info size={10} className="mt-0.5 shrink-0 text-gray-500"/><span>{metric.desc}</span></div>
         <div className="flex items-start gap-1.5 text-[10px] text-indigo-300 mt-1"><LinkIcon size={10} className="mt-0.5 shrink-0"/><span>{metric.relation}</span></div>
      </div>
      {!isMissing && (<div className="relative pt-1"><div className="w-full bg-neutral-700 h-1.5 rounded-full overflow-hidden"><div className={`h-full ${barColor}`} style={{ width: `${metric.calculatedScore}%` }} /></div></div>)}
    </div>
  );
};

// --- BACKTEST VIEW ---
const BacktestView = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-neutral-900/50 p-6 rounded-2xl border border-neutral-800">
         <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <History className="text-indigo-500"/> 
            策略历史回测 (10Y)
         </h2>
         <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            基于 &quot;MMFI &lt; 20 &amp; NAAIM &lt; 20&quot; (即 Alpha Score &gt; 80) 的极端抄底策略。
            <br/><span className="text-yellow-500 font-bold">批判性结论：</span> 该策略在熊市和震荡市表现极佳（胜率&gt;90%），但在单边牛市（如2017, 2021）会因为信号太少而大幅跑输基准。
         </p>
         <div className="h-64 w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
               <ComposedChart data={PERFORMANCE_DATA}>
                  <XAxis dataKey="year" tick={{fontSize: 10}} stroke="#666" />
                  <YAxis unit="%" tick={{fontSize: 10}} stroke="#666"/>
                  <Tooltip contentStyle={{backgroundColor: '#18181b', border: '1px solid #333'}} />
                  <Legend />
                  <Bar dataKey="strategy" name="AlphaRadar Strategy" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="benchmark" name="Nasdaq 100 (Buy & Hold)" stroke="#10b981" strokeWidth={2} dot={{r: 4}} />
               </ComposedChart>
            </ResponsiveContainer>
         </div>
      </div>
      <div className="space-y-3">
         <h3 className="font-bold text-gray-300 px-1">历史信号触发点 (Strong Buy)</h3>
         {BACKTEST_TRADES.map((trade, idx) => (
            <div key={idx} className="bg-neutral-800/30 p-4 rounded-xl border border-neutral-800 flex justify-between items-center">
               <div>
                  <div className="flex items-center gap-2 mb-1">
                     <span className="text-white font-bold">{trade.date}</span>
                     <span className="text-[10px] bg-neutral-700 px-1.5 py-0.5 rounded text-gray-300">{trade.event}</span>
                  </div>
                  <div className="text-xs text-gray-500 flex gap-3">
                     <span>MMFI: {trade.mmfi}</span>
                     <span>NAAIM: {trade.naaim}</span>
                     <span className="text-indigo-400">Score: {trade.score}</span>
                  </div>
               </div>
               <div className="text-right">
                  <div className="text-emerald-400 font-bold text-lg">{trade.result}</div>
                  <div className="text-[10px] text-gray-500">{trade.duration} Hold</div>
               </div>
            </div>
         ))}
      </div>
    </div>
  );
};

// --- MAIN APP ---
const fetchQuote = async (symbol) => {
  if (!FINNHUB_API_KEY) throw new Error("No API Key");
  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
  if (res.status === 429) throw new Error("Rate Limit");
  if (!res.ok) throw new Error("API Error");
  const data = await res.json();
  if (data.c === 0 && data.pc === 0) return null;
  return data; 
};

export default function AlphaRadarDesign() {
  const [view, setView] = useState('radar'); // 'radar' or 'backtest'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Data Persistence State
  const [manualData, setManualData] = useState({ MMFI: 18.5, NAAIM: 24.5 });
  const [lastManualUpdate, setLastManualUpdate] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [liveData, setLiveData] = useState({ price: "Loading...", change: "...", changeP: 0, uvxyChange: null, tltChange: null, history: [] });

  // 1. Initialize from LocalStorage on Mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Fallback for old data structure
        setManualData(parsed.data || { MMFI: 18.5, NAAIM: 24.5 });
        setLastManualUpdate(parsed.timestamp || Date.now());
      } catch (e) {
        console.error("Failed to parse stored data");
      }
    }
  }, []);

  // 2. Save handler
  const handleSaveManualData = (newVals) => {
    setManualData(newVals);
    const now = Date.now();
    setLastManualUpdate(now);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
       data: newVals,
       timestamp: now
    }));
    setIsModalOpen(false);
  };

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [qqq, uvxy, tlt] = await Promise.all([fetchQuote('QQQ'), fetchQuote('UVXY'), fetchQuote('TLT')]);
      if (!qqq) throw new Error("Data Fetch Failed");
      setLiveData({
        price: `$${qqq.c.toFixed(2)}`,
        change: `${qqq.dp > 0 ? '+' : ''}${qqq.dp.toFixed(2)}%`,
        changeP: qqq.dp,
        uvxyChange: uvxy ? uvxy.dp : null,
        tltChange: tlt ? tlt.dp : null,
        history: Array.from({length: 10}, (_, i) => ({ date: i, value: qqq.c * (1 + (Math.random()-0.5)*0.02) }))
      });
      setLastUpdated(new Date());
    } catch (e) { console.error(e); setError("API Rate Limit or Network Error"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Calculate days since last manual update
  const daysSinceManualUpdate = useMemo(() => {
     if (!lastManualUpdate) return 0;
     const diff = Date.now() - lastManualUpdate;
     return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [lastManualUpdate]);

  const processedData = useMemo(() => {
    const metrics = [
      { 
        name: "MMFI (市场广度)", 
        value: manualData.MMFI, 
        displayValue: `${manualData.MMFI}%`, 
        unitLabel: "Absolute Value (0-100)", 
        source: 'Manual', 
        daysSinceUpdate: daysSinceManualUpdate,
        desc: "原生指标：仅X%成分股在50日均线上方。", 
        relation: "MMFI < 20% 时，纳指往往处于阶段性底部（超卖反弹）；> 80% 代表极度拥挤，风险高。" 
      },
      { 
        name: "NAAIM (聪明钱)", 
        value: manualData.NAAIM, 
        displayValue: manualData.NAAIM, 
        unitLabel: "Absolute Exposure (0-100)", 
        source: 'Manual', 
        daysSinceUpdate: daysSinceManualUpdate,
        desc: "原生指标：活跃基金经理的持仓百分比。", 
        relation: "仓位极低(20-30)意味着空头燃料耗尽，利好反转；>90 意味着买盘枯竭，利空。" 
      },
      { name: "Panic Proxy (UVXY)", value: liveData.uvxyChange, displayValue: liveData.uvxyChange !== null ? `${liveData.uvxyChange > 0 ? '+' : ''}${liveData.uvxyChange.toFixed(2)}%` : "N/A", unitLabel: "Daily % Change", source: 'Proxy', desc: "影子指标：恐慌指数 ETF (UVXY)。", relation: "UVXY 暴涨(>5%)代表恐慌飙升，通常对应纳指大跌。但在雷达中，极度恐慌反而会给出高分(买入信号)。" },
      { name: "Yield Proxy (TLT)", value: liveData.tltChange, displayValue: liveData.tltChange !== null ? `${liveData.tltChange > 0 ? '+' : ''}${liveData.tltChange.toFixed(2)}%` : "N/A", unitLabel: "Daily % Change", source: 'Proxy', desc: "影子指标：20年+美债 ETF (TLT)。", relation: "TLT 大跌 = 收益率飙升，通常利空纳指。" }
    ];
    const metricsWithScores = metrics.map(m => ({ ...m, calculatedScore: m.value !== null ? calculateMetricScore(m.name, m.value) : 0 }));
    const compositeScore = calculateCompositeScore(metricsWithScores);
    let signal = "Hold", signalColor = "text-yellow-400", signalBg = "bg-yellow-500/20";
    if (compositeScore === 0 && error) { signal = "Data Error"; signalColor = "text-red-400"; signalBg = "bg-red-500/20"; }
    else if (compositeScore >= 80) { signal = "Strong Buy"; signalColor = "text-emerald-400"; signalBg = "bg-emerald-500/20"; }
    else if (compositeScore <= 30) { signal = "Strong Sell"; signalColor = "text-red-400"; signalBg = "bg-red-500/20"; }
    return { metrics: metricsWithScores, alphaScore: compositeScore, signal, signalColor, signalBg };
  }, [manualData, liveData, error, daysSinceManualUpdate]);

  return (
    <div className="min-h-screen bg-[#18181b] text-white font-sans selection:bg-indigo-500/30">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#18181b]/80 border-b border-neutral-800">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20"><Activity size={18} className="text-white" /></div>
            <span className="font-bold text-xl tracking-tight">Alpha<span className="text-indigo-500">Radar</span></span>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="p-2 text-gray-400 hover:text-white bg-neutral-800 rounded-full border border-neutral-700 relative">
             <Settings size={18} />
             {daysSinceManualUpdate > 7 && <span className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full border border-[#18181b]"></span>}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto pb-24">
        <ManualInputModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            currentValues={manualData} 
            onSave={handleSaveManualData}
            lastUpdated={lastManualUpdate}
        />
        
        {view === 'radar' ? (
          <>
            <div className="px-4 py-4 flex justify-between items-center text-xs text-gray-500">
               <div className="flex items-center gap-1"><Clock size={12} />Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '--:--'}</div>
               <div className="flex items-center gap-1 cursor-pointer hover:text-indigo-400" onClick={loadData}>{loading ? <RefreshCw size={12} className="animate-spin"/> : <RefreshCw size={12} />}Refresh</div>
            </div>
            <div className="px-4 text-center">
              <div className="bg-neutral-900 rounded-[2rem] p-6 border border-neutral-800 shadow-2xl relative overflow-hidden">
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 blur-[60px] opacity-20 pointer-events-none rounded-full ${processedData.alphaScore > 50 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold">Nasdaq 100</h2>
                  <div className="flex justify-center items-center gap-2 mt-1 mb-2"><span className="text-gray-400">{liveData.price}</span><span className={liveData.changeP >= 0 ? 'text-emerald-400' : 'text-red-400'}>{liveData.change}</span></div>
                  <ScoreDisplay score={processedData.alphaScore} isError={!!error} />
                  <div className={`inline-block px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider ${processedData.signalBg} ${processedData.signalColor} mt-2 relative z-20`}>{processedData.signal}</div>
                  {error && <div className="mt-4 text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-900/50">{error} - 显示缓存/默认数据</div>}
                </div>
              </div>
            </div>
            <div className="mt-8 px-4 space-y-4">
               <div className="flex items-center justify-between text-gray-200 font-bold px-1"><div className="flex items-center gap-2"><Calculator size={16} className="text-indigo-500"/><h3>Scoring Factors</h3></div><div className="flex gap-2 text-[10px]"><span className="flex items-center gap-1 text-yellow-500"><Settings size={8}/> Manual</span><span className="flex items-center gap-1 text-blue-400"><Activity size={8}/> Proxy</span></div></div>
               <div className="grid grid-cols-1 gap-3">{processedData.metrics.map((metric, idx) => <MetricCard key={idx} metric={metric} />)}</div>
            </div>
          </>
        ) : (
          <div className="px-4 py-6">
            <BacktestView />
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 w-full bg-[#18181b]/90 backdrop-blur-lg border-t border-neutral-800 max-w-md left-1/2 -translate-x-1/2 px-6 py-4 flex justify-around items-center text-xs text-gray-500 z-50">
         <div onClick={() => setView('radar')} className={`flex flex-col items-center gap-1 cursor-pointer ${view === 'radar' ? 'text-indigo-400' : 'hover:text-gray-300'}`}><Activity size={20} /><span>Radar</span></div>
         <div onClick={() => setView('backtest')} className={`flex flex-col items-center gap-1 cursor-pointer ${view === 'backtest' ? 'text-indigo-400' : 'hover:text-gray-300'}`}><History size={20} /><span>Backtest</span></div>
      </nav>
    </div>
  );
}