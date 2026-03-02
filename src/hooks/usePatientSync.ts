import { useEffect, useRef } from 'react';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDB } from '../utils/firebase';
import { db as localDb } from '../db/database';
import type { Medication, DoseLog } from '../types';

// ── Firestore paths ───────────────────────────────────────────────────────────
// sharedPatients/{profileUuid}/medications/{medUuid}
// sharedPatients/{profileUuid}/logs/{logUuid}
// ─────────────────────────────────────────────────────────────────────────────

// Formato de logs en Firestore: usa UUIDs en lugar de los IDs locales enteros
export interface FirestoreLog {
  uuid:           string;
  medicationUuid: string;
  profileUuid:    string;
  scheduledTime:  string;
  scheduledDate:  string;
  takenAt?:       string; // ISO string
  status:         DoseLog['status'];
  notes?:         string;
}

// ── Push de un medicamento a Firestore ───────────────────────────────────────
export async function pushMedication(
  profileUuid: string,
  medication: Medication
): Promise<void> {
  const fs = getFirestoreDB();
  if (!fs || !medication.uuid) return;

  // Omitir campos locales que no viajan a la nube
  const { id: _id, photo: _photo, remainingPills: _rp, profileId: _pid, ...safe } = medication;

  await setDoc(
    doc(fs, 'sharedPatients', profileUuid, 'medications', medication.uuid),
    { ...safe, profileUuid, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ── Push de un DoseLog a Firestore ───────────────────────────────────────────
export async function pushLog(
  profileUuid:   string,
  log:           DoseLog,
  medicationUuid: string
): Promise<void> {
  const fs = getFirestoreDB();
  if (!fs || !log.uuid) return;

  const payload: Omit<FirestoreLog, never> = {
    uuid:           log.uuid,
    medicationUuid,
    profileUuid,
    scheduledTime:  log.scheduledTime,
    scheduledDate:  log.scheduledDate,
    takenAt:        log.takenAt ? new Date(log.takenAt).toISOString() : undefined,
    status:         log.status,
    notes:          log.notes,
  };

  await setDoc(
    doc(fs, 'sharedPatients', profileUuid, 'logs', log.uuid),
    payload,
    { merge: true }
  );
}

// ── Subir todos los medicamentos al activar sync por primera vez ──────────────
export async function uploadAllMedications(
  profileUuid: string,
  profileId:   number
): Promise<void> {
  const meds = await localDb.medications.where('profileId').equals(profileId).toArray();
  for (const med of meds) {
    await pushMedication(profileUuid, med);
  }
}

// ── Descargar medicamentos remotos (para el familiar que se une) ──────────────
export async function fetchRemoteMedications(profileUuid: string) {
  const fs = getFirestoreDB();
  if (!fs) return [];
  const snap = await getDocs(collection(fs, 'sharedPatients', profileUuid, 'medications'));
  return snap.docs.map((d) => ({ uuid: d.id, ...(d.data() as Omit<Medication, 'id' | 'uuid'>) }));
}

// ── Hook de listener en tiempo real ──────────────────────────────────────────
export function usePatientSync(
  profileUuid: string | undefined,
  profileId:   number | undefined,
  syncEnabled: boolean
) {
  const unsubLogs = useRef<Unsubscribe | null>(null);
  const unsubMeds = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    // Limpiar suscripciones anteriores
    unsubLogs.current?.();
    unsubMeds.current?.();

    if (!syncEnabled || !profileUuid || !profileId) return;

    const fs = getFirestoreDB();
    if (!fs) return;

    // ── Listener de medicamentos ─────────────────────────────────────────────
    unsubMeds.current = onSnapshot(
      collection(fs, 'sharedPatients', profileUuid, 'medications'),
      async (snap) => {
        for (const change of snap.docChanges()) {
          if (change.type === 'removed') continue;

          const data = change.doc.data() as Medication & { profileUuid?: string; updatedAt?: { toDate?: () => Date } };
          const medUuid = change.doc.id;

          const existing = await localDb.medications.where('uuid').equals(medUuid).first();

          if (!existing) {
            await localDb.medications.add({
              ...data,
              id:            undefined,
              uuid:          medUuid,
              profileId,
              createdAt:     new Date(),
              updatedAt:     new Date(),
              remainingPills: data.totalPills,
            });
          } else {
            // Comparar updatedAt: solo actualizar si el remoto es más nuevo
            const remoteTs = data.updatedAt?.toDate?.()?.getTime() ?? 0;
            const localTs  = existing.updatedAt?.getTime() ?? 0;
            if (remoteTs > localTs) {
              await localDb.medications.update(existing.id!, {
                name:          data.name,
                type:          data.type,
                dosage:        data.dosage,
                instructions:  data.instructions,
                frequency:     data.frequency,
                intervalHours: data.intervalHours,
                specificDays:  data.specificDays,
                scheduleTimes: data.scheduleTimes,
                startDate:     data.startDate,
                endDate:       data.endDate,
                active:        data.active,
                updatedAt:     new Date(),
              });
            }
          }
        }
      }
    );

    // ── Listener de registros de dosis ───────────────────────────────────────
    unsubLogs.current = onSnapshot(
      collection(fs, 'sharedPatients', profileUuid, 'logs'),
      async (snap) => {
        for (const change of snap.docChanges()) {
          if (change.type === 'removed') continue;

          const data    = change.doc.data() as FirestoreLog;
          const logUuid = change.doc.id;

          // Buscar el medicamento local por UUID
          const localMed = await localDb.medications.where('uuid').equals(data.medicationUuid).first();
          if (!localMed?.id) continue;

          const existingLog = await localDb.doseLogs.where('uuid').equals(logUuid).first();

          const logRecord: Omit<DoseLog, 'id'> = {
            uuid:          logUuid,
            medicationId:  localMed.id,
            profileId,
            scheduledTime: data.scheduledTime,
            scheduledDate: data.scheduledDate,
            takenAt:       data.takenAt ? new Date(data.takenAt) : undefined,
            status:        data.status,
            notes:         data.notes,
          };

          if (!existingLog) {
            await localDb.doseLogs.add(logRecord);
          } else if (existingLog.status !== data.status || existingLog.notes !== data.notes) {
            // Actualizar solo si cambió algo (last-write-wins)
            await localDb.doseLogs.update(existingLog.id!, {
              status: data.status,
              takenAt: logRecord.takenAt,
              notes:   data.notes,
            });
          }
        }
      }
    );

    return () => {
      unsubLogs.current?.();
      unsubMeds.current?.();
    };
  }, [syncEnabled, profileUuid, profileId]);
}
