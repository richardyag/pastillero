import { useState, useRef } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '../common/Button';
import type { Profile } from '../../types';

const RELATIONSHIP_OPTIONS: { value: Profile['relationship']; label: string; emoji: string }[] = [
  { value: 'self', label: 'Yo mismo/a', emoji: '👤' },
  { value: 'parent', label: 'Padre/Madre', emoji: '👴' },
  { value: 'child', label: 'Hijo/a', emoji: '👶' },
  { value: 'partner', label: 'Pareja', emoji: '💑' },
  { value: 'sibling', label: 'Hermano/a', emoji: '👫' },
  { value: 'other', label: 'Otro familiar', emoji: '👥' },
];

const PROFILE_COLORS = [
  '#4f46e5', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#ec4899', '#8b5cf6',
];

interface ProfileFormProps {
  initial?: Partial<Profile>;
  onSave: (data: Omit<Profile, 'id' | 'createdAt' | 'isDefault' | 'uuid'>) => void;
  onCancel: () => void;
}

export function ProfileForm({ initial, onSave, onCancel }: ProfileFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [relationship, setRelationship] = useState<Profile['relationship']>(initial?.relationship ?? 'parent');
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [color, setColor] = useState(initial?.color ?? PROFILE_COLORS[1]);
  const [avatar, setAvatar] = useState<string | undefined>(initial?.avatar);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      relationship,
      birthDate: birthDate || undefined,
      color,
      avatar,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Avatar */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative"
        >
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg"
            style={{ backgroundColor: color }}
          >
            {avatar ? (
              <img src={avatar} alt="Avatar" className="w-full h-full object-cover rounded-full" />
            ) : (
              name.trim().charAt(0).toUpperCase() || '?'
            )}
          </div>
          <div className="absolute bottom-0 right-0 bg-white rounded-full p-1.5 shadow-md border border-gray-200">
            <Camera size={14} className="text-gray-600" />
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleAvatar} className="hidden" />
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Mamá, Carlos, Abuela..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      {/* Relationship */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Relación</label>
        <div className="grid grid-cols-3 gap-2">
          {RELATIONSHIP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRelationship(opt.value)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 text-xs font-medium transition-all ${
                relationship === opt.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-500'
              }`}
            >
              <span className="text-xl">{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Color del perfil</label>
        <div className="flex gap-2">
          {PROFILE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-9 h-9 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''}`}
            />
          ))}
        </div>
      </div>

      {/* Birth date */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha de nacimiento (opcional)</label>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" fullWidth onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" fullWidth>
          {initial ? 'Guardar cambios' : 'Agregar perfil'}
        </Button>
      </div>
    </form>
  );
}
