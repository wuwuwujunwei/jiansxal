
export interface UserProfile {
  height: number;
  weight: number;
  age: number;
  gender: 'male' | 'female';
  activityLevel: number; 
  bmi?: number;
  tdee?: number; // Total Calorie Budget (TDEE) in kcal
  selectedMode?: string; // 当前选中的场景模式名称
  macros: {
    protein: number; // percentage (0-100)
    fat: number; // percentage (0-100)
    carbs: number; // percentage (0-100)
  };
}

export interface DailyLog {
  id: string;
  date: string;
  weight: number;
  sleep: number;
  rhr: number;
  fatigue: number;
  performance: number;
  isEditable: boolean;
  macrosReached: {
    carbs: boolean;
    fat: boolean;
    protein: boolean;
  };
}

export interface WeeklyCheckIn {
  id: string;
  date: string;
  waist: number;
  leftArm: number;
  rightArm: number;
  photos: string[]; // Base64 encoded strings
  isEditable: boolean;
}

export interface AppState {
  profile: UserProfile;
  dailyLogs: DailyLog[];
  weeklyLogs: WeeklyCheckIn[];
}

export enum WarningLevel {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED'
}

export interface StatusAlert {
  level: WarningLevel;
  message: string;
}
