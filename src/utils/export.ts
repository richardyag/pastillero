import type { Profile, Medication, DoseLog, ExportData, ImportResult, ScheduleTime, DayOfWeek } from '../types';
import { db } from '../db/database';

export function exportProfileData(
  profile: Profile,
  medications: Medication[],
  recentLogs: DoseLog[]
): string {
  const data: ExportData = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    profile,
    // Exportar sin id local (el uuid es el identificador real)
    medications: medications.map(({ id: _id, ...m }) => m as Medication),
    recentLogs: recentLogs.slice(-200).map(({ id: _id, ...l }) => l as DoseLog),
  };
  return JSON.stringify(data, null, 2);
}

export function downloadExport(profile: Profile, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = profile.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  a.download = `pastillero_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseImportData(content: string): ExportData | null {
  try {
    const data = JSON.parse(content) as ExportData;
    if (!data.version || !data.profile || !Array.isArray(data.medications)) return null;
    // Compatibilidad con versión 1.0 (sin uuid): generamos uuid temporales
    if (!data.profile.uuid) data.profile.uuid = crypto.randomUUID();
    data.medications = data.medications.map((m) => ({
      ...m,
      uuid: m.uuid ?? crypto.randomUUID(),
    }));
    data.recentLogs = (data.recentLogs ?? []).map((l) => ({
      ...l,
      uuid: l.uuid ?? crypto.randomUUID(),
    }));
    return data;
  } catch {
    return null;
  }
}

/**
 * Compara dos conjuntos de campos clínicos/de programación para determinar
 * si el esquema de toma cambió y amerita actualizar el registro local.
 */
function scheduleChanged(local: Medication, incoming: Medication): boolean {
  if (local.frequency !== incoming.frequency) return true;
  if (local.dosage !== incoming.dosage) return true;
  if (local.intervalHours !== incoming.intervalHours) return true;
  if (local.endDate !== incoming.endDate) return true;
  if (local.startDate !== incoming.startDate) return true;
  if (local.name !== incoming.name) return true;
  if (local.type !== incoming.type) return true;
  if (local.instructions !== incoming.instructions) return true;

  // Comparar días específicos (ordenados)
  const sortDays = (d?: DayOfWeek[]) => (d ?? []).slice().sort().join(',');
  if (sortDays(local.specificDays) !== sortDays(incoming.specificDays)) return true;

  // Comparar horarios (ordenados)
  const sortTimes = (t: ScheduleTime[]) => t.map((s) => s.time).sort().join(',');
  if (sortTimes(local.scheduleTimes) !== sortTimes(incoming.scheduleTimes)) return true;

  return false;
}

/**
 * Merge inteligente de un perfil importado.
 *
 * Reglas:
 * - El perfil se busca por UUID. Si no existe, se crea.
 * - Cada medicamento se busca por UUID.
 *   · Si no existe → se agrega.
 *   · Si existe y cambió el esquema → se actualizan SOLO los campos clínicos.
 *     Los campos locales (photo, remainingPills, color, notificationsEnabled,
 *     snoozeMinutes) NO se tocan.
 *   · Si existe y es idéntico → no se hace nada.
 * - Los logs se buscan por UUID.
 *   · Si no existe → se agrega.
 *   · Si ya existe → se ignora (nunca se sobreescribe un log local).
 * - NUNCA se tocan perfiles o medicamentos que pertenezcan a otro profileId.
 */
export async function mergeImportData(data: ExportData): Promise<{ result: ImportResult; profileId: number }> {
  const result: ImportResult = {
    profileCreated: false,
    profileUpdated: false,
    medicationsAdded: 0,
    medicationsUpdated: 0,
    medicationsUnchanged: 0,
    logsAdded: 0,
    logsDuplicated: 0,
  };

  // ── 1. Resolver perfil ──────────────────────────────────────────────────────
  const existingProfiles = await db.profiles.toArray();
  const matchedProfile = existingProfiles.find((p) => p.uuid === data.profile.uuid);

  let profileId: number;
  if (matchedProfile?.id) {
    profileId = matchedProfile.id;
    // Actualizar metadata del perfil (nombre, color, etc.) pero NUNCA isDefault
    await db.profiles.update(profileId, {
      name: data.profile.name,
      relationship: data.profile.relationship,
      birthDate: data.profile.birthDate,
      color: data.profile.color,
      // avatar: no se sobreescribe (puede tener foto local)
    });
    result.profileUpdated = true;
  } else {
    profileId = Number(
      await db.profiles.add({
        uuid: data.profile.uuid,
        name: data.profile.name,
        relationship: data.profile.relationship,
        birthDate: data.profile.birthDate,
        color: data.profile.color,
        createdAt: new Date(),
        isDefault: false,
        // avatar: omitido intencionalmente para que el hermano lo personalice
      })
    );
    result.profileCreated = true;
  }

  // ── 2. Resolver medicamentos ────────────────────────────────────────────────
  // Solo traemos meds del profileId resuelto (no tocamos meds de otros perfiles)
  const localMeds = await db.medications.where('profileId').equals(profileId).toArray();

  for (const incomingMed of data.medications) {
    const localMed = localMeds.find((m) => m.uuid === incomingMed.uuid);

    if (!localMed) {
      // Medicamento nuevo: agregar con id local propio
      await db.medications.add({
        ...incomingMed,
        id: undefined,
        profileId,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Resetear campos de tracking local
        remainingPills: incomingMed.totalPills,
      });
      result.medicationsAdded++;
    } else if (scheduleChanged(localMed, incomingMed)) {
      // Esquema cambió: actualizar solo campos clínicos/de programación
      await db.medications.update(localMed.id!, {
        name: incomingMed.name,
        type: incomingMed.type,
        dosage: incomingMed.dosage,
        instructions: incomingMed.instructions,
        frequency: incomingMed.frequency,
        intervalHours: incomingMed.intervalHours,
        specificDays: incomingMed.specificDays,
        scheduleTimes: incomingMed.scheduleTimes,
        startDate: incomingMed.startDate,
        endDate: incomingMed.endDate,
        active: incomingMed.active,
        updatedAt: new Date(),
        // NO se actualizan: photo, color, remainingPills, totalPills,
        //   notificationsEnabled, snoozeMinutes (son preferencias locales)
      });
      result.medicationsUpdated++;
    } else {
      result.medicationsUnchanged++;
    }
  }

  // ── 3. Resolver logs ────────────────────────────────────────────────────────
  // Solo logs del profileId resuelto
  const localLogs = await db.doseLogs.where('profileId').equals(profileId).toArray();
  const localLogUuids = new Set(localLogs.map((l) => l.uuid));

  // También necesitamos mapear medicationUuid → id local para los logs nuevos
  const updatedLocalMeds = await db.medications.where('profileId').equals(profileId).toArray();
  const uuidToLocalMedId = new Map(updatedLocalMeds.map((m) => [m.uuid, m.id!]));
  // Y uuid → id para los meds del export (para resolver el medicationId en los logs)
  const exportMedIdToUuid = new Map(data.medications.map((m) => [m.id, m.uuid]));

  for (const incomingLog of data.recentLogs) {
    if (localLogUuids.has(incomingLog.uuid)) {
      // Ya existe: nunca sobreescribimos logs locales
      result.logsDuplicated++;
      continue;
    }

    // Resolver el medicationId local a partir del uuid del medicamento
    const medUuid = exportMedIdToUuid.get(incomingLog.medicationId);
    const localMedId = medUuid ? uuidToLocalMedId.get(medUuid) : undefined;

    if (!localMedId) {
      // No encontramos el medicamento local → ignorar este log
      result.logsDuplicated++;
      continue;
    }

    await db.doseLogs.add({
      ...incomingLog,
      id: undefined,
      uuid: incomingLog.uuid,
      profileId,
      medicationId: localMedId,
    });
    result.logsAdded++;
  }

  return { result, profileId };
}

export function generateShareableText(profile: Profile, medications: Medication[]): string {
  const lines: string[] = [
    `=== PASTILLERO - Medicación de ${profile.name} ===`,
    `Exportado: ${new Date().toLocaleDateString('es-AR', { dateStyle: 'long' })}`,
    '',
  ];

  for (const med of medications.filter((m) => m.active)) {
    lines.push(`• ${med.name} (${med.dosage})`);
    lines.push(`  Tipo: ${typeLabel(med.type)}`);
    lines.push(`  Frecuencia: ${frequencyLabel(med)}`);
    lines.push(`  Horarios: ${med.scheduleTimes.map((t) => t.time).join(', ')}`);
    if (med.instructions) lines.push(`  Instrucciones: ${med.instructions}`);
    if (med.endDate) lines.push(`  Hasta: ${med.endDate}`);
    lines.push('');
  }

  lines.push('---');
  lines.push(`Código de perfil: ${profile.uuid}`);
  lines.push('Para importar en la app Pastillero, use el archivo .json adjunto.');

  return lines.join('\n');
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    pill: 'Pastilla/Comprimido', syrup: 'Jarabe', injection: 'Inyección',
    drops: 'Gotas', patch: 'Parche', inhaler: 'Inhalador', other: 'Otro',
  };
  return labels[type] ?? type;
}

function frequencyLabel(med: Medication): string {
  if (med.frequency === 'daily') return 'Diario';
  if (med.frequency === 'every_x_hours') return `Cada ${med.intervalHours} horas`;
  if (med.frequency === 'as_needed') return 'Según necesidad';
  if (med.frequency === 'specific_days') {
    const DAY = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return (med.specificDays ?? []).map((d) => DAY[d]).join(', ');
  }
  return med.frequency;
}
