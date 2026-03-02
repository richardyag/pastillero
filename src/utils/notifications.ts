import type { Medication, DoseLog } from '../types';
import { isScheduledForDate } from './schedule';

// Ruta base donde están desplegados los assets (GitHub Pages)
const ICON_URL = `${window.location.origin}/pastillero/pwa-192x192.png`;

// Claves de notificaciones ya programadas esta sesión (evita duplicados al re-renderizar)
const scheduledKeys = new Set<string>();

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Programa notificaciones del sistema para todos los medicamentos del día.
 * Se llama cada vez que cambian los medicamentos o los registros de tomas.
 * - Solo programa las dosis que aún no pasaron y no fueron tomadas/omitidas.
 * - Usa la sesión (Set en memoria) para no duplicar si se llama varias veces.
 * - Si el service worker está listo, usa showNotification() para mayor confiabilidad.
 */
export async function scheduleAllDayNotifications(
  medications: Medication[],
  logs: DoseLog[],
  dateStr: string
) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // Obtener registro del SW si está disponible (más confiable que new Notification)
  let swReg: ServiceWorkerRegistration | null = null;
  if ('serviceWorker' in navigator) {
    try {
      swReg = await navigator.serviceWorker.ready;
    } catch {
      // continúa sin SW
    }
  }

  const now = new Date();

  for (const med of medications) {
    if (!med.active || !med.notificationsEnabled) continue;
    if (!isScheduledForDate(med, dateStr)) continue;

    for (const schedTime of med.scheduleTimes) {
      const key = `${med.uuid}-${dateStr}-${schedTime.time}`;

      // Ya programado esta sesión → saltar
      if (scheduledKeys.has(key)) continue;

      // Ya registrado como tomado u omitido → saltar
      const alreadyLogged = logs.some(
        (l) =>
          l.medicationId === med.id &&
          l.scheduledDate === dateStr &&
          l.scheduledTime === schedTime.time &&
          (l.status === 'taken' || l.status === 'skipped')
      );
      if (alreadyLogged) continue;

      // Calcular demora
      const [h, m] = schedTime.time.split(':').map(Number);
      const target = new Date(dateStr);
      target.setHours(h, m, 0, 0);
      const delay = target.getTime() - now.getTime();

      // No programar si ya pasó más de 1 minuto
      if (delay < -60_000) continue;

      scheduledKeys.add(key);

      const fireAt = delay > 0 ? delay : 0;

      setTimeout(async () => {
        // Verificar que no fue tomada/omitida en el intervalo
        const notifTitle = `💊 ${med.name}`;
        const notifBody = `${med.dosage}${med.instructions ? ' · ' + med.instructions : ''}`;
        const notifOptions: NotificationOptions = {
          body: notifBody,
          icon: ICON_URL,
          badge: ICON_URL,
          tag: key,
          requireInteraction: true,
          silent: false,
        };

        if (swReg) {
          // showNotification a través del SW: funciona aunque la pestaña no esté en foco
          await swReg.showNotification(notifTitle, notifOptions);
        } else {
          new Notification(notifTitle, notifOptions);
        }

        playAlertSound();

        // Recordatorio si no respondió
        if (med.snoozeMinutes > 0) {
          setTimeout(async () => {
            const snoozeOpts: NotificationOptions = {
              body: `⏰ Recordatorio: tomar ${med.dosage}`,
              icon: ICON_URL,
              tag: `${key}-snooze`,
            };
            if (swReg) {
              await swReg.showNotification(`${med.name} - Recordatorio`, snoozeOpts);
            } else {
              new Notification(`${med.name} - Recordatorio`, snoozeOpts);
            }
          }, med.snoozeMinutes * 60_000);
        }
      }, fireAt);
    }
  }
}

/**
 * Limpia el registro de notificaciones programadas para una clave específica,
 * para que pueda volver a programarse si el usuario modifica la medicación.
 */
export function clearScheduledKey(medUuid: string, dateStr: string, time: string) {
  scheduledKeys.delete(`${medUuid}-${dateStr}-${time}`);
}

export function playAlertSound() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    // Melodía corta de alerta: sol-mi-sol
    osc.frequency.setValueAtTime(783.99, ctx.currentTime);      // sol5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // mi5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.30); // sol5
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.65);
  } catch {
    // Audio no disponible
  }
}

// ── Checker en-app (banner dentro de la aplicación) ──────────────────────────

let checkInterval: ReturnType<typeof setInterval> | null = null;
// Dosis que ya mostraron el banner esta sesión (evita re-alertar)
const alreadyAlerted = new Set<string>();

export function startInAppChecker(
  getDoses: () => import('../types').ScheduledDose[],
  onDue: (dose: import('../types').ScheduledDose) => void
) {
  if (checkInterval) clearInterval(checkInterval);

  const check = () => {
    const doses = getDoses();
    for (const dose of doses) {
      if (dose.status !== 'due' || dose.log) continue;
      const key = `${dose.medication.uuid}-${dose.scheduledDate}-${dose.scheduledTime}`;
      if (alreadyAlerted.has(key)) continue;
      alreadyAlerted.add(key);
      onDue(dose);
    }
  };

  check();
  checkInterval = setInterval(check, 30_000); // cada 30 segundos
  return () => {
    if (checkInterval) clearInterval(checkInterval);
  };
}

export function clearAlertedKey(medUuid: string, dateStr: string, time: string) {
  alreadyAlerted.delete(`${medUuid}-${dateStr}-${time}`);
}
