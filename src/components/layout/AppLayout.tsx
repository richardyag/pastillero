import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { ProfileTab } from './ProfileTab';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ProfileTab />
      <main className="flex-1 pb-20 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
