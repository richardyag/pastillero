import { Check, X, Clock, Package } from 'lucide-react';
import { formatTime } from '../../utils/schedule';
import type { ScheduledDose } from '../../types';

interface DoseCardProps {
  dose: ScheduledDose;
  onTake: () => void;
  onSkip: () => void;
}

const TYPE_EMOJI: Record<string, string> = {
  pill: '💊',
  syrup: '🍶',
  injection: '💉',
  drops: '💧',
  patch: '🩹',
  inhaler: '🫁',
  other: '🔵',
};

const STATUS_CONFIG = {
  upcoming: { bg: 'bg-white', border: 'border-gray-100', badge: 'bg-gray-100 text-gray-500', label: '' },
  due: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', label: 'Ahora' },
  overdue: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', label: 'Vencida' },
  taken: { bg: 'bg-emerald-50', border: 'border-emerald-100', badge: 'bg-emerald-100 text-emerald-700', label: 'Tomada' },
  skipped: { bg: 'bg-gray-50', border: 'border-gray-100', badge: 'bg-gray-100 text-gray-500', label: 'Omitida' },
  missed: { bg: 'bg-red-50', border: 'border-red-100', badge: 'bg-red-100 text-red-500', label: 'Perdida' },
};

export function DoseCard({ dose, onTake, onSkip }: DoseCardProps) {
  const { medication, scheduledTime, status, log } = dose;
  const config = STATUS_CONFIG[status];
  const isDone = status === 'taken' || status === 'skipped' || status === 'missed';
  const isActionable = status === 'due' || status === 'overdue' || status === 'upcoming';

  return (
    <div className={`rounded-2xl border-2 ${config.bg} ${config.border} p-4 transition-all animate-fade-in`}>
      <div className="flex items-start gap-3">
        {/* Color dot + emoji */}
        <div className="relative flex-shrink-0">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
            style={{ backgroundColor: medication.color + '20', border: `2px solid ${medication.color}40` }}
          >
            {medication.photo ? (
              <img src={medication.photo} alt={medication.name} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              TYPE_EMOJI[medication.type] ?? '💊'
            )}
          </div>
          <div
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white"
            style={{ backgroundColor: medication.color }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-gray-900 truncate">{medication.name}</p>
              <p className="text-sm text-gray-500">{medication.dosage}</p>
            </div>
            {config.label && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${config.badge}`}>
                {config.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5">
            <Clock size={13} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-600">{formatTime(scheduledTime)}</span>
            {medication.instructions && (
              <span className="text-xs text-gray-400 truncate">· {medication.instructions}</span>
            )}
          </div>

          {/* Pill count warning */}
          {medication.remainingPills !== undefined && medication.remainingPills <= 5 && (
            <div className="flex items-center gap-1 mt-1">
              <Package size={12} className="text-orange-500" />
              <span className="text-xs text-orange-600 font-medium">
                Solo quedan {medication.remainingPills} unidades
              </span>
            </div>
          )}

          {log?.takenAt && (
            <p className="text-xs text-emerald-600 mt-1 font-medium">
              Tomada a las {new Date(log.takenAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {isActionable && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={onSkip}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 active:scale-95 transition-all"
          >
            <X size={16} /> Omitir
          </button>
          <button
            onClick={onTake}
            className="flex-[2] flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-sm font-bold active:scale-95 transition-all shadow-sm"
            style={{ backgroundColor: medication.color }}
          >
            <Check size={16} /> Tomar ahora
          </button>
        </div>
      )}

      {isDone && (
        <div className="flex items-center justify-center gap-2 mt-3 py-1.5 rounded-xl bg-white/60">
          {status === 'taken' && <Check size={14} className="text-emerald-500" />}
          {(status === 'skipped' || status === 'missed') && <X size={14} className="text-gray-400" />}
          <span className="text-xs text-gray-500">
            {status === 'taken' ? 'Registrada como tomada' : status === 'skipped' ? 'Omitida' : 'Dosis perdida'}
          </span>
        </div>
      )}
    </div>
  );
}
