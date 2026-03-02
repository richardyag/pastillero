import type { Medication, ScheduledDose } from '../types';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function scheduleNotification(medication: Medication, time: string, dateStr: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!medication.notificationsEnabled) return;

  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const target = new Date(dateStr);
  target.setHours(h, m, 0, 0);

  const delay = target.getTime() - now.getTime();
  if (delay <= 0) return;

  setTimeout(() => {
    new Notification(`💊 Hora de tomar ${medication.name}`, {
      body: `${medication.dosage} - ${medication.type}${medication.instructions ? '\n' + medication.instructions : ''}`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: `med-${medication.id}-${dateStr}-${time}`,
      requireInteraction: true,
      silent: false,
    });

    // Snooze reminder
    if (medication.snoozeMinutes > 0) {
      setTimeout(() => {
        new Notification(`⏰ Recordatorio: ${medication.name}`, {
          body: `No olvides tomar ${medication.dosage}`,
          icon: '/pwa-192x192.png',
          tag: `med-snooze-${medication.id}-${dateStr}-${time}`,
        });
      }, medication.snoozeMinutes * 60 * 1000);
    }
  }, delay);
}

export function cancelNotification(medication: Medication, time: string, dateStr: string) {
  // Web Notifications API doesn't support cancellation by tag directly,
  // but we store scheduled IDs in localStorage to skip them
  const key = `cancelled-${medication.id}-${dateStr}-${time}`;
  localStorage.setItem(key, '1');
}

export function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (_) {
    // Audio not supported
  }
}

let checkInterval: ReturnType<typeof setInterval> | null = null;

export function startNotificationChecker(
  getDoses: () => ScheduledDose[],
  onDue: (dose: ScheduledDose) => void
) {
  if (checkInterval) clearInterval(checkInterval);

  const check = () => {
    const doses = getDoses();
    for (const dose of doses) {
      if (dose.status === 'due' && !dose.log) {
        onDue(dose);
      }
    }
  };

  check();
  checkInterval = setInterval(check, 60 * 1000); // every minute
  return () => {
    if (checkInterval) clearInterval(checkInterval);
  };
}
