import { useState, useRef, useContext } from 'react';
import { Plus, Pencil, Trash2, Download, Upload, Share2, Check, Cloud, CloudOff, Copy, LogIn } from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { ProfileForm } from '../components/profiles/ProfileForm';
import { useProfiles, addProfile, updateProfile, deleteProfile } from '../hooks/useProfiles';
import { useMedications } from '../hooks/useMedications';
import { db } from '../db/database';
import { exportProfileData, downloadExport, parseImportData, generateShareableText, mergeImportData } from '../utils/export';
import { isFirebaseConfigured } from '../utils/firebase';
import { uploadAllMedications, fetchRemoteMedications } from '../hooks/usePatientSync';
import { ProfileContext } from '../context/ProfileContext';
import type { Profile, ImportResult } from '../types';
import type { Medication } from '../types';

export function Profiles() {
  const profiles = useProfiles();
  const { activeProfile, setActiveProfileId } = useContext(ProfileContext);
  const [showForm, setShowForm] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Sync state ──────────────────────────────────────────────────────────────
  const syncAvailable = isFirebaseConfigured();
  const [syncModalProfile, setSyncModalProfile] = useState<Profile | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  const handleSave = async (data: Omit<Profile, 'id' | 'createdAt' | 'isDefault' | 'uuid'>) => {
    if (editProfile?.id) {
      await updateProfile(editProfile.id, data);
    } else {
      const id = await addProfile({ ...data, isDefault: false });
      setActiveProfileId(Number(id));
    }
    setShowForm(false);
    setEditProfile(null);
  };

  const handleDelete = async () => {
    if (deleteConfirm?.id) {
      await deleteProfile(deleteConfirm.id);
      if (activeProfile?.id === deleteConfirm.id) {
        const remaining = profiles.filter((p) => p.id !== deleteConfirm.id);
        if (remaining.length > 0) setActiveProfileId(remaining[0].id!);
      }
      setDeleteConfirm(null);
    }
  };

  const handleExport = async (profile: Profile) => {
    const meds = await db.medications.where('profileId').equals(profile.id!).toArray();
    const logs = await db.doseLogs.where('profileId').equals(profile.id!).toArray();
    const content = exportProfileData(profile, meds, logs);
    downloadExport(profile, content);
  };

  const handleShareText = async (profile: Profile) => {
    const meds = await db.medications.where('profileId').equals(profile.id!).toArray();
    const text = generateShareableText(profile, meds);
    if (navigator.share) {
      await navigator.share({ title: `Medicación de ${profile.name}`, text });
    } else {
      await navigator.clipboard.writeText(text);
      alert('Texto copiado al portapapeles');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setImportError('');
      setImportResult(null);
      const content = ev.target?.result as string;
      const data = parseImportData(content);
      if (!data) {
        setImportError('Archivo inválido. Asegúrate de usar un archivo .json exportado desde Pastillero.');
        return;
      }
      try {
        const { result, profileId } = await mergeImportData(data);
        setImportResult(result);
        setActiveProfileId(profileId);
        setTimeout(() => setImportResult(null), 8000);
      } catch (err) {
        console.error(err);
        setImportError('Error al importar los datos. Intenta nuevamente.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Habilitar sync para un perfil (rol owner) ───────────────────────────────
  const handleEnableSync = async (profile: Profile) => {
    if (!profile.id) return;
    setSyncing(true);
    try {
      await updateProfile(profile.id, { syncEnabled: true, syncRole: 'owner' });
      await uploadAllMedications(profile.uuid, profile.id);
      // Recargar el perfil actualizado para mostrar el modal con el estado correcto
      const updated = await db.profiles.get(profile.id);
      setSyncModalProfile(updated ?? { ...profile, syncEnabled: true, syncRole: 'owner' });
    } catch (err) {
      console.error('[Sync] enable failed:', err);
      alert('Error al activar la sincronización. Verifica tu conexión a internet.');
    } finally {
      setSyncing(false);
    }
  };

  // ── Unirse a un paciente compartido (rol member) ────────────────────────────
  const handleJoin = async () => {
    const code = joinCode.trim().toLowerCase();
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars)
    if (!code || code.length < 32) {
      setJoinError('Código inválido. Debe ser el UUID completo del paciente compartido.');
      return;
    }

    setJoinLoading(true);
    setJoinError('');

    try {
      const meds = await fetchRemoteMedications(code);

      if (meds.length === 0) {
        setJoinError('Código no encontrado o el paciente aún no tiene medicamentos registrados.');
        setJoinLoading(false);
        return;
      }

      // Ver si ya tenemos este perfil localmente (mismo UUID)
      const allProfiles = await db.profiles.toArray();
      const existing = allProfiles.find((p) => p.uuid === code);

      let profileId: number;
      if (existing?.id) {
        profileId = existing.id;
        await updateProfile(profileId, { syncEnabled: true, syncRole: 'member' });
      } else {
        // Crear perfil local enlazado al UUID remoto
        profileId = Number(await addProfile({
          uuid:        code,
          name:        'Paciente compartido',
          relationship: 'other',
          color:        '#6366f1',
          isDefault:   false,
          syncEnabled: true,
          syncRole:    'member',
        }));
      }

      // Insertar medicamentos descargados que no existan localmente
      for (const med of meds) {
        const localMed = await db.medications.where('uuid').equals(med.uuid).first();
        if (!localMed) {
          await db.medications.add({
            ...(med as Medication),
            id:            undefined,
            profileId,
            createdAt:     new Date(),
            updatedAt:     new Date(),
            remainingPills: (med as Medication).totalPills,
          });
        }
      }

      setActiveProfileId(profileId);
      setJoinOpen(false);
      setJoinCode('');
    } catch (err) {
      console.error('[Sync] join failed:', err);
      setJoinError('Error al conectar. Verifica el código e intenta nuevamente.');
    } finally {
      setJoinLoading(false);
    }
  };

  // ── Desactivar sync ─────────────────────────────────────────────────────────
  const handleDisableSync = async (profile: Profile) => {
    if (!profile.id) return;
    await updateProfile(profile.id, { syncEnabled: false, syncRole: undefined });
    setSyncModalProfile(null);
  };

  const handleCopyCode = async (uuid: string) => {
    await navigator.clipboard.writeText(uuid);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-gray-900">Perfiles</h1>
          <Button size="sm" onClick={() => { setEditProfile(null); setShowForm(true); }}>
            <Plus size={16} /> Agregar
          </Button>
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className="mx-4 mt-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <Check size={18} className="text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-800 font-bold">
              {importResult.profileCreated ? 'Perfil importado correctamente' : 'Perfil actualizado correctamente'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {importResult.medicationsAdded > 0 && (
              <div className="bg-emerald-100 rounded-lg px-2 py-1 text-emerald-700">
                ✓ {importResult.medicationsAdded} medicamento{importResult.medicationsAdded !== 1 ? 's' : ''} nuevo{importResult.medicationsAdded !== 1 ? 's' : ''}
              </div>
            )}
            {importResult.medicationsUpdated > 0 && (
              <div className="bg-blue-100 rounded-lg px-2 py-1 text-blue-700">
                ↻ {importResult.medicationsUpdated} actualizado{importResult.medicationsUpdated !== 1 ? 's' : ''} (cambió esquema)
              </div>
            )}
            {importResult.medicationsUnchanged > 0 && (
              <div className="bg-gray-100 rounded-lg px-2 py-1 text-gray-600">
                = {importResult.medicationsUnchanged} sin cambios
              </div>
            )}
            {importResult.logsAdded > 0 && (
              <div className="bg-emerald-100 rounded-lg px-2 py-1 text-emerald-700">
                + {importResult.logsAdded} registro{importResult.logsAdded !== 1 ? 's' : ''} de dosis
              </div>
            )}
            {importResult.logsDuplicated > 0 && (
              <div className="bg-gray-100 rounded-lg px-2 py-1 text-gray-500">
                ○ {importResult.logsDuplicated} registro{importResult.logsDuplicated !== 1 ? 's' : ''} ya existían
              </div>
            )}
          </div>
          <p className="text-xs text-emerald-600 mt-2">Tus propios datos no fueron modificados.</p>
        </div>
      )}

      {importError && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-2xl p-3">
          <p className="text-sm text-red-700">{importError}</p>
          <button onClick={() => setImportError('')} className="text-xs text-red-500 mt-1">Cerrar</button>
        </div>
      )}

      <div className="px-4 py-4 space-y-3">
        {/* Import button */}
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center gap-3 bg-white border-2 border-dashed border-gray-200 hover:border-primary-400 rounded-2xl p-4 transition-colors text-left"
        >
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
            <Upload size={20} className="text-primary-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-700 text-sm">Importar / Actualizar perfil</p>
            <p className="text-xs text-gray-400">Cargar .json de un familiar. Solo agrega lo nuevo, nunca borra tus datos.</p>
          </div>
        </button>
        <input ref={fileRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />

        {/* Join shared patient button — solo si Firebase está configurado */}
        {syncAvailable && (
          <button
            onClick={() => { setJoinCode(''); setJoinError(''); setJoinOpen(true); }}
            className="w-full flex items-center gap-3 bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-4 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <LogIn size={20} className="text-indigo-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-700 text-sm">Unirse a paciente compartido</p>
              <p className="text-xs text-gray-400">Ingresa el código de sincronización que te compartió un familiar.</p>
            </div>
          </button>
        )}

        {/* Profile list */}
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            isActive={activeProfile?.id === profile.id}
            syncAvailable={syncAvailable}
            syncing={syncing}
            onSelect={() => setActiveProfileId(profile.id!)}
            onEdit={() => { setEditProfile(profile); setShowForm(true); }}
            onDelete={() => setDeleteConfirm(profile)}
            onExport={() => handleExport(profile)}
            onShare={() => handleShareText(profile)}
            onSyncToggle={() =>
              profile.syncEnabled
                ? setSyncModalProfile(profile)
                : handleEnableSync(profile)
            }
          />
        ))}
      </div>

      {/* Add/Edit modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditProfile(null); }}
        title={editProfile ? 'Editar perfil' : 'Nuevo familiar'}
      >
        <ProfileForm
          initial={editProfile ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditProfile(null); }}
        />
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Eliminar perfil"
        size="sm"
      >
        <p className="text-gray-600 text-sm mb-4">
          ¿Eliminar el perfil de <strong>{deleteConfirm?.name}</strong>? Se eliminarán también todos sus medicamentos y registros.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
          <Button variant="danger" fullWidth onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>

      {/* Sync code modal — muestra el código al owner */}
      <Modal
        isOpen={!!syncModalProfile}
        onClose={() => setSyncModalProfile(null)}
        title="Sincronización en tiempo real"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-xl p-3">
            <Cloud size={16} className="flex-shrink-0" />
            <p className="text-xs font-semibold">
              Sincronización activa para <strong>{syncModalProfile?.name}</strong>
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">Código para compartir con tu familiar:</p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="font-mono text-xs text-gray-800 break-all leading-relaxed">
                {syncModalProfile?.uuid}
              </p>
            </div>
          </div>

          <Button
            fullWidth
            variant="secondary"
            onClick={() => handleCopyCode(syncModalProfile?.uuid ?? '')}
          >
            {codeCopied
              ? <><Check size={16} className="text-emerald-500" /> Copiado</>
              : <><Copy size={16} /> Copiar código</>
            }
          </Button>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-xs text-amber-800 leading-relaxed">
              Tu familiar debe ir a <strong>Perfiles → Unirse a paciente compartido</strong> y pegar este código.
              Los registros de dosis se actualizarán en tiempo real en ambos dispositivos.
            </p>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Las fotos y preferencias locales no se comparten.
          </p>

          <button
            onClick={() => handleDisableSync(syncModalProfile!)}
            className="w-full text-xs text-red-400 hover:text-red-600 py-1 transition-colors"
          >
            Desactivar sincronización para este perfil
          </button>
        </div>
      </Modal>

      {/* Join modal — para el familiar que se une */}
      <Modal
        isOpen={joinOpen}
        onClose={() => { setJoinOpen(false); setJoinCode(''); setJoinError(''); }}
        title="Unirse a paciente compartido"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Pegá el código UUID que te compartió el familiar que configuró la sincronización.
          </p>
          <textarea
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            rows={3}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
          {joinError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl p-2">{joinError}</p>
          )}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => { setJoinOpen(false); setJoinCode(''); setJoinError(''); }}
            >
              Cancelar
            </Button>
            <Button
              fullWidth
              onClick={handleJoin}
              disabled={joinLoading}
            >
              {joinLoading ? 'Conectando…' : 'Conectar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ProfileCard({
  profile, isActive, syncAvailable, syncing, onSelect, onEdit, onDelete, onExport, onShare, onSyncToggle
}: {
  profile: Profile;
  isActive: boolean;
  syncAvailable: boolean;
  syncing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  onShare: () => void;
  onSyncToggle: () => void;
}) {
  const medications = useMedications(profile.id);
  const activeMeds = medications.filter((m) => m.active);

  const RELATIONSHIP_LABEL: Record<string, string> = {
    self: 'Yo mismo/a', parent: 'Padre/Madre', child: 'Hijo/a',
    partner: 'Pareja', sibling: 'Hermano/a', other: 'Familiar',
  };

  return (
    <div
      className={`bg-white rounded-3xl border-2 shadow-sm overflow-hidden transition-all ${
        isActive ? 'border-primary-300 shadow-primary-100' : 'border-gray-100'
      }`}
    >
      <button onClick={onSelect} className="w-full p-4 flex items-center gap-3 text-left">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black flex-shrink-0"
          style={{ backgroundColor: profile.color }}
        >
          {profile.avatar
            ? <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover rounded-2xl" />
            : profile.name.charAt(0).toUpperCase()
          }
        </div>
        <div className="flex-1">
          <p className="font-bold text-gray-900">{profile.name}</p>
          <p className="text-sm text-gray-500">{RELATIONSHIP_LABEL[profile.relationship]}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeMeds.length} medicamento{activeMeds.length !== 1 ? 's' : ''} activo{activeMeds.length !== 1 ? 's' : ''}
          </p>
          {profile.syncEnabled ? (
            <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium mt-0.5">
              <Cloud size={11} /> Sincronizado en tiempo real
            </span>
          ) : (
            <p className="text-xs text-gray-300 mt-0.5 font-mono" title="Código de identificación">
              ID: {profile.uuid?.slice(0, 8)}…
            </p>
          )}
        </div>
        {isActive && (
          <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
            <Check size={14} className="text-white" />
          </div>
        )}
      </button>

      <div className="border-t border-gray-50 px-4 py-2 flex items-center gap-1">
        <span className="text-xs text-gray-400 flex-1 font-medium">
          {isActive ? '✓ Perfil activo' : 'Toca para activar'}
        </span>
        {syncAvailable && (
          <button
            onClick={onSyncToggle}
            disabled={syncing}
            className="p-2 transition-colors"
            title={profile.syncEnabled ? 'Sincronización activa — ver código' : 'Activar sincronización en tiempo real'}
          >
            {profile.syncEnabled
              ? <Cloud size={15} className="text-indigo-500" />
              : <CloudOff size={15} className="text-gray-300 hover:text-indigo-400" />
            }
          </button>
        )}
        <button onClick={onShare} className="p-2 text-gray-400 hover:text-primary-600 transition-colors" title="Compartir texto">
          <Share2 size={15} />
        </button>
        <button onClick={onExport} className="p-2 text-gray-400 hover:text-primary-600 transition-colors" title="Exportar .json para compartir">
          <Download size={15} />
        </button>
        <button onClick={onEdit} className="p-2 text-gray-400 hover:text-primary-600 transition-colors" title="Editar perfil">
          <Pencil size={15} />
        </button>
        {!profile.isDefault && (
          <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar perfil">
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
