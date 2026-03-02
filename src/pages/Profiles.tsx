import { useState, useRef, useContext } from 'react';
import { Plus, Pencil, Trash2, Download, Upload, Share2, Check } from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { ProfileForm } from '../components/profiles/ProfileForm';
import { useProfiles, addProfile, updateProfile, deleteProfile } from '../hooks/useProfiles';
import { useMedications } from '../hooks/useMedications';
import { db } from '../db/database';
import { exportProfileData, downloadExport, parseImportData, generateShareableText } from '../utils/export';
import { ProfileContext } from '../context/ProfileContext';
import type { Profile } from '../types';

export function Profiles() {
  const profiles = useProfiles();
  const { activeProfile, setActiveProfileId } = useContext(ProfileContext);
  const [showForm, setShowForm] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async (data: Omit<Profile, 'id' | 'createdAt' | 'isDefault'>) => {
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
      const content = ev.target?.result as string;
      const data = parseImportData(content);
      if (!data) {
        setImportError('Archivo inválido. Asegúrate de usar un archivo .json exportado desde Pastillero.');
        return;
      }
      try {
        // Check if profile with same name exists
        const existing = profiles.find((p) => p.name === data.profile.name);
        let profileId: number;

        if (existing?.id) {
          profileId = existing.id;
          await updateProfile(profileId, { ...data.profile });
        } else {
          profileId = Number(await addProfile({ ...data.profile, isDefault: false }));
        }

        // Import medications (avoid duplicates by name)
        for (const med of data.medications) {
          const exists = await db.medications
            .where('profileId').equals(profileId)
            .and((m) => m.name === med.name)
            .first();
          if (!exists) {
            await db.medications.add({ ...med, id: undefined, profileId, createdAt: new Date() });
          }
        }

        // Import logs
        for (const log of data.recentLogs) {
          await db.doseLogs.add({ ...log, id: undefined, profileId });
        }

        setImportSuccess(true);
        setActiveProfileId(profileId);
        setTimeout(() => setImportSuccess(false), 3000);
      } catch {
        setImportError('Error al importar los datos. Intenta nuevamente.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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

      {/* Import success banner */}
      {importSuccess && (
        <div className="mx-4 mt-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2 animate-fade-in">
          <Check size={18} className="text-emerald-600" />
          <p className="text-sm text-emerald-700 font-semibold">¡Perfil importado correctamente!</p>
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
            <p className="font-semibold text-gray-700 text-sm">Importar perfil</p>
            <p className="text-xs text-gray-400">Cargar archivo .json compartido por un familiar</p>
          </div>
        </button>
        <input ref={fileRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />

        {/* Profile list */}
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            isActive={activeProfile?.id === profile.id}
            onSelect={() => setActiveProfileId(profile.id!)}
            onEdit={() => { setEditProfile(profile); setShowForm(true); }}
            onDelete={() => setDeleteConfirm(profile)}
            onExport={() => handleExport(profile)}
            onShare={() => handleShareText(profile)}
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
    </div>
  );
}

function ProfileCard({
  profile, isActive, onSelect, onEdit, onDelete, onExport, onShare
}: {
  profile: Profile;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  onShare: () => void;
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
          <p className="text-xs text-gray-400 mt-0.5">{activeMeds.length} medicamento{activeMeds.length !== 1 ? 's' : ''} activo{activeMeds.length !== 1 ? 's' : ''}</p>
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
        <button onClick={onShare} className="p-2 text-gray-400 hover:text-primary-600 transition-colors" title="Compartir texto">
          <Share2 size={15} />
        </button>
        <button onClick={onExport} className="p-2 text-gray-400 hover:text-primary-600 transition-colors" title="Exportar .json">
          <Download size={15} />
        </button>
        <button onClick={onEdit} className="p-2 text-gray-400 hover:text-primary-600 transition-colors">
          <Pencil size={15} />
        </button>
        {!profile.isDefault && (
          <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
