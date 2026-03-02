import { useState } from 'react';
import { Bell, BellOff, Trash2, Heart } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { requestNotificationPermission } from '../utils/notifications';
import { db } from '../db/database';

export function Settings() {
  const [notifGranted, setNotifGranted] = useState(Notification.permission === 'granted');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleNotifRequest = async () => {
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
  };

  const handleClearLogs = async () => {
    await db.doseLogs.clear();
    setShowClearConfirm(false);
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-black text-gray-900">Ajustes</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Notifications */}
        <Section title="Notificaciones">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              {notifGranted
                ? <Bell size={20} className="text-primary-600" />
                : <BellOff size={20} className="text-gray-400" />
              }
              <div>
                <p className="text-sm font-semibold text-gray-700">
                  {notifGranted ? 'Notificaciones activadas' : 'Notificaciones desactivadas'}
                </p>
                <p className="text-xs text-gray-400">
                  {notifGranted
                    ? 'Recibirás alertas cuando sea hora de tomar medicación'
                    : 'Activa las notificaciones para recibir recordatorios'
                  }
                </p>
              </div>
            </div>
            {!notifGranted && (
              <Button size="sm" onClick={handleNotifRequest}>Activar</Button>
            )}
          </div>
          {notifGranted && (
            <div className="bg-emerald-50 rounded-xl p-3 mt-1">
              <p className="text-xs text-emerald-700">
                ✓ Las notificaciones están activas. Recibirás alertas automáticas según los horarios de cada medicamento.
              </p>
            </div>
          )}
        </Section>

        {/* PWA Install */}
        <Section title="Instalar la app">
          <div className="bg-primary-50 rounded-2xl p-4">
            <p className="text-sm font-semibold text-primary-800 mb-1">Instalar en tu celular</p>
            <p className="text-xs text-primary-600 mb-3">
              Puedes instalar Pastillero como app nativa en tu teléfono. En Android: toca el menú del navegador y selecciona "Instalar app" o "Agregar a pantalla de inicio". En iPhone: toca el botón compartir y luego "Añadir a pantalla de inicio".
            </p>
            <div className="flex gap-2">
              <div className="flex-1 bg-primary-100 rounded-xl p-2 text-center">
                <p className="text-xs font-bold text-primary-700">Android</p>
                <p className="text-xs text-primary-600">Menú ⋮ → Instalar app</p>
              </div>
              <div className="flex-1 bg-primary-100 rounded-xl p-2 text-center">
                <p className="text-xs font-bold text-primary-700">iPhone</p>
                <p className="text-xs text-primary-600">Compartir → Añadir inicio</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Data */}
        <Section title="Datos">
          <div className="space-y-2">
            {cleared && (
              <div className="bg-emerald-50 rounded-xl p-2 text-xs text-emerald-700 font-medium">
                ✓ Historial borrado correctamente
              </div>
            )}
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors text-left"
            >
              <Trash2 size={18} className="text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-700">Borrar historial de dosis</p>
                <p className="text-xs text-gray-400">Elimina todos los registros de tomas. Los medicamentos se conservan.</p>
              </div>
            </button>
          </div>
        </Section>

        {/* About */}
        <Section title="Acerca de">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center">
                <span className="text-2xl">💊</span>
              </div>
              <div>
                <p className="font-bold text-gray-900">Pastillero</p>
                <p className="text-xs text-gray-500">Versión 1.0.0</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              App de gestión de medicamentos para toda la familia. Funciona completamente offline, sin necesidad de cuenta ni internet. Tus datos se guardan solo en tu dispositivo.
            </p>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Heart size={12} className="text-red-400" />
              <span>Hecho con amor para cuidar a quienes más queremos</span>
            </div>
          </div>
        </Section>
      </div>

      {/* Clear confirm modal */}
      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Borrar historial"
        size="sm"
      >
        <p className="text-gray-600 text-sm mb-4">
          ¿Borrar todo el historial de dosis? Los medicamentos configurados no se eliminarán, solo los registros de tomas.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setShowClearConfirm(false)}>Cancelar</Button>
          <Button variant="danger" fullWidth onClick={handleClearLogs}>Borrar historial</Button>
        </div>
      </Modal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-gray-50">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}
