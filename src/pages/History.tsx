import { useContext, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Check, X, Minus } from 'lucide-react';
import { ProfileContext } from '../context/ProfileContext';
import { useDoseLogs } from '../hooks/useMedications';
import { useMedications } from '../hooks/useMedications';
import { calculateAdherence } from '../utils/schedule';

export function History() {
  const { activeProfile } = useContext(ProfileContext);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const allLogs = useDoseLogs(activeProfile?.id);
  const medications = useMedications(activeProfile?.id);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const adherence = calculateAdherence(allLogs);
  const takenCount = allLogs.filter((l) => l.status === 'taken').length;
  const skippedCount = allLogs.filter((l) => l.status === 'skipped').length;
  const missedCount = allLogs.filter((l) => l.status === 'missed').length;

  const getDayStatus = (dateStr: string) => {
    const dayLogs = allLogs.filter((l) => l.scheduledDate === dateStr);
    if (dayLogs.length === 0) return 'empty';
    const allTaken = dayLogs.every((l) => l.status === 'taken');
    const anyTaken = dayLogs.some((l) => l.status === 'taken');
    const anyMissed = dayLogs.some((l) => l.status === 'missed');
    if (allTaken) return 'full';
    if (anyMissed) return 'missed';
    if (anyTaken) return 'partial';
    return 'skipped';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-black text-gray-900">Historial</h1>
        <p className="text-sm text-gray-500">{activeProfile?.name}</p>
      </div>

      {/* Stats */}
      <div className="px-4 pt-4 grid grid-cols-4 gap-2">
        {[
          { label: 'Adherencia', value: `${adherence}%`, color: 'text-primary-600', bg: 'bg-primary-50' },
          { label: 'Tomadas', value: takenCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Omitidas', value: skippedCount, color: 'text-gray-500', bg: 'bg-gray-50' },
          { label: 'Perdidas', value: missedCount, color: 'text-red-500', bg: 'bg-red-50' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl p-3 text-center`}>
            <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-xl"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-bold text-gray-900 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h2>
            <button
              onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-xl"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((d) => (
              <div key={d} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for first day alignment */}
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map((day) => {
              const ds = format(day, 'yyyy-MM-dd');
              const status = getDayStatus(ds);
              const today = isToday(day);
              const inMonth = isSameMonth(day, currentMonth);

              const dotColor = {
                full: 'bg-emerald-400',
                partial: 'bg-amber-400',
                missed: 'bg-red-400',
                skipped: 'bg-gray-300',
                empty: '',
              }[status];

              return (
                <div
                  key={ds}
                  className={`flex flex-col items-center py-1 rounded-xl ${today ? 'bg-primary-50 ring-2 ring-primary-300' : ''} ${!inMonth ? 'opacity-30' : ''}`}
                >
                  <span className={`text-sm font-semibold ${today ? 'text-primary-700' : 'text-gray-700'}`}>
                    {format(day, 'd')}
                  </span>
                  {dotColor ? (
                    <div className={`w-2 h-2 rounded-full mt-0.5 ${dotColor}`} />
                  ) : (
                    <div className="w-2 h-2 mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 justify-center">
            {[
              { color: 'bg-emerald-400', label: 'Completo' },
              { color: 'bg-amber-400', label: 'Parcial' },
              { color: 'bg-red-400', label: 'Perdidas' },
              { color: 'bg-gray-300', label: 'Omitidas' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${l.color}`} />
                <span className="text-xs text-gray-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent logs */}
      <div className="px-4 pb-4">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Registros recientes</h3>
        <div className="space-y-2">
          {allLogs.slice().reverse().slice(0, 30).map((log) => {
            const med = medications.find((m) => m.id === log.medicationId);
            if (!med) return null;
            return (
              <div key={log.id} className="bg-white rounded-2xl p-3 border border-gray-100 flex items-center gap-3 shadow-sm">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    log.status === 'taken' ? 'bg-emerald-50' : 'bg-gray-50'
                  }`}
                >
                  {log.status === 'taken'
                    ? <Check size={16} className="text-emerald-500" />
                    : <X size={16} className="text-gray-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{med.name}</p>
                  <p className="text-xs text-gray-400">
                    {log.scheduledDate} · {log.scheduledTime}
                    {log.takenAt && ` · Tomada ${new Date(log.takenAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  log.status === 'taken' ? 'bg-emerald-100 text-emerald-700'
                  : log.status === 'skipped' ? 'bg-gray-100 text-gray-600'
                  : 'bg-red-100 text-red-600'
                }`}>
                  {log.status === 'taken' ? 'Tomada' : log.status === 'skipped' ? 'Omitida' : 'Perdida'}
                </span>
              </div>
            );
          })}
          {allLogs.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Minus size={32} className="mx-auto mb-2" />
              <p className="text-sm">Sin registros todavía</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
