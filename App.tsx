
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
  Zap,
  Target,
  AlertCircle,
  TrendingUp,
  Moon,
  Ruler,
  Camera,
  X
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from 'recharts';
import { AppState, DailyLog, WeeklyCheckIn, WarningLevel } from './types';
import { INITIAL_STATE, STORAGE_KEY, SCENARIO_MODES } from './constants';
import { calculateBMI, getStatusAlert, adjustMacrosPriority, getMacroGramsFromPct, cleanupOldLogs, getAvgRHR } from './utils';

// --- Branding Component ---
const ModeFitLogo = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
  <div className={`relative flex items-center justify-center ${className}`} style={{ width: size * 1.4, height: size * 1.4 }}>
    <div className="absolute inset-0 bg-accent-gradient rounded-lg rotate-6 opacity-20"></div>
    <div className="relative z-10 flex flex-col items-center">
      <div className="flex items-center gap-0.5 mb-0.5">
        <div className="w-1 h-2 bg-red-500 rounded-full"></div>
        <div className="w-1 h-2.5 bg-yellow-500 rounded-full"></div>
        <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
      </div>
      <div className="flex items-center gap-0.5">
        <span className="font-black text-white leading-none" style={{ fontSize: size * 0.7 }}>M</span>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [isDark, setIsDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [dailyForm, setDailyForm] = useState({ weight: '', sleep: '', rhr: '' });
  const [weeklyForm, setWeeklyForm] = useState({ waist: '', leftArm: '', rightArm: '', photos: [] as string[] });

  useEffect(() => {
    const cleanedDaily = cleanupOldLogs(state.dailyLogs) as DailyLog[];
    const cleanedWeekly = cleanupOldLogs(state.weeklyLogs) as WeeklyCheckIn[];
    if (cleanedDaily.length !== state.dailyLogs.length || cleanedWeekly.length !== state.weeklyLogs.length) {
      setState(prev => ({ ...prev, dailyLogs: cleanedDaily, weeklyLogs: cleanedWeekly }));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const tdee = state.profile.tdee || 1850;
  const macroPercentages = state.profile.macros;
  const macroGrams = useMemo(() => getMacroGramsFromPct(tdee, macroPercentages), [tdee, macroPercentages]);
  const statusAlert = useMemo(() => getStatusAlert(state.dailyLogs), [state.dailyLogs]);

  const avgHistoryRHR = useMemo(() => getAvgRHR(state.dailyLogs), [state.dailyLogs]);
  const rhrLiveWarning = useMemo(() => {
    const val = Number(dailyForm.rhr);
    if (!val || avgHistoryRHR === 0) return null;
    if (val > avgHistoryRHR * 1.15) return "⚠️ 心率波动严重异常，建议今日强制休息！";
    if (val > avgHistoryRHR * 1.10) return "⚠️ 心率波动异常，建议今日训练强度减半。";
    return null;
  }, [dailyForm.rhr, avgHistoryRHR]);

  const theme = {
    bg: isDark ? 'bg-[#121212]' : 'bg-[#F5F5F7]',
    card: isDark ? 'bg-[#1E1E1E]' : 'bg-white',
    text: isDark ? 'text-white' : 'text-[#000000]',
    subtext: isDark ? 'text-slate-400' : 'text-slate-600',
    border: isDark ? 'border-[#2A2A2A]' : 'border-slate-200',
    headerBg: isDark ? 'bg-[#121212]/95' : 'bg-white/95',
    nav: isDark ? 'bg-[#121212]/98' : 'bg-white/98'
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Fixed: Explicitly cast Array.from result to File[] to avoid 'unknown' type error when calling readAsDataURL.
    // File objects inherit from Blob, resolving the "Argument of type 'unknown' is not assignable to parameter of type 'Blob'" error.
    (Array.from(files) as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setWeeklyForm(prev => ({
          ...prev,
          photos: [...prev.photos, base64String]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setWeeklyForm(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
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
    updateProfile({ 
      tdee: val, 
      selectedMode: matchedMode ? matchedMode.name : '自定义模式' 
    });
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

  const addDailyLog = () => {
    const weight = Number(dailyForm.weight);
    const sleep = Number(dailyForm.sleep);
    const rhr = Number(dailyForm.rhr);
    if (weight <= 0) return;

    const newLog: DailyLog = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      weight,
      sleep,
      rhr,
      fatigue: 0,
      performance: 0,
      isEditable: true,
      macrosReached: { carbs: false, fat: false, protein: false }
    };

    setState(prev => ({
      ...prev,
      dailyLogs: [newLog, ...prev.dailyLogs],
      profile: { ...prev.profile, weight, bmi: calculateBMI(weight, prev.profile.height) }
    }));
    setDailyForm({ weight: '', sleep: '', rhr: '' });
    setView('dashboard');
  };

  const addWeeklyLog = () => {
    const waist = Number(weeklyForm.waist);
    const leftArm = Number(weeklyForm.leftArm);
    const rightArm = Number(weeklyForm.rightArm);
    if (waist <= 0) return;

    const newLog: WeeklyCheckIn = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      waist,
      leftArm,
      rightArm,
      isEditable: true,
      photos: weeklyForm.photos
    };
    setState(prev => ({
      ...prev,
      weeklyLogs: [newLog, ...prev.weeklyLogs]
    }));
    setWeeklyForm({ waist: '', leftArm: '', rightArm: '', photos: [] });
    setView('dashboard');
  };

  return (
    <div id="root" className={theme.bg}>
      <header className={`app-header ${theme.headerBg} border-b ${theme.border} px-4 py-3`}>
        <div className="flex justify-between items-center h-10">
          <div className="flex items-center gap-2">
             <ModeFitLogo size={18} />
             <h1 className={`text-lg font-black tracking-tighter ${theme.text}`}>ModeFit</h1>
          </div>
          <button onClick={() => setView('settings')} className={`p-2 rounded-xl ${theme.card} ${theme.border} border shadow-sm active:scale-90 transition-transform`}>
            <Settings size={18} className={isDark ? 'text-white' : 'text-slate-900'} />
          </button>
        </div>
        
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <div className={`flex-shrink-0 px-3 py-1.5 rounded-xl flex items-center gap-2 ${isDark ? 'bg-white/10' : 'bg-black/5'}`}>
            <span className={`text-[13px] font-extrabold uppercase tracking-tight ${theme.text}`}>
              {state.profile.selectedMode || '默认'}
            </span>
            <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white/40' : 'bg-black/20'}`}></div>
            <span className={`text-[13px] font-extrabold ${theme.text}`}>BMI {state.profile.bmi || '--'}</span>
            <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white/40' : 'bg-black/20'}`}></div>
            <span className={`text-[13px] font-black text-blue-500`}>{tdee} <span className="text-[10px]">kcal</span></span>
          </div>
        </div>
      </header>

      <div className="scroll-content no-scrollbar">
        <main className="px-4 py-4 space-y-4 max-w-md mx-auto">
          <div className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all ${
            statusAlert.level === WarningLevel.RED 
              ? 'bg-red-500/15 border-red-500/30' 
              : statusAlert.level === WarningLevel.YELLOW 
              ? 'bg-yellow-500/10 border-yellow-500/25'
              : 'bg-emerald-500/10 border-emerald-500/25'
          }`}>
            <div className="p-2 rounded-xl bg-white/10 flex-shrink-0">
              {statusAlert.level === WarningLevel.RED ? <AlertCircle size={20} className="text-red-500" /> : statusAlert.level === WarningLevel.YELLOW ? <ShieldAlert size={20} className="text-yellow-500" /> : <CheckCircle2 size={20} className="text-emerald-500" />}
            </div>
            <p className={`text-[13px] font-bold leading-tight ${theme.text}`}>{statusAlert.message}</p>
          </div>

          {view === 'dashboard' && (
            <>
              <div className={`p-4 rounded-2xl ${theme.card} ${theme.border} border shadow-sm space-y-4`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-blue-500" size={16} />
                    <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60">晨重趋势</h3>
                  </div>
                  <div className={`flex p-0.5 rounded-lg ${isDark ? 'bg-black/20' : 'bg-slate-100'}`}>
                    {[7, 30].map(r => (
                      <button key={r} onClick={() => setWeightTimeRange(r as any)} className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all ${weightTimeRange === r ? 'bg-blue-600 text-white' : theme.subtext}`}>{r}D</button>
                    ))}
                  </div>
                </div>
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={state.dailyLogs.slice(0, weightTimeRange).reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} vertical={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e1e1e' : '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', color: isDark ? '#fff' : '#000', fontWeight: 'bold' }} />
                      <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`p-4 rounded-2xl ${theme.card} ${theme.border} border shadow-sm space-y-4`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Moon className="text-orange-500" size={16} />
                    <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60">睡眠监控</h3>
                  </div>
                  <div className={`flex p-0.5 rounded-lg ${isDark ? 'bg-black/20' : 'bg-slate-100'}`}>
                    {[7, 30].map(r => (
                      <button key={r} onClick={() => setSleepTimeRange(r as any)} className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all ${sleepTimeRange === r ? 'bg-orange-600 text-white' : theme.subtext}`}>{r}D</button>
                    ))}
                  </div>
                </div>
                <div className="h-28 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={state.dailyLogs.slice(0, sleepTimeRange).reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} vertical={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis hide domain={[0, 12]} />
                      <Tooltip cursor={{fill: isDark ? '#2a2a2a' : '#f1f5f9'}} contentStyle={{ backgroundColor: isDark ? '#1e1e1e' : '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', color: isDark ? '#fff' : '#000', fontWeight: 'bold' }} />
                      <Bar dataKey="sleep" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <section className={`p-4 rounded-2xl ${theme.card} ${theme.border} border shadow-sm`}>
                <div className="flex justify-between items-center mb-4 px-1">
                  <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60">今日营养闭环</h3>
                  <Target size={16} className="text-blue-500" />
                </div>
                <div className="grid grid-cols-3 gap-2">
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
                        className={`relative flex flex-col items-center justify-center py-4 rounded-2xl border transition-all active:scale-95 ${
                          isReached 
                            ? 'bg-emerald-500 border-emerald-400 shadow-sm' 
                            : `${isDark ? 'bg-black/30 border-[#2A2A2A]' : 'bg-slate-50 border-slate-200'}`
                        }`}
                      >
                        <span className={`text-base mb-0.5 ${isReached ? 'opacity-0' : ''}`}>{m.icon}</span>
                        <span className={`text-[14px] font-extrabold ${isReached ? 'text-white' : theme.text}`}>{m.val}g</span>
                        <span className={`text-[9px] font-black uppercase tracking-tight ${isReached ? 'text-white/70' : 'opacity-40'}`}>{m.label}</span>
                        {isReached && <CheckCircle2 size={20} className="absolute inset-0 m-auto text-white/50" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {view === 'nutrition' && (
            <section className={`p-5 rounded-2xl ${theme.card} ${theme.border} border shadow-lg space-y-6`}>
              <div className="space-y-1">
                <h2 className={`text-lg font-black ${theme.text}`}>场景模式管理</h2>
                <p className={`text-[11px] ${theme.subtext}`}>选择预设或手动输入当日热量预算</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase opacity-40 px-1 tracking-widest">当日热量预算 (KCAL)</label>
                <div className="relative">
                   <input 
                    type="number" 
                    value={tdee} 
                    onChange={(e) => handleManualTdeeChange(Number(e.target.value))}
                    className={`w-full p-4 pr-16 rounded-xl border-2 font-black text-2xl outline-none focus:border-blue-500 transition-all ${theme.card} ${theme.border} ${theme.text}`}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-30">KCAL</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {SCENARIO_MODES.map((m) => (
                  <button 
                    key={m.name}
                    onClick={() => handleModeChange(m.name)}
                    className={`p-3 rounded-xl border transition-all active:scale-95 text-center ${
                      state.profile.selectedMode === m.name 
                        ? 'bg-blue-500/10 border-blue-500' 
                        : `${theme.border} ${isDark ? 'bg-black/20' : 'bg-slate-50'}`
                    }`}
                  >
                    <div className={`text-[12px] font-black ${state.profile.selectedMode === m.name ? 'text-blue-500' : theme.text}`}>{m.name}</div>
                    <div className={`text-[10px] font-bold opacity-40`}>{m.calories} kcal</div>
                  </button>
                ))}
              </div>

              <div className="space-y-4 pt-4 border-t border-dashed border-slate-500/20">
                 {[
                    { key: 'carbs', label: '碳水 (L1)', icon: '🍞' },
                    { key: 'fat', label: '脂肪 (L2)', icon: '🥑' },
                    { key: 'protein', label: '蛋白质 (L3)', icon: '🥩' }
                  ].map(m => (
                    <div key={m.key} className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                         <div className="flex items-center gap-1.5">
                           <span className="text-sm">{m.icon}</span>
                           <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{m.label}</span>
                         </div>
                         <span className="text-[11px] font-black">{(macroPercentages as any)[m.key]}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" 
                        value={(macroPercentages as any)[m.key]}
                        onChange={(e) => updateProfile({ macros: adjustMacrosPriority(m.key as any, Number(e.target.value), macroPercentages) })}
                        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none accent-blue-500"
                      />
                    </div>
                  ))}
              </div>
              <button onClick={() => setView('dashboard')} className="w-full bg-accent-gradient py-4 rounded-xl font-black text-white text-sm shadow-md active:scale-95">确定配置</button>
            </section>
          )}

          {view === 'logs' && (
             <div className="space-y-4">
               <div className={`p-1 flex rounded-xl ${isDark ? 'bg-black/40' : 'bg-slate-200'}`}>
                  <button onClick={() => setActiveLogTab('daily')} className={`flex-1 py-2.5 text-[11px] font-black rounded-lg transition-all ${activeLogTab === 'daily' ? `${theme.card} ${theme.text} shadow-sm` : theme.subtext}`}>每日打卡</button>
                  <button onClick={() => setActiveLogTab('weekly')} className={`flex-1 py-2.5 text-[11px] font-black rounded-lg transition-all ${activeLogTab === 'weekly' ? `${theme.card} ${theme.text} shadow-sm` : theme.subtext}`}>每周维度</button>
               </div>
               
               {activeLogTab === 'daily' ? (
                 <div className={`p-5 rounded-2xl ${theme.card} ${theme.border} border shadow-lg space-y-4`}>
                    {[{ k: 'weight', l: '晨重 (KG)', p: '0.0' }, { k: 'sleep', l: '睡眠 (H)', p: '0.0' }, { k: 'rhr', l: '晨脉 (BPM)', p: '0' }].map(f => (
                      <div key={f.k} className="space-y-1">
                        <label className="text-[10px] font-black uppercase opacity-40 px-1 tracking-widest">{f.l}</label>
                        <input 
                          type="number" 
                          placeholder={f.p} 
                          value={(dailyForm as any)[f.k]} 
                          onChange={(e) => setDailyForm({...dailyForm, [f.k]: e.target.value})}
                          className={`w-full p-4 rounded-xl border-2 font-black text-xl outline-none focus:border-blue-500 transition-all ${theme.card} ${theme.border} ${theme.text}`} 
                        />
                        {f.k === 'rhr' && rhrLiveWarning && (
                           <div className="mt-2 p-3 bg-yellow-500/15 border border-yellow-500/30 rounded-xl flex items-center gap-2">
                             <ShieldAlert size={16} className="text-yellow-500 flex-shrink-0" />
                             <p className="text-[11px] font-bold text-yellow-600 leading-tight">{rhrLiveWarning}</p>
                           </div>
                        )}
                      </div>
                    ))}
                    <button 
                      onClick={addDailyLog} 
                      className="w-full bg-accent-gradient py-5 rounded-xl font-black text-[#00E676] text-base shadow-lg shadow-blue-500/30 active:scale-95 transition-all border-none"
                    >
                      完成打卡
                    </button>
                 </div>
               ) : (
                 <div className={`p-5 rounded-2xl ${theme.card} ${theme.border} border shadow-lg space-y-4`}>
                    <div className="flex items-center gap-2 mb-2">
                       <Ruler size={18} className="text-orange-500" />
                       <h3 className={`text-sm font-black ${theme.text}`}>身体围度监控</h3>
                    </div>
                    {[{ k: 'waist', l: '腰围 (CM)', p: '0.0' }, { k: 'leftArm', l: '左臂围 (CM)', p: '0.0' }, { k: 'rightArm', l: '右臂围 (CM)', p: '0.0' }].map(f => (
                      <div key={f.k} className="space-y-1">
                        <label className="text-[10px] font-black uppercase opacity-40 px-1 tracking-widest">{f.l}</label>
                        <input 
                          type="number" 
                          placeholder={f.p} 
                          value={(weeklyForm as any)[f.k]}
                          onChange={(e) => setWeeklyForm({...weeklyForm, [f.k]: e.target.value})}
                          className={`w-full p-4 rounded-xl border-2 font-black text-xl outline-none focus:border-blue-500 transition-all ${theme.card} ${theme.border} ${theme.text}`} 
                        />
                      </div>
                    ))}

                    {/* 照片上传部分 */}
                    <div className="space-y-2 mt-2">
                      <label className="text-[10px] font-black uppercase opacity-40 px-1 tracking-widest">状态对比照片</label>
                      <div className="flex flex-wrap gap-2">
                        {weeklyForm.photos.map((photo, idx) => (
                          <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-500/20 group">
                            <img src={photo} alt={`fitness-${idx}`} className="w-full h-full object-cover" />
                            <button 
                              onClick={() => removePhoto(idx)}
                              className="absolute top-1 right-1 p-1 bg-red-500 rounded-full text-white shadow-md active:scale-75 transition-transform"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className={`w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 active:scale-95 transition-all ${theme.border} ${isDark ? 'bg-black/20' : 'bg-slate-50'}`}
                        >
                          <Camera size={20} className="text-blue-500 opacity-60" />
                          <span className="text-[9px] font-black uppercase opacity-40">添加照片</span>
                        </button>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handlePhotoUpload} 
                        accept="image/*" 
                        multiple 
                        className="hidden" 
                      />
                    </div>

                    <button 
                      onClick={addWeeklyLog} 
                      className="w-full bg-accent-gradient py-5 rounded-xl font-black text-[#00E676] text-base shadow-lg shadow-orange-500/20 active:scale-95 transition-all border-none"
                    >
                      保存周数据
                    </button>
                 </div>
               )}
             </div>
          )}

          {view === 'history' && (
            <div className="space-y-3">
               {state.dailyLogs.length > 0 ? state.dailyLogs.map(log => (
                 <div key={log.id} className={`p-4 rounded-xl border ${theme.card} ${theme.border} flex justify-between items-center shadow-sm`}>
                    <div>
                      <div className="text-[9px] font-extrabold opacity-50 mb-0.5">{new Date(log.date).toLocaleDateString()}</div>
                      <div className={`text-[14px] font-black ${theme.text}`}>{log.weight}kg | {log.sleep}h | {log.rhr}bpm</div>
                    </div>
                    <button onClick={() => setState(p => ({...p, dailyLogs: p.dailyLogs.filter(l => l.id !== log.id)}))} className="p-2 text-red-500 active:scale-75 transition-transform"><Trash2 size={18} /></button>
                 </div>
               )) : <div className="py-10 text-center opacity-30 italic text-xs">暂无历史记录</div>}
               
               {/* 历史记录中显示周记录 */}
               {state.weeklyLogs.length > 0 && (
                 <div className="pt-4 border-t border-slate-500/10 space-y-3">
                   <h4 className="text-[10px] font-black uppercase opacity-40 tracking-widest px-1">周记录历史</h4>
                   {state.weeklyLogs.map(log => (
                     <div key={log.id} className={`p-4 rounded-xl border ${theme.card} ${theme.border} space-y-3 shadow-sm`}>
                        <div className="flex justify-between items-center">
                          <div className="text-[9px] font-extrabold opacity-50">{new Date(log.date).toLocaleDateString()}</div>
                          <button onClick={() => setState(p => ({...p, weeklyLogs: p.weeklyLogs.filter(l => l.id !== log.id)}))} className="p-1 text-red-500 active:scale-75 transition-transform"><Trash2 size={14} /></button>
                        </div>
                        <div className={`text-[13px] font-black ${theme.text}`}>
                          腰围: {log.waist}cm | 臂围: {log.leftArm}/{log.rightArm}cm
                        </div>
                        {log.photos && log.photos.length > 0 && (
                          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                            {log.photos.map((p, i) => (
                              <img key={i} src={p} alt="progress" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                            ))}
                          </div>
                        )}
                     </div>
                   ))}
                 </div>
               )}
            </div>
          )}
          
          {view === 'settings' && (
            <section className={`p-5 rounded-2xl ${theme.card} ${theme.border} border shadow-lg space-y-6`}>
              <div className="flex items-center gap-3">
                <User size={20} className="text-blue-500" />
                <h2 className={`text-lg font-black ${theme.text}`}>个人档案</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase opacity-40 px-1 tracking-widest">身高 (CM)</label>
                  <input type="number" value={state.profile.height} onChange={(e) => updateProfile({ height: Number(e.target.value) })} className={`w-full p-4 rounded-xl border font-black text-lg outline-none ${theme.card} ${theme.border} ${theme.text}`} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase opacity-40 px-1 tracking-widest">年龄 (YR)</label>
                  <input type="number" value={state.profile.age} onChange={(e) => updateProfile({ age: Number(e.target.value) })} className={`w-full p-4 rounded-xl border font-black text-lg outline-none ${theme.card} ${theme.border} ${theme.text}`} />
                </div>
              </div>
              <button onClick={() => setView('dashboard')} className="w-full bg-accent-gradient py-4 rounded-xl font-black text-white text-sm shadow-md active:scale-95 transition-all">保存设置</button>
            </section>
          )}
        </main>
      </div>

      <nav className={`app-nav ${theme.nav} backdrop-blur-xl border-t ${theme.border} px-2 pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.1)]`}>
        <div className="max-w-md mx-auto flex justify-around items-center">
          {[
            { id: 'dashboard', label: '状态', icon: <BarChart2 size={22} /> },
            { id: 'logs', label: '打卡', icon: <PlusCircle size={22} /> },
            { id: 'nutrition', label: '场景', icon: <Zap size={22} /> },
            { id: 'history', label: '历史', icon: <History size={22} /> }
          ].map(item => (
            <button key={item.id} onClick={() => setView(item.id as any)} className={`flex flex-col items-center gap-1 py-1 transition-all ${view === item.id ? 'text-blue-500' : 'text-slate-400 opacity-60'}`}>
              <div className={view === item.id ? 'bg-blue-500/10 p-1.5 rounded-xl' : 'p-1.5'}>
                {item.icon}
              </div>
              <span className={`text-[9px] font-black uppercase tracking-tight ${view === item.id ? 'text-blue-500' : ''}`}>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default App;
