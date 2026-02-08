
// Added WeeklyCheckIn to the imports from './types'
import { UserProfile, DailyLog, WarningLevel, StatusAlert, WeeklyCheckIn } from './types';
import { MACRO_CALORIES, MAX_HISTORY_DAYS } from './constants';

export const calculateBMR = (profile: UserProfile) => {
  const { weight, height, age, gender } = profile;
  if (gender === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }
  return 10 * weight + 6.25 * height - 5 * age - 161;
};

export const calculateBMI = (weight: number, height: number) => {
  if (!height || !weight || height === 0) return 0;
  const hMeter = height / 100;
  return Number((weight / (hMeter * hMeter)).toFixed(1));
};

export const calculateTDEEValue = (profile: UserProfile) => {
  return Math.round(calculateBMR(profile) * profile.activityLevel);
};

export const adjustMacrosPriority = (
  macroKey: 'carbs' | 'fat' | 'protein',
  newPct: number,
  currentMacros: UserProfile['macros']
): UserProfile['macros'] => {
  const macros = { ...currentMacros };
  const safePct = Math.min(100, Math.max(0, newPct));
  
  if (macroKey === 'carbs') {
    macros.carbs = safePct;
    const remaining = 100 - macros.carbs;
    macros.fat = Math.min(macros.fat, remaining);
    macros.protein = 100 - macros.carbs - macros.fat;
  } else if (macroKey === 'fat') {
    const maxFat = 100 - macros.carbs;
    macros.fat = Math.min(safePct, maxFat);
    macros.protein = 100 - macros.carbs - macros.fat;
  } else if (macroKey === 'protein') {
    const currentMaxProtein = 100 - macros.carbs - macros.fat;
    macros.protein = Math.min(safePct, currentMaxProtein);
    if (macros.carbs + macros.fat + macros.protein < 100) {
       macros.protein = 100 - macros.carbs - macros.fat;
    }
  }

  return macros;
};

export const getMacroGramsFromPct = (tdee: number, pctMacros: UserProfile['macros']) => {
  return {
    protein: Math.round((tdee * (pctMacros.protein / 100)) / MACRO_CALORIES.protein),
    fat: Math.round((tdee * (pctMacros.fat / 100)) / MACRO_CALORIES.fat),
    carbs: Math.round((tdee * (pctMacros.carbs / 100)) / MACRO_CALORIES.carbs)
  };
};

export const getAvgRHR = (logs: DailyLog[]): number => {
  if (!logs || logs.length === 0) return 0;
  const sum = logs.reduce((acc, log) => acc + log.rhr, 0);
  return sum / logs.length;
};

export const getStatusAlert = (logs: DailyLog[]): StatusAlert => {
  if (!logs || logs.length === 0) return { level: WarningLevel.GREEN, message: "数据采集中：请开始您的第一次打卡。" };
  
  const today = logs[0];
  if (today.sleep < 5) {
    return { level: WarningLevel.RED, message: "⚠️ 睡眠严重不足，系统建议停止今日健身，立即休息！" };
  }

  const history = logs.slice(1);
  if (history.length > 0) {
    const avgRHR = getAvgRHR(history);
    if (today.rhr > avgRHR * 1.15) {
      return { level: WarningLevel.YELLOW, message: "⚠️ 心率波动严重异常，建议今日强制休息或极大降低强度。" };
    } else if (today.rhr > avgRHR * 1.10) {
      return { level: WarningLevel.YELLOW, message: "⚠️ 心率波动异常，建议今日训练强度减半。" };
    }
  }

  return { level: WarningLevel.GREEN, message: "适宜健身：各项指标处于正常范围。" };
};

export const cleanupOldLogs = (logs: DailyLog[] | WeeklyCheckIn[]) => {
  const now = new Date().getTime();
  const maxAge = MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
  return logs.filter(log => {
    const logDate = new Date(log.date).getTime();
    return now - logDate < maxAge;
  });
};