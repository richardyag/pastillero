export type MedicationType = 'pill' | 'syrup' | 'injection' | 'drops' | 'patch' | 'inhaler' | 'other';
export type FrequencyType = 'daily' | 'every_x_hours' | 'specific_days' | 'as_needed';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday

export interface Profile {
  id?: number;
  name: string;
  relationship: 'self' | 'parent' | 'child' | 'partner' | 'sibling' | 'other';
  birthDate?: string;
  color: string;
  avatar?: string; // base64
  createdAt: Date;
  isDefault: boolean;
}

export interface ScheduleTime {
  time: string; // "HH:MM"
  label?: string; // "Mañana", "Tarde", etc.
}

export interface Medication {
  id?: number;
  profileId: number;
  name: string;
  type: MedicationType;
  dosage: string; // e.g., "10mg", "5ml"
  instructions?: string; // special instructions
  photo?: string; // base64 image
  color: string; // pill color for UI
  frequency: FrequencyType;
  intervalHours?: number; // for every_x_hours
  specificDays?: DayOfWeek[]; // for specific_days
  scheduleTimes: ScheduleTime[];
  startDate: string; // ISO date
  endDate?: string; // ISO date, undefined = indefinite
  totalPills?: number; // for refill tracking
  remainingPills?: number;
  notificationsEnabled: boolean;
  snoozeMinutes: number; // 5, 10, 15, 30
  active: boolean;
  createdAt: Date;
}

export interface DoseLog {
  id?: number;
  medicationId: number;
  profileId: number;
  scheduledTime: string; // "HH:MM"
  scheduledDate: string; // ISO date "YYYY-MM-DD"
  takenAt?: Date; // actual time taken
  status: 'taken' | 'skipped' | 'missed' | 'snoozed';
  notes?: string;
  photo?: string; // optional dose photo
}

export interface ScheduledDose {
  medication: Medication;
  scheduledTime: string;
  scheduledDate: string;
  log?: DoseLog;
  status: 'upcoming' | 'due' | 'overdue' | 'taken' | 'skipped' | 'missed';
}

export interface ExportData {
  version: string;
  exportedAt: string;
  profile: Profile;
  medications: Medication[];
  recentLogs: DoseLog[];
}
