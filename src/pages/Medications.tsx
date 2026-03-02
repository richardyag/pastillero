import { useState, useContext } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Package } from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { MedicationForm } from '../components/medications/MedicationForm';
import { useMedications, addMedication, updateMedication, deleteMedication } from '../hooks/useMedications';
import { ProfileContext } from '../context/ProfileContext';
import { getEffectiveTimes } from '../utils/schedule';
import type { Medication } from '../types';

const TYPE_EMOJI: Record<string, string> = {
  pill: '💊', syrup: '🍶', injection: '💉',
  drops: '💧', patch: '🩹', inhaler: '🫁', other: '🔵',
};

const TYPE_LABEL: Record<string, string> = {
  pill: 'Pastilla', syrup: 'Jarabe', injection: 'Inyección',
  drops: 'Gotas', patch: 'Parche', inhaler: 'Inhalador', other: 'Otro',
};

export function Medications() {
  const { activeProfile } = useContext(ProfileContext);
  const medications = useMedications(activeProfile?.id);
  const [showForm, setShowForm] = useState(false);
  const [editMed, setEditMed] = useState<Medication | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Medication | null>(null);

  const handleSave = async (data: Omit<Medication, 'id' | 'createdAt' | 'uuid' | 'updatedAt'>) => {
    if (editMed?.id) {
      await updateMedication(editMed.id, data);
    } else {
      await addMedication(data);
    }
    setShowForm(false);
    setEditMed(null);
  };

  const handleDelete = async () => {
    if (deleteConfirm?.id) {
      await deleteMedication(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleToggleActive = async (med: Medication) => {
    if (med.id) await updateMedication(med.id, { active: !med.active });
  };

  const active = medications.filter((m) => m.active);
  const inactive = medications.filter((m) => !m.active);

  if (!activeProfile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Selecciona un perfil primero</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Medicamentos</h1>
            <p className="text-sm text-gray-500">{activeProfile.name} · {active.length} activos</p>
          </div>
          <Button
            onClick={() => { setEditMed(null); setShowForm(true); }}
            size="sm"
          >
            <Plus size={16} /> Agregar
          </Button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {medications.length === 0 && (
          <div className="text-center py-16">
            <span className="text-5xl">💊</span>
            <p className="text-gray-500 font-semibold mt-3">Sin medicamentos registrados</p>
            <p className="text-gray-400 text-sm mt-1">Toca "Agregar" para empezar</p>
          </div>
        )}

        {active.map((med) => (
          <MedItem
            key={med.id}
            med={med}
            onEdit={() => { setEditMed(med); setShowForm(true); }}
            onDelete={() => setDeleteConfirm(med)}
            onToggle={() => handleToggleActive(med)}
          />
        ))}

        {inactive.length > 0 && (
          <>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4">Inactivos</p>
            {inactive.map((med) => (
              <MedItem
                key={med.id}
                med={med}
                onEdit={() => { setEditMed(med); setShowForm(true); }}
                onDelete={() => setDeleteConfirm(med)}
                onToggle={() => handleToggleActive(med)}
              />
            ))}
          </>
        )}
      </div>

      {/* Add/Edit modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditMed(null); }}
        title={editMed ? 'Editar medicamento' : 'Nuevo medicamento'}
        size="lg"
      >
        <MedicationForm
          profileId={activeProfile.id!}
          initial={editMed ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditMed(null); }}
        />
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Eliminar medicamento"
        size="sm"
      >
        <p className="text-gray-600 text-sm mb-4">
          ¿Eliminar <strong>{deleteConfirm?.name}</strong>? Se borrarán también todos los registros de dosis. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
          <Button variant="danger" fullWidth onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}

function MedItem({
  med, onEdit, onDelete, onToggle
}: {
  med: Medication;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const freqLabel: Record<string, string> = {
    daily: 'Diario', every_x_hours: `Cada ${med.intervalHours}h`,
    specific_days: 'Días específicos', as_needed: 'Según necesidad',
  };

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm ${!med.active ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ backgroundColor: med.color + '20', border: `2px solid ${med.color}40` }}
        >
          {med.photo
            ? <img src={med.photo} alt={med.name} className="w-full h-full object-cover rounded-2xl" />
            : TYPE_EMOJI[med.type] ?? '💊'
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-gray-900">{med.name}</p>
              <p className="text-sm text-gray-500">{med.dosage} · {TYPE_LABEL[med.type]}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={onEdit} className="p-2 text-gray-400 hover:text-primary-600 transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 size={15} />
              </button>
              <button onClick={onToggle} className="p-2 transition-colors">
                {med.active
                  ? <ToggleRight size={22} className="text-primary-600" />
                  : <ToggleLeft size={22} className="text-gray-300" />
                }
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
              {freqLabel[med.frequency] ?? med.frequency}
            </span>
            <span className="text-xs text-gray-500">
              {getEffectiveTimes(med).join(' · ')}
            </span>
          </div>

          {med.remainingPills !== undefined && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <div className="flex items-center gap-1">
                  <Package size={11} />
                  <span>Stock: {med.remainingPills} restantes</span>
                </div>
                {med.remainingPills <= 5 && (
                  <span className="text-orange-600 font-semibold">¡Stock bajo!</span>
                )}
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (med.remainingPills / (med.totalPills ?? med.remainingPills)) * 100)}%`,
                    backgroundColor: med.remainingPills <= 5 ? '#f97316' : med.color,
                  }}
                />
              </div>
            </div>
          )}

          {med.instructions && (
            <p className="text-xs text-gray-400 mt-1.5 italic">{med.instructions}</p>
          )}
        </div>
      </div>
    </div>
  );
}
