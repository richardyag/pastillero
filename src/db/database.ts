import Dexie, { type Table } from 'dexie';
import type { Profile, Medication, DoseLog } from '../types';

export class PastilleroDatabase extends Dexie {
  profiles!: Table<Profile>;
  medications!: Table<Medication>;
  doseLogs!: Table<DoseLog>;

  constructor() {
    super('PastilleroDB');

    // Versión 1: esquema original (sin uuid)
    this.version(1).stores({
      profiles: '++id, name, isDefault, createdAt',
      medications: '++id, profileId, name, active, createdAt',
      doseLogs: '++id, medicationId, profileId, scheduledDate, status, takenAt',
    });

    // Versión 2: agrega uuid a todos los registros
    // Los registros existentes sin uuid reciben uno generado automáticamente en la migración
    this.version(2).stores({
      profiles: '++id, uuid, name, isDefault, createdAt',
      medications: '++id, uuid, profileId, name, active, createdAt',
      doseLogs: '++id, uuid, medicationId, profileId, scheduledDate, status, takenAt',
    }).upgrade(async (trans) => {
      // Asignar UUID a perfiles existentes
      await trans.table('profiles').toCollection().modify((profile) => {
        if (!profile.uuid) {
          profile.uuid = crypto.randomUUID();
        }
      });
      // Asignar UUID a medicamentos existentes
      await trans.table('medications').toCollection().modify((med) => {
        if (!med.uuid) {
          med.uuid = crypto.randomUUID();
        }
      });
      // Asignar UUID a registros de dosis existentes
      await trans.table('doseLogs').toCollection().modify((log) => {
        if (!log.uuid) {
          log.uuid = crypto.randomUUID();
        }
      });
    });
  }
}

export const db = new PastilleroDatabase();

export async function initializeDB() {
  const profileCount = await db.profiles.count();
  if (profileCount === 0) {
    await db.profiles.add({
      uuid: crypto.randomUUID(),
      name: 'Yo',
      relationship: 'self',
      color: '#4f46e5',
      createdAt: new Date(),
      isDefault: true,
    });
  }
}
