import { format, isToday, isBefore, addMinutes, parseISO, startOfDay } from 'date-fns';
import type { Medication, DoseLog, ScheduledDose } from '../types';

export function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function getTimeBucket(time: string): 'morning' | 'afternoon' | 'evening' | 'night' {
  const [hours] = time.split(':').map(Number);
  if (hours < 12) return 'morning';
  if (hours < 17) return 'afternoon';
  if (hours < 21) return 'evening';
  return 'night';
}

export function timeBucketLabel(bucket: string): string {
  const labels: Record<string, string> = {
    morning: 'Mañana',
    afternoon: 'Tarde',
    evening: 'Noche',
    night: 'Madrugada',
  };
  return labels[bucket] ?? bucket;
}

export function isScheduledForDate(medication: Medication, dateStr: string): boolean {
  if (!medication.active) return false;
  if (medication.startDate > dateStr) return false;
  if (medication.endDate && medication.endDate < dateStr) return false;

  if (medication.frequency === 'as_needed') return false;

  if (medication.frequency === 'specific_days' && medication.specificDays) {
    const dayOfWeek = parseISO(dateStr).getDay() as 0|1|2|3|4|5|6;
    return medication.specificDays.includes(dayOfWeek);
  }

  return true; // daily and every_x_hours always apply
}

export function buildScheduledDoses(
  medications: Medication[],
  logs: DoseLog[],
  dateStr: string
): ScheduledDose[] {
  const now = new Date();
  const doses: ScheduledDose[] = [];

  for (const med of medications) {
    if (!isScheduledForDate(med, dateStr)) continue;

    for (const schedTime of med.scheduleTimes) {
      const log = logs.find(
        (l) =>
          l.medicationId === med.id &&
          l.scheduledDate === dateStr &&
          l.scheduledTime === schedTime.time
      );

      let status: ScheduledDose['status'];
      if (log) {
        status = log.status === 'taken' ? 'taken' : log.status === 'skipped' ? 'skipped' : 'missed';
      } else {
        const [h, m] = schedTime.time.split(':').map(Number);
        const scheduledDt = new Date();
        scheduledDt.setHours(h, m, 0, 0);

        if (!isToday(parseISO(dateStr))) {
          status = isBefore(parseISO(dateStr), startOfDay(now)) ? 'missed' : 'upcoming';
        } else if (isBefore(addMinutes(scheduledDt, 30), now)) {
          status = 'overdue';
        } else if (isBefore(scheduledDt, addMinutes(now, 15))) {
          status = 'due';
        } else {
          status = 'upcoming';
        }
      }

      doses.push({
        medication: med,
        scheduledTime: schedTime.time,
        scheduledDate: dateStr,
        log,
        status,
      });
    }
  }

  return doses.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

export function calculateAdherence(logs: DoseLog[]): number {
  if (logs.length === 0) return 100;
  const taken = logs.filter((l) => l.status === 'taken').length;
  const relevant = logs.filter((l) => l.status !== 'snoozed').length;
  return relevant === 0 ? 100 : Math.round((taken / relevant) * 100);
}

export function getStreakDays(logs: DoseLog[], dateStr: string): number {
  let streak = 0;
  let current = new Date(dateStr);

  for (let i = 0; i < 365; i++) {
    const ds = format(current, 'yyyy-MM-dd');
    const dayLogs = logs.filter((l) => l.scheduledDate === ds);
    if (dayLogs.length === 0) break;
    const allTaken = dayLogs.every((l) => l.status === 'taken');
    if (!allTaken) break;
    streak++;
    current.setDate(current.getDate() - 1);
  }

  return streak;
}
