import { createContext, useState, useEffect, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Profile } from '../types';

interface ProfileContextValue {
  activeProfile: Profile | undefined;
  setActiveProfileId: (id: number) => void;
}

export const ProfileContext = createContext<ProfileContextValue>({
  activeProfile: undefined,
  setActiveProfileId: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<number | null>(() => {
    const stored = localStorage.getItem('activeProfileId');
    return stored ? parseInt(stored) : null;
  });

  const profiles = useLiveQuery(() => db.profiles.toArray(), []);

  // Auto-select first profile if none selected
  useEffect(() => {
    if (!activeId && profiles && profiles.length > 0) {
      const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0];
      if (defaultProfile.id) {
        setActiveId(defaultProfile.id);
        localStorage.setItem('activeProfileId', String(defaultProfile.id));
      }
    }
  }, [profiles, activeId]);

  const activeProfile = profiles?.find((p) => p.id === activeId);

  const setActiveProfileId = (id: number) => {
    setActiveId(id);
    localStorage.setItem('activeProfileId', String(id));
  };

  return (
    <ProfileContext.Provider value={{ activeProfile, setActiveProfileId }}>
      {children}
    </ProfileContext.Provider>
  );
}
