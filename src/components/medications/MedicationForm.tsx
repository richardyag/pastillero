import { useState, useRef } from 'react';
import { Camera, X, Plus, Minus, Clock } from 'lucide-react';
import { Button } from '../common/Button';
import type { Medication, MedicationType, FrequencyType, DayOfWeek } from '../../types';

const MEDICATION_TYPES: { value: MedicationType; label: string; emoji: string }[] = [
  { value: 'pill', label: 'Pastilla', emoji: '💊' },
  { value: 'syrup', label: 'Jarabe', emoji: '🍶' },
  { value: 'injection', label: 'Inyección', emoji: '💉' },
  { value: 'drops', label: 'Gotas', emoji: '💧' },
  { value: 'patch', label: 'Parche', emoji: '🩹' },
  { value: 'inhaler', label: 'Inhalador', emoji: '🫁' },
  { value: 'other', label: 'Otro', emoji: '🔵' },
];

const COLORS = ['#4f46e5', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#ec4899', '#8b5cf6'];
const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Genera los horarios automáticos para "cada X horas".
 * Ejemplo: firstTime="08:00", intervalHours=8 → ["08:00", "16:00", "00:00"]
 * Ejemplo: firstTime="06:00", intervalHours=6 → ["06:00", "12:00", "18:00", "00:00"]
 * Ejemplo: firstTime="08:00", intervalHours=12 → ["08:00", "20:00"]
 */
function generateTimesForInterval(firstTime: string, intervalHours: number): string[] {
  const [h, m] = firstTime.split(':').map(Number);
  const startMinutes = h * 60 + m;
  const intervalMinutes = Math.max(1, intervalHours) * 60;
  const result: string[] = [];

  let cursor = startMinutes;
  while (true) {
    const totalMins = cursor % (24 * 60);
    const hh = Math.floor(totalMins / 60);
    const mm = totalMins % 60;
    result.push(`${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`);

    cursor += intervalMinutes;
    // Parar cuando ya cubrimos 24 horas desde la primera dosis
    if (cursor - startMinutes >= 24 * 60) break;
  }

  return result;
}

interface MedicationFormProps {
  profileId: number;
  initial?: Partial<Medication>;
  onSave: (data: Omit<Medication, 'id' | 'createdAt' | 'uuid' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export function MedicationForm({ profileId, initial, onSave, onCancel }: MedicationFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<MedicationType>(initial?.type ?? 'pill');
  const [dosage, setDosage] = useState(initial?.dosage ?? '');
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [photo, setPhoto] = useState<string | undefined>(initial?.photo);
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [frequency, setFrequency] = useState<FrequencyType>(initial?.frequency ?? 'daily');
  const [intervalHours, setIntervalHours] = useState(initial?.intervalHours ?? 8);
  const [specificDays, setSpecificDays] = useState<DayOfWeek[]>(initial?.specificDays ?? [1, 2, 3, 4, 5]);

  // Primera dosis (solo para "cada X horas")
  const [firstDoseTime, setFirstDoseTime] = useState(() => {
    if (initial?.frequency === 'every_x_hours' && initial.scheduleTimes?.length) {
      return initial.scheduleTimes[0].time;
    }
    return '08:00';
  });

  // Horarios manuales (para daily y specific_days)
  const [manualTimes, setManualTimes] = useState<string[]>(
    initial?.frequency !== 'every_x_hours'
      ? (initial?.scheduleTimes?.map((t) => t.time) ?? ['08:00'])
      : ['08:00']
  );

  const [startDate, setStartDate] = useState(initial?.startDate ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [totalPills, setTotalPills] = useState(initial?.totalPills?.toString() ?? '');
  const [notifications, setNotifications] = useState(initial?.notificationsEnabled ?? true);
  const [snooze, setSnooze] = useState(initial?.snoozeMinutes ?? 15);

  const fileRef = useRef<HTMLInputElement>(null);

  // Horarios automáticos para "cada X horas" (derivados, no estado propio)
  const autoTimes = frequency === 'every_x_hours'
    ? generateTimesForInterval(firstDoseTime, intervalHours)
    : [];

  // Horarios efectivos según el tipo de frecuencia
  const effectiveTimes = frequency === 'every_x_hours' ? autoTimes : manualTimes;

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addManualTime = () => setManualTimes([...manualTimes, '12:00']);
  const removeManualTime = (i: number) => setManualTimes(manualTimes.filter((_, idx) => idx !== i));
  const updateManualTime = (i: number, val: string) =>
    setManualTimes(manualTimes.map((t, idx) => (idx === i ? val : t)));

  const toggleDay = (day: DayOfWeek) => {
    setSpecificDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dosage.trim() || effectiveTimes.length === 0) return;

    onSave({
      profileId,
      name: name.trim(),
      type,
      dosage: dosage.trim(),
      instructions: instructions.trim() || undefined,
      photo,
      color,
      frequency,
      intervalHours: frequency === 'every_x_hours' ? intervalHours : undefined,
      specificDays: frequency === 'specific_days' ? specificDays : undefined,
      scheduleTimes: effectiveTimes.map((t) => ({ time: t })),
      startDate,
      endDate: endDate || undefined,
      totalPills: totalPills ? parseInt(totalPills) : undefined,
      remainingPills: totalPills ? parseInt(totalPills) : undefined,
      notificationsEnabled: notifications,
      snoozeMinutes: snooze,
      active: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Foto */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-dashed border-gray-300 hover:border-primary-400 transition-colors flex items-center justify-center bg-gray-50"
        >
          {photo ? (
            <img src={photo} alt="Medicamento" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <Camera size={24} />
              <span className="text-xs">Foto</span>
            </div>
          )}
          {photo && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPhoto(undefined); }}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5"
            >
              <X size={12} />
            </button>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
      </div>

      {/* Nombre */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre del medicamento *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Ibuprofeno, Amoxicilina..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      {/* Tipo */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
        <div className="grid grid-cols-4 gap-2">
          {MEDICATION_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 text-xs font-medium transition-all ${
                type === t.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'
              }`}
            >
              <span className="text-lg">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dosis */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Dosis *</label>
        <input
          required
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
          placeholder="Ej: 10mg, 5ml, 1 comprimido..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      {/* Instrucciones */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Instrucciones (opcional)</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Ej: Tomar con comida, antes de dormir..."
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
        />
      </div>

      {/* Color */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Color identificador</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''}`}
            />
          ))}
        </div>
      </div>

      {/* Frecuencia */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Frecuencia</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['daily', 'Todos los días'],
            ['every_x_hours', 'Cada X horas'],
            ['specific_days', 'Días específicos'],
            ['as_needed', 'Según necesidad'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFrequency(val)}
              className={`py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                frequency === val ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Cada X horas: intervalo + primera dosis + preview automático ── */}
        {frequency === 'every_x_hours' && (
          <div className="mt-3 space-y-3">
            {/* Intervalo */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 font-medium">Intervalo:</span>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <button
                  type="button"
                  onClick={() => setIntervalHours((h) => Math.max(1, h - 1))}
                  className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-primary-600 font-bold text-lg"
                >−</button>
                <span className="text-base font-bold text-gray-800 w-8 text-center">{intervalHours}</span>
                <button
                  type="button"
                  onClick={() => setIntervalHours((h) => Math.min(23, h + 1))}
                  className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-primary-600 font-bold text-lg"
                >+</button>
              </div>
              <span className="text-sm text-gray-600">hora{intervalHours !== 1 ? 's' : ''}</span>
            </div>

            {/* Primera dosis */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 font-medium">Primera dosis:</span>
              <input
                type="time"
                value={firstDoseTime}
                onChange={(e) => setFirstDoseTime(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            {/* Preview de horarios generados */}
            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock size={14} className="text-primary-600" />
                <span className="text-xs font-bold text-primary-700 uppercase tracking-wide">
                  Horarios generados automáticamente
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {autoTimes.map((t) => (
                  <span
                    key={t}
                    className="bg-white border border-primary-200 text-primary-700 text-sm font-bold px-3 py-1 rounded-xl"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-xs text-primary-500 mt-2">
                {autoTimes.length} toma{autoTimes.length !== 1 ? 's' : ''} por día · cada {intervalHours}h desde las {firstDoseTime}
              </p>
            </div>
          </div>
        )}

        {/* ── Días específicos ── */}
        {frequency === 'specific_days' && (
          <div className="mt-3 flex gap-1.5">
            {DAY_LABELS.map((label, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => toggleDay(idx as DayOfWeek)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  specificDays.includes(idx as DayOfWeek)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Horarios manuales: solo para daily y specific_days */}
      {(frequency === 'daily' || frequency === 'specific_days') && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Horarios</label>
          <div className="space-y-2">
            {manualTimes.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="time"
                  value={t}
                  onChange={(e) => updateManualTime(i, e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                {manualTimes.length > 1 && (
                  <button type="button" onClick={() => removeManualTime(i)} className="p-2 text-red-400 hover:text-red-600">
                    <Minus size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addManualTime}
            className="mt-2 flex items-center gap-1 text-sm text-primary-600 font-medium"
          >
            <Plus size={16} /> Agregar horario
          </button>
        </div>
      )}

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Desde</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Hasta (opcional)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
      </div>

      {/* Cantidad */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Cantidad total (opcional)</label>
        <input
          type="number"
          min={0}
          value={totalPills}
          onChange={(e) => setTotalPills(e.target.value)}
          placeholder="Para llevar cuenta del stock"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      {/* Notificaciones */}
      <div className="flex items-center justify-between py-2 border-t border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-700">Notificaciones</p>
          <p className="text-xs text-gray-400">Recordatorio al llegar la hora</p>
        </div>
        <button
          type="button"
          onClick={() => setNotifications(!notifications)}
          className={`relative w-12 h-6 rounded-full transition-colors ${notifications ? 'bg-primary-600' : 'bg-gray-300'}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifications ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {notifications && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Recordatorio adicional (snooze)</label>
          <div className="flex gap-2">
            {[0, 5, 10, 15, 30].map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => setSnooze(min)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  snooze === min ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {min === 0 ? 'No' : `${min}m`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" fullWidth onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" fullWidth>
          {initial ? 'Guardar cambios' : 'Agregar medicamento'}
        </Button>
      </div>
    </form>
  );
}
