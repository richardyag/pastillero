import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProfileProvider } from './context/ProfileContext';
import { Home } from './pages/Home';
import { Medications } from './pages/Medications';
import { History } from './pages/History';
import { Profiles } from './pages/Profiles';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <ProfileProvider>
      <BrowserRouter basename="/pastillero">
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/medications" element={<Medications />} />
            <Route path="/history" element={<History />} />
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ProfileProvider>
  );
}
