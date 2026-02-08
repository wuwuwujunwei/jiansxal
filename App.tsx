
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Activity, 
  Settings, 
  Scale, 
  Moon, 
  Heart, 
  PlusCircle, 
  BarChart2, 
  User, 
  Ruler, 
  CheckCircle2, 
  ShieldAlert, 
  Trash2,
  Camera,
  History,
  Pizza,
  Zap,
  Target,
  AlertCircle,
  TrendingUp,
  Check,
  ChevronDown
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from 'recharts';
import { AppState, DailyLog, WeeklyCheckIn, WarningLevel, StatusAlert } from './types';
import { INITIAL_STATE, STORAGE_KEY, MACRO_CALORIES, MAX_HISTORY_DAYS, SCENARIO_MODES } from './constants';
import { calculateBMI, calculateTDEEValue, getStatusAlert, adjustMacrosPriority, getMacroGramsFromPct, cleanupOldLogs, getAvgRHR } from './utils';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_STATE;
    } catch (e) {
      return INITIAL_STATE;
    }
  });
  const [view, setView] = useState<'dashboard' | 'logs' | 'nutrition' | 'history' | 'settings'>('dashboard');
  const [activeLogTab, setActiveLogTab] = useState<'daily' | 'weekly'>('daily');
  const [weightTimeRange, setWeightTimeRange] = useState<7 | 30>(7);
  const [sleepTimeRange, setSleepTimeRange] = useState<7 | 30>(7);

  // Storage Cleanup & Persistence
  useEffect(() => {
    const cleanedDaily = cleanupOldLogs(state.dailyLogs) as DailyLog[];
    const cleanedWeekly = cleanupOldLogs(state.weeklyLogs) as WeeklyCheckIn[];
    
    if (cleanedDaily.length !== state.dailyLogs.length || cleanedWeekly.length !== state.weeklyLogs.length) {
      setState(prev => ({ ...prev, dailyLogs: cleanedDaily, weeklyLogs: cleanedWeekly }));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const tdee = state.profile.tdee || 2000;
  const macroPercentages = state.profile.macros;
  // memoized value ensures consistency
  const macroGrams = useMemo(() => getMacroGramsFromPct(tdee, macroPercentages), [tdee, macroPercentages]);
  const statusAlert = useMemo(() => getStatusAlert(state.dailyLogs), [state.dailyLogs]);

  const addDailyLog = (logData: Omit<DailyLog, 'id' | 'date' | 'isEditable' | 'macrosReached'>) => {
    const newLog: DailyLog = {
      ...logData,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      isEditable: true,
      macrosReached: { carbs: false, fat: false, protein: false }
    };
    setState(prev => {
      const newProfile = {
        ...prev.profile,
        weight: logData.weight,
        bmi: calculateBMI(logData.weight, prev.profile.height),
      };
      return { 
        ...prev, 
        dailyLogs: [newLog, ...prev.dailyLogs],
        profile: newProfile
      };
    });
    setView('dashboard');
  };

  const addWeeklyLog = (logData: Omit<WeeklyCheckIn, 'id' | 'date' | 'isEditable'>) => {
    const newLog: WeeklyCheckIn = {
      ...logData,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      isEditable: true
    };
    setState(prev => ({ ...prev, weeklyLogs: [newLog, ...prev.weeklyLogs] }));
    setView('dashboard');
  };

  const deleteLog = (id: string, type: 'daily' | 'weekly') => {
    setState(prev => ({
      ...prev,
      dailyLogs: type === 'daily' ? prev.dailyLogs.filter(l => l.id !== id) : prev.dailyLogs,
      weeklyLogs: type === 'weekly' ? prev.weeklyLogs.filter(l => l.id !== id) : prev.weeklyLogs
    }));
  };

  const toggleMacroGoal = (macroKey: 'carbs' | 'fat' | 'protein') => {
    if (state.dailyLogs.length === 0) return;
    setState(prev => {
      const newLogs = [...prev.dailyLogs];
      const latestLog = { ...newLogs[0] };
      if (!latestLog.macrosReached) {
        latestLog.macrosReached = { carbs: false, fat: false, protein: false };
      }
      latestLog.macrosReached = {
        ...latestLog.macrosReached,
        [macroKey]: !latestLog.macrosReached[macroKey]
      };
      newLogs[0] = latestLog;
      return { ...prev, dailyLogs: newLogs };
    });
  };

  const updateProfile = (updates: Partial<typeof state.profile>) => {
    setState(prev => {
      const newProfile = { ...prev.profile, ...updates };
      newProfile.bmi = calculateBMI(newProfile.weight, newProfile.height);
      return { ...prev, profile: newProfile };
    });
  };

  const handleModeChange = (modeName: string) => {
    const selected = SCENARIO_MODES.find(m => m.name === modeName);
    if (selected) {
      updateProfile({ 
        selectedMode: selected.name, 
        tdee: selected.calories 
      });
    }
  };

  const handleManualTdeeChange = (val: number) => {
    // Check if the manual value matches any preset
    const matchedMode = SCENARIO_MODES.find(m => m.calories === val);
    updateProfile({ 
      tdee: val, 
      selectedMode: matchedMode ? matchedMode.name : '自定义' 
    });
  };

  const handleMacroGramInput = (key: 'carbs' | 'fat' | 'protein', gramVal: number) => {
    const caloriesPerGram = MACRO_CALORIES[key];
    const newPct = ((gramVal * caloriesPerGram) / tdee) * 100;
    const newMacros = adjustMacrosPriority(key, newPct, state.profile.macros);
    updateProfile({ macros: newMacros });
  };

  const handleMacroPctSlider = (key: 'carbs' | 'fat' | 'protein', pct: number) => {
    const newMacros = adjustMacrosPriority(key, pct, state.profile.macros);
    updateProfile({ macros: newMacros });
  };

  const getChartData = (logs: DailyLog[], range: number) => {
    return [...logs].reverse().slice(-range).map(log => ({
      date: new Date(log.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      weight: log.weight,
      sleep: log.sleep
    }));
  };

  const weightData = useMemo(() => getChartData(state.dailyLogs, weightTimeRange), [state.dailyLogs, weightTimeRange]);
  const sleepData = useMemo(() => getChartData(state.dailyLogs, sleepTimeRange), [state.dailyLogs, sleepTimeRange]);

  return (
    <div className="min-h-screen pb-24 max-w-2xl mx-auto px-4 pt-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="text-cyan-400" size={28} />
            FitFocus
          </h1>
          <p className="text-slate-400 text-xs tracking-wide">
            {state.profile.selectedMode || '默认模式'} | BMI: {state.profile.bmi || '--'} | {tdee}kcal
          </p>
        </div>
        <button onClick={() => setView('settings')} className="p-2 bg-slate-800 rounded-full text-slate-300 hover:bg-slate-700 transition-colors">
          <Settings size={20} />
        </button>
      </header>

      {/* Global Alert Center */}
      <section className="mb-6">
        <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${
          statusAlert.level === WarningLevel.RED 
            ? 'bg-red-500/20 border-red-500/40 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
            : statusAlert.level === WarningLevel.YELLOW 
            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-100'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100'
        }`}>
          {statusAlert.level === WarningLevel.RED ? <AlertCircle className="text-red-400 animate-pulse" size={24} /> : statusAlert.level === WarningLevel.YELLOW ? <ShieldAlert className="text-yellow-400" size={24} /> : <CheckCircle2 className="text-emerald-400" size={24} />}
          <div>
            <h3 className="font-bold uppercase tracking-widest text-[10px] opacity-70">健康监控引擎</h3>
            <p className="text-xs font-semibold">{statusAlert.message}</p>
          </div>
        </div>
      </section>

      <main className="space-y-6">
        {view === 'dashboard' && (
          <>
            <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-cyan-400" size={16} />
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">体重变化曲线</h3>
                </div>
                <div className="flex bg-slate-900 rounded-lg p-0.5">
                  <button onClick={() => setWeightTimeRange(7)} className={`px-2 py-0.5 text-[10px] rounded transition-all ${weightTimeRange === 7 ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>7天</button>
                  <button onClick={() => setWeightTimeRange(30)} className={`px-2 py-0.5 text-[10px] rounded transition-all ${weightTimeRange === 30 ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>30天</button>
                </div>
              </div>
              <div className="h-40 w-full">
                {weightData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '10px' }} />
                      <Line type="monotone" dataKey="weight" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, fill: '#22d3ee' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 text-[10px] italic">需完成第一次打卡以展示数据</div>
                )}
              </div>
            </section>

            <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Moon className="text-indigo-400" size={16} />
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">睡眠质量记录</h3>
                </div>
                <div className="flex bg-slate-900 rounded-lg p-0.5">
                  <button onClick={() => setSleepTimeRange(7)} className={`px-2 py-0.5 text-[10px] rounded transition-all ${sleepTimeRange === 7 ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>7天</button>
                  <button onClick={() => setSleepTimeRange(30)} className={`px-2 py-0.5 text-[10px] rounded transition-all ${sleepTimeRange === 30 ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>30天</button>
                </div>
              </div>
              <div className="h-32 w-full">
                {sleepData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sleepData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis hide domain={[0, 12]} />
                      <Tooltip cursor={{fill: '#1e293b'}} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '10px' }} />
                      <Bar dataKey="sleep" fill="#818cf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 text-[10px] italic">暂无睡眠历史</div>
                )}
              </div>
            </section>

            <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 shadow-sm">
              <div className="flex justify-between items-center mb-5">
                <div className="flex flex-col">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">今日目标闭环</h3>
                  <span className="text-[9px] text-slate-500 font-bold">{state.profile.selectedMode || '自定义模式'}</span>
                </div>
                <button onClick={() => setView('nutrition')} className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300">模式配置</button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'carbs', label: '碳水', val: macroGrams.carbs, color: 'bg-orange-500', borderColor: 'border-orange-500/20' },
                  { id: 'fat', label: '脂肪', val: macroGrams.fat, color: 'bg-yellow-500', borderColor: 'border-yellow-500/20' },
                  { id: 'protein', label: '蛋白质', val: macroGrams.protein, color: 'bg-cyan-500', borderColor: 'border-cyan-500/20' }
                ].map((m) => {
                  const isReached = state.dailyLogs[0]?.macrosReached?.[m.id as keyof DailyLog['macrosReached']] || false;
                  return (
                    <div key={m.id} className="flex flex-col items-center">
                      <div className={`relative w-full h-14 rounded-xl flex flex-col items-center justify-center transition-all border ${isReached ? m.color + ' border-white/10' : 'bg-slate-900/60 ' + m.borderColor}`}>
                        <span className="text-[11px] font-black text-white">{m.val}g</span>
                        <span className="text-[8px] text-white/50 font-bold uppercase">{m.label}</span>
                      </div>
                      <button 
                        onClick={() => toggleMacroGoal(m.id as any)}
                        className={`mt-2.5 w-full py-2 rounded-lg flex items-center justify-center transition-all ${
                          isReached 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        {isReached ? <CheckCircle2 size={16} /> : <Check size={16} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {view === 'logs' && (
          <div className="space-y-6">
            <div className="flex bg-slate-800 p-1 rounded-xl">
              <button onClick={() => setActiveLogTab('daily')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeLogTab === 'daily' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500'}`}>每日监控</button>
              <button onClick={() => setActiveLogTab('weekly')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeLogTab === 'weekly' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500'}`}>每周围度</button>
            </div>
            {activeLogTab === 'daily' ? <DailyLogForm history={state.dailyLogs} onSubmit={addDailyLog} /> : <WeeklyLogForm onSubmit={addWeeklyLog} />}
          </div>
        )}

        {view === 'nutrition' && (
          <section className="bg-slate-800 p-6 rounded-3xl border border-slate-700/50 space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-400">
                <Pizza size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">营养配置与场景模式</h3>
                <p className="text-xs text-slate-400">快速切换热量预算，适配生活场景</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Scene Selector */}
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/30">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">场景模式选择</label>
                <div className="grid grid-cols-2 gap-2">
                  {SCENARIO_MODES.map((m) => (
                    <button 
                      key={m.name}
                      onClick={() => handleModeChange(m.name)}
                      className={`py-3 px-2 rounded-xl text-[10px] font-bold border transition-all ${
                        state.profile.selectedMode === m.name 
                          ? 'bg-cyan-600/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.1)]' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <div className="truncate">{m.name}</div>
                      <div className="text-[8px] opacity-60">{m.calories} kcal</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/30">
                <div className="flex justify-between items-end mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">每日总预算 (kcal)</label>
                  {state.profile.selectedMode === '自定义' && <span className="text-[8px] text-cyan-400 font-bold uppercase">自定义模式</span>}
                </div>
                <div className="relative">
                  <input 
                    type="number" 
                    value={tdee || ''} 
                    onChange={(e) => handleManualTdeeChange(Number(e.target.value))} 
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white font-black text-lg outline-none focus:border-cyan-500/50" 
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">kcal</div>
                </div>
              </div>

              <div className="space-y-6">
                {[
                  { key: 'carbs', label: '碳水 (L1)', color: 'accent-orange-500', icon: '🍞' },
                  { key: 'fat', label: '脂肪 (L2)', color: 'accent-yellow-500', icon: '🥑' },
                  { key: 'protein', label: '蛋白质 (L3)', color: 'accent-cyan-400', icon: '🥩' }
                ].map((m) => (
                  <div key={m.key} className="bg-slate-900/30 p-4 rounded-2xl border border-slate-700/20 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{m.icon}</span>
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black text-slate-500 uppercase leading-none mb-1">{m.label}</span>
                           <span className="text-[10px] font-bold text-slate-400 leading-none">{(state.profile.macros as any)[m.key]}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700 shadow-inner">
                        <input type="number" value={(macroGrams as any)[m.key]} onChange={(e) => handleMacroGramInput(m.key as any, Number(e.target.value))} className="w-16 bg-transparent text-right font-black text-white outline-none text-lg" />
                        <span className="text-[10px] text-slate-500 font-black">g</span>
                      </div>
                    </div>
                    <input type="range" min="0" max="100" step="1" value={(state.profile.macros as any)[m.key]} onChange={(e) => handleMacroPctSlider(m.key as any, Number(e.target.value))} className={`w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer ${m.color}`} />
                  </div>
                ))}
              </div>
              <button onClick={() => setView('dashboard')} className="w-full bg-cyan-600 py-4 rounded-2xl font-black text-white hover:bg-cyan-500 shadow-xl shadow-cyan-600/30 transition-all active:scale-[0.98]">锁定营养场景</button>
            </div>
          </section>
        )}

        {view === 'history' && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><History size={18} className="text-indigo-400" /> 历史采集点 (一年内)</h3>
            <div className="space-y-4">
              {state.dailyLogs.length === 0 ? <p className="text-xs text-slate-500 italic py-4">等待首次记录...</p> : state.dailyLogs.map(log => (
                <div key={log.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center group">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400">{new Date(log.date).toLocaleDateString()}</p>
                    <p className="text-sm text-white font-bold">{log.weight}kg | {log.sleep}h | {log.rhr}bpm</p>
                  </div>
                  <button onClick={() => deleteLog(log.id, 'daily')} className="p-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'settings' && (
          <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 space-y-6">
             <h3 className="text-sm font-bold text-white flex items-center gap-2"><User size={18} className="text-cyan-400" /> 用户档案管理</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">性别</label>
                <select value={state.profile.gender} onChange={(e) => updateProfile({ gender: e.target.value as any })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none">
                  <option value="male">男 (Male)</option>
                  <option value="female">女 (Female)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">身高 (cm)</label>
                <input type="number" value={state.profile.height} onChange={(e) => updateProfile({ height: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">年龄</label>
                <input type="number" value={state.profile.age} onChange={(e) => updateProfile({ age: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">实时 BMI 指数</label>
                <div className="bg-slate-700/30 rounded-xl p-3 text-cyan-400 font-black text-lg text-center">{state.profile.bmi || '--'}</div>
              </div>
            </div>
            <button onClick={() => setView('dashboard')} className="w-full bg-slate-700 py-3 rounded-xl font-bold text-white hover:bg-slate-600 transition-colors">确认更改</button>
          </section>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-3 z-50">
        <div className="max-w-2xl mx-auto flex justify-around items-center">
          {[
            { id: 'dashboard', label: '概览', icon: <BarChart2 size={22} /> },
            { id: 'logs', label: '打卡', icon: <PlusCircle size={22} /> },
            { id: 'nutrition', label: '场景', icon: <Pizza size={22} /> },
            { id: 'history', label: '历史', icon: <History size={22} /> }
          ].map(item => (
            <button key={item.id} onClick={() => setView(item.id as any)} className={`flex flex-col items-center gap-1 transition-all ${view === item.id ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-400'}`}>
              <div className={view === item.id ? 'scale-110' : ''}>{item.icon}</div>
              <span className="text-[9px] font-bold uppercase tracking-tight">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

// Daily Check-in Form
const DailyLogForm: React.FC<{ history: DailyLog[], onSubmit: (v: any) => void }> = ({ history, onSubmit }) => {
  const [vals, setVals] = useState({ weight: '', sleep: '', rhr: '' });
  const [rhrThreshold, setRhrThreshold] = useState<0.10 | 0.15>(0.10);

  const avgRHR = useMemo(() => getAvgRHR(history), [history]);
  
  const currentAlert = useMemo(() => {
    const sleepVal = Number(vals.sleep);
    const rhrVal = Number(vals.rhr);
    if (!vals.sleep || !vals.rhr) return null;

    if (sleepVal < 5) {
      return { level: WarningLevel.RED, message: "⚠️ 睡眠严重不足，强烈建议停止今日训练，保证休息！" };
    }
    if (avgRHR > 0 && rhrVal > avgRHR * (1 + rhrThreshold)) {
      return { level: WarningLevel.YELLOW, message: `⚠️ 心率较均值升高 >${rhrThreshold * 100}%，建议降低强度。` };
    }
    return null;
  }, [vals, avgRHR, rhrThreshold]);

  const handleSubmit = () => {
    onSubmit({ ...vals, weight: Number(vals.weight), sleep: Number(vals.sleep), rhr: Number(vals.rhr), fatigue: 5, performance: 5 });
  };

  return (
    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 space-y-4 shadow-xl">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <Moon className="text-indigo-400" size={18} />
          <h3 className="text-sm font-bold text-white uppercase tracking-tighter">身体状态记录</h3>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1">
          <span className="text-[8px] text-slate-500 font-bold uppercase mr-1">RHR 阈值</span>
          <button onClick={() => setRhrThreshold(0.10)} className={`px-2 py-0.5 text-[10px] rounded ${rhrThreshold === 0.10 ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>10%</button>
          <button onClick={() => setRhrThreshold(0.15)} className={`px-2 py-0.5 text-[10px] rounded ${rhrThreshold === 0.15 ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>15%</button>
        </div>
      </div>

      {currentAlert && (
        <div className={`p-3 rounded-xl border animate-in fade-in slide-in-from-top-2 ${
          currentAlert.level === WarningLevel.RED ? 'bg-red-500/20 border-red-500/30 text-red-200' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-200'
        }`}>
          <p className="text-[10px] font-bold text-center leading-snug">{currentAlert.message}</p>
        </div>
      )}

      <div className="grid gap-4">
        {[
          { key: 'weight', label: '晨重 (kg)', placeholder: '0.0' },
          { key: 'sleep', label: '有效睡眠 (h)', placeholder: '0.0' },
          { key: 'rhr', label: '晨起心率 (bpm)', placeholder: '0' }
        ].map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{f.label}</label>
            <input 
              type="number" 
              placeholder={f.placeholder}
              value={vals[f.key as keyof typeof vals]} 
              onChange={(e) => setVals(v => ({...v, [f.key]: e.target.value}))} 
              className={`w-full bg-slate-900 border rounded-xl p-4 text-white font-bold outline-none transition-colors ${
                f.key === 'sleep' && Number(vals.sleep) > 0 && Number(vals.sleep) < 5 ? 'border-red-500/50' : 'border-slate-700 focus:border-indigo-500/50'
              }`} 
            />
          </div>
        ))}
      </div>
      
      <button 
        onClick={handleSubmit} 
        className={`w-full py-4 rounded-xl font-black text-white mt-4 shadow-lg transition-all active:scale-[0.98] ${
          currentAlert?.level === WarningLevel.RED ? 'bg-red-600 shadow-red-600/30' : 'bg-indigo-600 shadow-indigo-600/30'
        }`}
      >
        完成打卡提交
      </button>
    </div>
  );
};

const WeeklyLogForm: React.FC<{ onSubmit: (v: any) => void }> = ({ onSubmit }) => {
  const [vals, setVals] = useState({ waist: '', leftArm: '', rightArm: '' });
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setPhotos(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 space-y-4 shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <Ruler className="text-emerald-400" size={18} />
        <h3 className="text-sm font-bold text-white uppercase tracking-tighter">身体围度周期考量</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { key: 'waist', label: '腰围 (cm)' },
          { key: 'leftArm', label: '左侧臂围 (cm)' },
          { key: 'rightArm', label: '右侧臂围 (cm)' }
        ].map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{f.label}</label>
            <input type="number" value={vals[f.key as keyof typeof vals]} onChange={(e) => setVals(v => ({...v, [f.key]: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white font-bold outline-none focus:border-emerald-500/50" />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">体态对比照</label>
          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-900 border border-dashed border-slate-700 rounded-xl p-4 flex items-center justify-center text-slate-500 hover:text-slate-300"><Camera size={24} /></button>
          <input type="file" multiple ref={fileInputRef} hidden accept="image/*" onChange={handlePhotoUpload} />
        </div>
      </div>
      <button onClick={() => onSubmit({ ...vals, waist: Number(vals.waist), leftArm: Number(vals.leftArm), rightArm: Number(vals.rightArm), photos })} className="w-full bg-emerald-600 py-4 rounded-xl font-black text-white mt-4 shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all">确认本周数据</button>
    </div>
  );
};

export default App;
