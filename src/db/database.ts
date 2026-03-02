import Dexie, { type Table } from 'dexie';
import type { Profile, Medication, DoseLog } from '../types';

export class PastilleroDatabase extends Dexie {
  profiles!: Table<Profile>;
  medications!: Table<Medication>;
  doseLogs!: Table<DoseLog>;

  constructor() {
    super('PastilleroDB');

    this.version(1).stores({
      profiles: '++id, name, isDefault, createdAt',
      medications: '++id, profileId, name, active, createdAt',
      doseLogs: '++id, medicationId, profileId, scheduledDate, status, takenAt',
    });
  }
}

export const db = new PastilleroDatabase();

// Initialize with default profile if empty
export async function initializeDB() {
  const profileCount = await db.profiles.count();
  if (profileCount === 0) {
    await db.profiles.add({
      name: 'Yo',
      relationship: 'self',
      color: '#4f46e5',
      createdAt: new Date(),
      isDefault: true,
    });
  }
}
