import { useContext } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProfileProvider } from './context/ProfileContext';
import { ProfileContext } from './context/ProfileContext';
import { usePatientSync } from './hooks/usePatientSync';
import { Home } from './pages/Home';
import { Medications } from './pages/Medications';
import { History } from './pages/History';
import { Profiles } from './pages/Profiles';
import { Settings } from './pages/Settings';

// Monta el listener de Firestore para el perfil activo.
// Vive dentro de ProfileProvider para poder leer el contexto.
// Re-suscribe automáticamente cuando cambia el perfil activo.
function SyncBridge() {
  const { activeProfile } = useContext(ProfileContext);
  usePatientSync(
    activeProfile?.uuid,
    activeProfile?.id,
    !!activeProfile?.syncEnabled
  );
  return null;
}

export default function App() {
  return (
    <ProfileProvider>
      <SyncBridge />
      {/* HashRouter: evita 404 en GitHub Pages al navegar entre páginas.
          Las rutas quedan como /#/medications en lugar de /medications */}
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/medications" element={<Medications />} />
            <Route path="/history" element={<History />} />
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </ProfileProvider>
  );
}
