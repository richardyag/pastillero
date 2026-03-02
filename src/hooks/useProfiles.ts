import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Profile } from '../types';

export function useProfiles() {
  const profiles = useLiveQuery(() => db.profiles.orderBy('createdAt').toArray(), []);
  return profiles ?? [];
}

export async function addProfile(profile: Omit<Profile, 'id' | 'createdAt'>) {
  return db.profiles.add({ ...profile, createdAt: new Date() });
}

export async function updateProfile(id: number, changes: Partial<Profile>) {
  return db.profiles.update(id, changes);
}

export async function deleteProfile(id: number) {
  // Also delete associated medications and logs
  const meds = await db.medications.where('profileId').equals(id).toArray();
  const medIds = meds.map((m) => m.id!);
  await db.doseLogs.where('profileId').equals(id).delete();
  if (medIds.length > 0) {
    await db.medications.bulkDelete(medIds);
  }
  await db.profiles.delete(id);
}
