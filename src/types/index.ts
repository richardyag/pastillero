export type MedicationType = 'pill' | 'syrup' | 'injection' | 'drops' | 'patch' | 'inhaler' | 'other';
export type FrequencyType = 'daily' | 'every_x_hours' | 'specific_days' | 'as_needed';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday

export interface Profile {
  id?: number;
  uuid: string;        // Identificador estable para sincronización entre dispositivos
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
  label?: string;
}

export interface Medication {
  id?: number;
  uuid: string;        // Identificador estable para sincronización entre dispositivos
  profileId: number;
  name: string;
  type: MedicationType;
  dosage: string;
  instructions?: string;
  photo?: string; // base64 — solo local, no se sobreescribe al importar
  color: string;
  frequency: FrequencyType;
  intervalHours?: number;
  specificDays?: DayOfWeek[];
  scheduleTimes: ScheduleTime[];
  startDate: string;
  endDate?: string;
  totalPills?: number;
  remainingPills?: number; // solo local, no se sobreescribe al importar
  notificationsEnabled: boolean;
  snoozeMinutes: number;
  active: boolean;
  createdAt: Date;
  updatedAt?: Date;    // Fecha de última modificación del esquema
}

export interface DoseLog {
  id?: number;
  uuid: string;        // Identificador estable para deduplicación
  medicationId: number;
  profileId: number;
  scheduledTime: string;
  scheduledDate: string;
  takenAt?: Date;
  status: 'taken' | 'skipped' | 'missed' | 'snoozed';
  notes?: string;
  photo?: string;
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

// Resultado detallado del merge para mostrar al usuario
export interface ImportResult {
  profileCreated: boolean;
  profileUpdated: boolean;
  medicationsAdded: number;
  medicationsUpdated: number;       // Solo los que cambiaron de esquema
  medicationsUnchanged: number;     // Los que estaban iguales, sin tocar
  logsAdded: number;
  logsDuplicated: number;           // Ignorados por ya existir
}
