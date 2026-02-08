
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Activity, 
  Settings, 
  PlusCircle, 
  BarChart2, 
  User, 
  CheckCircle2, 
  ShieldAlert, 
  Trash2,
  History,
  Pizza,
  Zap,
  Target,
  AlertCircle,
  TrendingUp,
  Check,
  Moon,
  ChevronRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from 'recharts';
import { AppState, DailyLog, WeeklyCheckIn, WarningLevel, StatusAlert } from './types';
import { INITIAL_STATE, STORAGE_KEY, MACRO_CALORIES, SCENARIO_MODES } from './constants';
import { calculateBMI, getStatusAlert, adjustMacrosPriority, getMacroGramsFromPct, cleanupOldLogs, getAvgRHR } from './utils';

// --- Branding Component ---
const ModeFitLogo = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <div className={`relative flex items-center justify-center ${className}`} style={{ width: size * 1.5, height: size * 1.5 }}>
    <div className="absolute inset-0 bg-accent-gradient rounded-xl rotate-6 opacity-20"></div>
    <div className="relative z-10 flex flex-col items-center">
      <div className="flex items-center gap-0.5 mb-0.5">
        <div className="w-1.5 h-3 bg-red-500 rounded-full"></div>
        <div className="w-1.5 h-4 bg-yellow-500 rounded-full"></div>
        <div className="w-1.5 h-5 bg-emerald-500 rounded-full"></div>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-black text-white text-xl leading-none" style={{ fontSize: size * 0.8 }}>M</span>
        <Activity size={size * 0.5} className="text-white" />
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  // Theme Detection
  const [isDark, setIsDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const matcher = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    matcher.addEventListener('change', onChange);
    return () => matcher.removeEventListener('change', onChange);
  }, []);

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

  // Persistence
  useEffect(() => {
    const cleanedDaily = cleanupOldLogs(state.dailyLogs) as DailyLog[];
    const cleanedWeekly = cleanupOldLogs(state.weeklyLogs) as WeeklyCheckIn[];
    if (cleanedDaily.length !== state.dailyLogs.length || cleanedWeekly.length !== state.weeklyLogs.length) {
      setState(prev => ({ ...prev, dailyLogs: cleanedDaily, weeklyLogs: cleanedWeekly }));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Derived State
  const tdee = state.profile.tdee || 1850;
  const macroPercentages = state.profile.macros;
  const macroGrams = useMemo(() => getMacroGramsFromPct(tdee, macroPercentages), [tdee, macroPercentages]);
  const statusAlert = useMemo(() => getStatusAlert(state.dailyLogs), [state.dailyLogs]);

  // Theme Colors
  const theme = {
    bg: isDark ? 'bg-[#121212]' : 'bg-[#F5F5F7]',
    card: isDark ? 'bg-[#1E1E1E]' : 'bg-white',
    text: isDark ? 'text-white' : 'text-[#000000]',
    subtext: isDark ? 'text-slate-400' : 'text-slate-600',
    border: isDark ? 'border-[#2A2A2A]' : 'border-slate-200',
    headerBg: isDark ? 'bg-[#121212]/90' : 'bg-white/90',
    nav: isDark ? 'bg-[#121212]/98' : 'bg-white/98'
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
      updateProfile({ selectedMode: selected.name, tdee: selected.calories });
    }
  };

  const handleManualTdeeChange = (val: number) => {
    const matchedMode = SCENARIO_MODES.find(m => m.calories === val);
    updateProfile({ tdee: val, selectedMode: matchedMode ? matchedMode.name : '自定义' });
  };

  const toggleMacroGoal = (macroKey: 'carbs' | 'fat' | 'protein') => {
    if (state.dailyLogs.length === 0) return;
    setState(prev => {
      const newLogs = [...prev.dailyLogs];
      const latestLog = { ...newLogs[0] };
      if (!latestLog.macrosReached) latestLog.macrosReached = { carbs: false, fat: false, protein: false };
      latestLog.macrosReached = { ...latestLog.macrosReached, [macroKey]: !latestLog.macrosReached[macroKey] };
      newLogs[0] = latestLog;
      return { ...prev, dailyLogs: newLogs };
    });
  };

  const addDailyLog = (logData: any) => {
    const newLog: DailyLog = {
      ...logData,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      isEditable: true,
      macrosReached: { carbs: false, fat: false, protein: false }
    };
    setState(prev => ({
      ...prev,
      dailyLogs: [newLog, ...prev.dailyLogs],
      profile: { ...prev.profile, weight: logData.weight, bmi: calculateBMI(logData.weight, prev.profile.height) }
    }));
    setView('dashboard');
  };

  const deleteLog = (id: string) => {
    setState(prev => ({ ...prev, dailyLogs: prev.dailyLogs.filter(l => l.id !== id) }));
  };

  return (
    <div className={`h-screen w-screen flex flex-col ${theme.bg} ${theme.text} transition-all duration-300 overflow-hidden relative`}>
      
      {/* 1. 顶部状态栏优化 (Fixed Header with 800 Weight Text) */}
      <header className={`glass-header ${theme.headerBg} border-b ${theme.border} px-6 pb-4`}>
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
             <ModeFitLogo size={22} />
             <h1 className={`text-xl font-black tracking-tighter ${theme.text}`}>ModeFit</h1>
          </div>
          <button onClick={() => setView('settings')} className={`p-2.5 rounded-2xl ${theme.card} ${theme.border} border shadow-sm active:scale-90 transition-transform`}>
            <Settings size={20} className={isDark ? 'text-white' : 'text-slate-900'} />
          </button>
        </div>
        
        {/* 顶部文字增强 (Font Weight 800) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className={`flex-shrink-0 px-4 py-2 rounded-2xl flex items-center gap-2.5 ${isDark ? 'bg-white/10' : 'bg-black/5'}`}>
            <span className={`text-[14px] font-extrabold uppercase tracking-tight ${theme.text}`}>
              {state.profile.selectedMode || '默认场景'}
            </span>
            <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-white/40' : 'bg-black/20'}`}></div>
            <span className={`text-[14px] font-extrabold ${theme.text}`}>BMI: {state.profile.bmi || '--'}</span>
            <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-white/40' : 'bg-black/20'}`}></div>
            <span className={`text-[14px] font-black text-blue-500`}>{tdee} <span className="text-[10px]">kcal</span></span>
          </div>
        </div>
      </header>

      {/* 2. 主体容器 (Flex: 1 & Independent Scrolling) */}
      <div className="scroll-container no-scrollbar">
        <main className="px-4 space-y-6 max-w-2xl mx-auto">
          {/* Alert Center */}
          <section className="mb-6">
            <div className={`p-5 rounded-[2.5rem] border flex items-center gap-4 transition-all ${
              statusAlert.level === WarningLevel.RED 
                ? 'bg-red-500/20 border-red-500/40 text-red-100' 
                : statusAlert.level === WarningLevel.YELLOW 
                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-100'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100'
            }`}>
              <div className="p-3 rounded-2xl bg-white/10 flex-shrink-0">
                {statusAlert.level === WarningLevel.RED ? <AlertCircle size={22} /> : statusAlert.level === WarningLevel.YELLOW ? <ShieldAlert size={22} /> : <CheckCircle2 size={22} />}
              </div>
              <div>
                <h3 className="font-black uppercase tracking-widest text-[10px] opacity-70 mb-0.5">Health AI Status</h3>
                <p className={`text-[15px] font-extrabold leading-tight ${theme.text}`}>{statusAlert.message}</p>
              </div>
            </div>
          </section>

          {view === 'dashboard' && (
            <>
              {/* Charts */}
              <div className={`p-6 rounded-[2.5rem] ${theme.card} ${theme.border} border shadow-xl shadow-black/5 space-y-8`}>
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="text-blue-500" size={18} />
                      <h3 className="text-[11px] font-black uppercase tracking-widest opacity-60">体重趋势图</h3>
                    </div>
                    <div className={`flex p-1 rounded-xl ${isDark ? 'bg-black/20' : 'bg-slate-100'}`}>
                      {[7, 30].map(r => (
                        <button key={r} onClick={() => setWeightTimeRange(r as any)} className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${weightTimeRange === r ? 'bg-blue-600 text-white' : theme.subtext}`}>{r}D</button>
                      ))}
                    </div>
                  </div>
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={state.dailyLogs.slice().reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} vertical={false} />
                        <XAxis dataKey="date" hide />
                        <YAxis domain={['auto', 'auto']} hide />
                        <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e1e1e' : '#fff', border: 'none', borderRadius: '12px', fontSize: '12px', color: isDark ? '#fff' : '#000', fontWeight: 'bold' }} />
                        <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={5} dot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 7 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <Moon className="text-orange-500" size={18} />
                      <h3 className="text-[11px] font-black uppercase tracking-widest opacity-60">睡眠深度记录</h3>
                    </div>
                    <div className={`flex p-1 rounded-xl ${isDark ? 'bg-black/20' : 'bg-slate-100'}`}>
                      {[7, 30].map(r => (
                        <button key={r} onClick={() => setSleepTimeRange(r as any)} className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${sleepTimeRange === r ? 'bg-orange-600 text-white' : theme.subtext}`}>{r}D</button>
                      ))}
                    </div>
                  </div>
                  <div className="h-36 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={state.dailyLogs.slice().reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} vertical={false} />
                        <XAxis dataKey="date" hide />
                        <YAxis hide domain={[0, 12]} />
                        <Bar dataKey="sleep" fill="#f97316" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Nutrition Toggle */}
              <section className={`p-6 rounded-[2.5rem] ${theme.card} ${theme.border} border shadow-lg`}>
                <div className="flex justify-between items-center mb-6 px-1">
                  <h3 className="text-[11px] font-black uppercase tracking-widest opacity-60">今日营养闭环</h3>
                  <Target size={18} className="text-blue-500" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'carbs', label: '碳水', val: macroGrams.carbs, icon: '🍞' },
                    { id: 'fat', label: '脂肪', val: macroGrams.fat, icon: '🥑' },
                    { id: 'protein', label: '蛋白质', val: macroGrams.protein, icon: '🥩' }
                  ].map((m) => {
                    const isReached = state.dailyLogs[0]?.macrosReached?.[m.id as any] || false;
                    return (
                      <button 
                        key={m.id}
                        onClick={() => toggleMacroGoal(m.id as any)}
                        className={`relative overflow-hidden flex flex-col items-center justify-center py-6 rounded-[2rem] border-2 transition-all active:scale-95 ${
                          isReached 
                            ? 'bg-emerald-500 border-emerald-400 shadow-lg shadow-emerald-500/20' 
                            : `${isDark ? 'bg-black/30 border-[#2A2A2A]' : 'bg-slate-50 border-slate-200'}`
                        }`}
                      >
                        <span className={`text-xl mb-1 ${isReached ? 'opacity-0' : ''}`}>{m.icon}</span>
                        <span className={`text-[16px] font-extrabold ${isReached ? 'text-white' : theme.text}`}>{m.val}g</span>
                        <span className={`text-[10px] font-black uppercase tracking-tight ${isReached ? 'text-white/70' : 'opacity-40'}`}>{m.label}</span>
                        {isReached && <CheckCircle2 size={26} className="absolute inset-0 m-auto text-white/40 animate-in zoom-in-50 duration-300" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {view === 'nutrition' && (
            <section className={`p-8 rounded-[3rem] ${theme.card} ${theme.border} border shadow-2xl space-y-10`}>
              <div className="space-y-2">
                <h2 className={`text-2xl font-black ${theme.text}`}>场景模式管理</h2>
                <p className={`text-xs ${theme.subtext}`}>根据当日训练安排快速切换预算</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {SCENARIO_MODES.map((m) => (
                  <button 
                    key={m.name}
                    onClick={() => handleModeChange(m.name)}
                    className={`relative p-5 rounded-3xl border-2 text-left transition-all active:scale-98 ${
                      state.profile.selectedMode === m.name 
                        ? 'bg-blue-500/10 border-blue-500' 
                        : `${theme.border} ${isDark ? 'bg-black/20' : 'bg-slate-50'}`
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className={`text-sm font-black ${state.profile.selectedMode === m.name ? 'text-blue-500' : theme.text}`}>{m.name}</div>
                        <div className={`text-[10px] font-extrabold uppercase tracking-widest opacity-50`}>{m.calories} kcal / day</div>
                      </div>
                      {state.profile.selectedMode === m.name && <CheckCircle2 className="text-blue-500" size={20} />}
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-black uppercase tracking-widest opacity-50">自定预算 (kcal)</label>
                  {state.profile.selectedMode === '自定义' && <div className="text-[10px] text-blue-500 font-black">CUSTOM MODE</div>}
                </div>
                <input 
                  type="number" 
                  value={tdee} 
                  onChange={(e) => handleManualTdeeChange(Number(e.target.value))}
                  className={`w-full p-6 text-2xl font-black rounded-3xl outline-none border-2 focus:border-blue-500 transition-colors ${isDark ? 'bg-black/40 border-[#2A2A2A] text-white' : 'bg-slate-50 border-slate-200 text-black'}`}
                />
              </div>

              <div className="space-y-6">
                 {[
                    { key: 'carbs', label: '碳水 (L1)', color: 'accent-orange-500', icon: '🍞' },
                    { key: 'fat', label: '脂肪 (L2)', color: 'accent-yellow-500', icon: '🥑' },
                    { key: 'protein', label: '蛋白质 (L3)', color: 'accent-cyan-400', icon: '🥩' }
                  ].map(m => (
                    <div key={m.key} className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                         <div className="flex items-center gap-2">
                           <span className="text-lg">{m.icon}</span>
                           <span className="text-[11px] font-black uppercase tracking-widest opacity-60">{m.label}</span>
                         </div>
                         <span className="text-sm font-black">{(macroPercentages as any)[m.key]}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={(macroPercentages as any)[m.key]}
                        onChange={(e) => {
                          const newMacros = adjustMacrosPriority(m.key as any, Number(e.target.value), macroPercentages);
                          updateProfile({ macros: newMacros });
                        }}
                        className="w-full h-2 bg-slate-700 rounded-full appearance-none accent-blue-500"
                      />
                    </div>
                  ))}
              </div>

              <button onClick={() => setView('dashboard')} className="w-full bg-accent-gradient py-6 rounded-3xl font-black text-white shadow-xl shadow-blue-500/20 active:scale-95 transition-all">锁定营养配置</button>
            </section>
          )}

          {view === 'logs' && (
            <div className="space-y-6 pb-10">
               <div className={`p-2 flex rounded-[1.8rem] ${isDark ? 'bg-black/40' : 'bg-slate-200'}`}>
                  <button onClick={() => setActiveLogTab('daily')} className={`flex-1 py-4 text-[13px] font-black rounded-2xl transition-all ${activeLogTab === 'daily' ? `${theme.card} ${theme.text} shadow-sm` : theme.subtext}`}>每日监控</button>
                  <button onClick={() => setActiveLogTab('weekly')} className={`flex-1 py-4 text-[13px] font-black rounded-2xl transition-all ${activeLogTab === 'weekly' ? `${theme.card} ${theme.text} shadow-sm` : theme.subtext}`}>每周围度</button>
               </div>
               {activeLogTab === 'daily' ? <DailyLogForm theme={theme} onSubmit={addDailyLog} /> : <div className={`text-center py-20 rounded-[2.5rem] ${theme.card} border ${theme.border} opacity-40 italic font-bold`}>围度追踪模块维护中...</div>}
            </div>
          )}

          {view === 'history' && (
            <div className="space-y-4">
               <div className="flex items-center justify-between mb-2 px-2">
                  <h3 className="text-[11px] font-black uppercase tracking-widest opacity-60">数据留存存档</h3>
                  <History className="text-orange-500" size={18} />
               </div>
               {state.dailyLogs.length > 0 ? state.dailyLogs.map(log => (
                 <div key={log.id} className={`p-6 rounded-[2.2rem] border ${theme.card} ${theme.border} flex justify-between items-center shadow-sm`}>
                    <div>
                      <div className="text-[11px] font-extrabold opacity-50 mb-0.5">{new Date(log.date).toLocaleDateString()}</div>
                      <div className={`text-[16px] font-black ${theme.text}`}>{log.weight}kg | {log.sleep}h | {log.rhr}bpm</div>
                    </div>
                    <button onClick={() => deleteLog(log.id)} className="p-3 text-red-500 active:scale-75 transition-transform"><Trash2 size={22} /></button>
                 </div>
               )) : (
                 <div className="py-20 text-center opacity-30 italic font-bold">暂无历史记录</div>
               )}
            </div>
          )}

          {view === 'settings' && (
            <section className={`p-8 rounded-[3rem] ${theme.card} ${theme.border} border space-y-8`}>
              <div className="flex items-center gap-3">
                <User size={24} className="text-blue-500" />
                <h2 className={`text-xl font-black ${theme.text}`}>用户档案</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-50 px-1">身高 (CM)</label>
                  <input type="number" value={state.profile.height} onChange={(e) => updateProfile({ height: Number(e.target.value) })} className={`w-full p-5 rounded-2xl border ${isDark ? 'bg-black/40 border-[#2A2A2A]' : 'bg-slate-50 border-slate-200'} font-black ${theme.text}`} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-50 px-1">年龄 (YR)</label>
                  <input type="number" value={state.profile.age} onChange={(e) => updateProfile({ age: Number(e.target.value) })} className={`w-full p-5 rounded-2xl border ${isDark ? 'bg-black/40 border-[#2A2A2A]' : 'bg-slate-50 border-slate-200'} font-black ${theme.text}`} />
                </div>
              </div>
              <button onClick={() => setView('dashboard')} className="w-full bg-accent-gradient py-6 rounded-[2rem] font-black text-white shadow-lg active:scale-95 transition-all">保存并返回</button>
              <div className="pt-10 border-t border-dashed border-slate-500/20 text-center">
                 <ModeFitLogo size={32} className="mx-auto mb-4" />
                 <h4 className={`font-black text-lg ${theme.text}`}>ModeFit v4.8</h4>
                 <p className="text-[10px] font-extrabold opacity-30 mt-1 uppercase tracking-widest">Designed for Professional Performance</p>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* 3. 底部导航栏优化 (Fixed & Safe-Index) */}
      <nav className={`fixed bottom-0 left-0 right-0 ${theme.nav} backdrop-blur-xl border-t ${theme.border} px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-[1000] shadow-[0_-12px_40px_rgba(0,0,0,0.1)]`}>
        <div className="max-w-2xl mx-auto flex justify-around items-center">
          {[
            { id: 'dashboard', label: '概览', icon: <BarChart2 size={26} /> },
            { id: 'logs', label: '打卡', icon: <PlusCircle size={26} /> },
            { id: 'nutrition', label: '场景', icon: <Zap size={26} /> },
            { id: 'history', label: '存档', icon: <History size={26} /> }
          ].map(item => (
            <button key={item.id} onClick={() => setView(item.id as any)} className={`flex flex-col items-center gap-1.5 transition-all ${view === item.id ? 'text-blue-500 scale-105' : 'text-slate-400 opacity-60'}`}>
              <div className={view === item.id ? 'bg-blue-500/10 p-2.5 rounded-2xl' : 'p-2.5'}>
                {item.icon}
              </div>
              <span className={`text-[11px] font-black uppercase tracking-tight ${view === item.id ? 'text-blue-500' : ''}`}>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

// Sub-components for Form
const DailyLogForm: React.FC<{ theme: any, onSubmit: (v: any) => void }> = ({ theme, onSubmit }) => {
  const [vals, setVals] = useState({ weight: '', sleep: '', rhr: '' });
  return (
    <div className={`p-8 rounded-[2.5rem] ${theme.card} ${theme.border} border shadow-2xl space-y-7`}>
      <div className="space-y-6">
        {[{ k: 'weight', l: '晨重 (KG)', p: '0.0' }, { k: 'sleep', l: '睡眠 (H)', p: '0.0' }, { k: 'rhr', l: '晨脉 (BPM)', p: '0' }].map(f => (
          <div key={f.k} className="space-y-2">
            <label className="text-[12px] font-black uppercase opacity-40 px-1 tracking-widest">{f.l}</label>
            <input 
              type="number" 
              placeholder={f.p} 
              value={vals[f.k as keyof typeof vals]} 
              onChange={e => setVals(v => ({...v, [f.k]: e.target.value}))} 
              className={`w-full p-6 rounded-3xl border-2 font-black text-3xl outline-none focus:border-blue-500 transition-all ${theme.card} ${theme.border} ${theme.text}`} 
            />
          </div>
        ))}
      </div>
      <button onClick={() => onSubmit({ ...vals, weight: Number(vals.weight), sleep: Number(vals.sleep), rhr: Number(vals.rhr) })} className="w-full bg-accent-gradient py-6 rounded-[2.2rem] font-black text-white shadow-xl active:scale-95 transition-all">提交身体记录</button>
    </div>
  );
};

export default App;
