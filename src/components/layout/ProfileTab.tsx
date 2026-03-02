import { useContext } from 'react';
import { useProfiles } from '../../hooks/useProfiles';
import { ProfileContext } from '../../context/ProfileContext';

export function ProfileTab() {
  const profiles = useProfiles();
  const { activeProfile, setActiveProfileId } = useContext(ProfileContext);

  if (profiles.length <= 1) return null;

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {profiles.map((profile) => {
          const isActive = activeProfile?.id === profile.id;
          return (
            <button
              key={profile.id}
              onClick={() => setActiveProfileId(profile.id!)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                isActive
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={isActive ? { backgroundColor: profile.color } : {}}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : profile.color }}
              >
                {profile.avatar
                  ? <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover rounded-full" />
                  : profile.name.charAt(0).toUpperCase()
                }
              </div>
              {profile.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
