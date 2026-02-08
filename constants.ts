
import { AppState } from './types';

export const INITIAL_STATE: AppState = {
  profile: {
    height: 175,
    weight: 75,
    age: 28,
    gender: 'male',
    activityLevel: 1.55,
    bmi: 24.5,
    tdee: 1850,
    selectedMode: '上班+ 训练',
    macros: {
      carbs: 45,
      fat: 25,
      protein: 30
    }
  },
  dailyLogs: [],
  weeklyLogs: []
};

export const STORAGE_KEY = 'fitfocus_data_v4'; // Version increment for new logic

export const MACRO_CALORIES = {
  protein: 4,
  carbs: 4,
  fat: 9
};

export const MAX_HISTORY_DAYS = 365;

export const SCENARIO_MODES = [
  { name: '上班+ 训练', calories: 1850 },
  { name: '上班+ 休息', calories: 1750 },
  { name: '休假+ 训练', calories: 1700 },
  { name: '休假+ 休息', calories: 1550 },
];
