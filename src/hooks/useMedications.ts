import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Medication, DoseLog } from '../types';

export function useMedications(profileId: number | undefined): Medication[] {
  const medications = useLiveQuery<Medication[]>(
    async () => {
      if (profileId === undefined) return [];
      return db.medications.where('profileId').equals(profileId).toArray();
    },
    [profileId]
  );
  return medications ?? [];
}

export function useDoseLogs(profileId: number | undefined, dateStr?: string): DoseLog[] {
  const logs = useLiveQuery<DoseLog[]>(
    async () => {
      if (profileId === undefined) return [];
      const all = await db.doseLogs.where('profileId').equals(profileId).toArray();
      return dateStr ? all.filter((l) => l.scheduledDate === dateStr) : all;
    },
    [profileId, dateStr]
  );
  return logs ?? [];
}

export async function addMedication(medication: Omit<Medication, 'id' | 'createdAt' | 'uuid'> & { uuid?: string }) {
  return db.medications.add({
    ...medication,
    uuid: medication.uuid ?? crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function updateMedication(id: number, changes: Partial<Medication>) {
  // Actualiza updatedAt solo si cambiaron campos de esquema
  const needsTimestamp = changes.scheduleTimes !== undefined
    || changes.frequency !== undefined
    || changes.intervalHours !== undefined
    || changes.specificDays !== undefined
    || changes.dosage !== undefined
    || changes.endDate !== undefined;

  return db.medications.update(id, {
    ...changes,
    ...(needsTimestamp ? { updatedAt: new Date() } : {}),
  });
}

export async function deleteMedication(id: number) {
  await db.doseLogs.where('medicationId').equals(id).delete();
  await db.medications.delete(id);
}

export async function logDose(
  medicationId: number,
  profileId: number,
  scheduledTime: string,
  scheduledDate: string,
  status: 'taken' | 'skipped',
  notes?: string
) {
  // Eliminar registro previo del mismo slot si existe
  await db.doseLogs
    .where('medicationId').equals(medicationId)
    .and((l) => l.scheduledDate === scheduledDate && l.scheduledTime === scheduledTime)
    .delete();

  const id = await db.doseLogs.add({
    uuid: crypto.randomUUID(),
    medicationId,
    profileId,
    scheduledTime,
    scheduledDate,
    takenAt: status === 'taken' ? new Date() : undefined,
    status,
    notes,
  });

  if (status === 'taken') {
    const med = await db.medications.get(medicationId);
    if (med?.remainingPills !== undefined && med.remainingPills > 0) {
      await db.medications.update(medicationId, {
        remainingPills: med.remainingPills - 1,
      });
    }
  }

  return id;
}
