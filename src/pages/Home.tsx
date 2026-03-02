import { useState, useEffect, useContext } from 'react';
import { Bell, BellOff, Pill, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { DoseCard } from '../components/medications/DoseCard';
import { useMedications, useDoseLogs, logDose } from '../hooks/useMedications';
import { buildScheduledDoses, getTimeBucket, timeBucketLabel, calculateAdherence, getStreakDays, getTodayString } from '../utils/schedule';
import { requestNotificationPermission, startNotificationChecker, playAlertSound } from '../utils/notifications';
import { ProfileContext } from '../context/ProfileContext';
import type { ScheduledDose } from '../types';

export function Home() {
  const { activeProfile } = useContext(ProfileContext);
  const [dateStr, setDateStr] = useState(getTodayString());
  const [notifGranted, setNotifGranted] = useState(Notification.permission === 'granted');
  const [alertDose, setAlertDose] = useState<ScheduledDose | null>(null);

  const medications = useMedications(activeProfile?.id);
  const todayLogs = useDoseLogs(activeProfile?.id, dateStr);
  const allLogs = useDoseLogs(activeProfile?.id);

  const doses = buildScheduledDoses(medications, todayLogs, dateStr);
  const adherence = calculateAdherence(allLogs.slice(-30));
  const streak = getStreakDays(allLogs, getTodayString());

  const doneDoses = doses.filter((d) => d.status === 'taken').length;
  const totalDoses = doses.length;

  // Group by time bucket
  const buckets: Record<string, ScheduledDose[]> = {};
  for (const dose of doses) {
    const bucket = getTimeBucket(dose.scheduledTime);
    if (!buckets[bucket]) buckets[bucket] = [];
    buckets[bucket].push(dose);
  }
  const bucketOrder = ['morning', 'afternoon', 'evening', 'night'];

  useEffect(() => {
    startNotificationChecker(
      () => buildScheduledDoses(medications, todayLogs, getTodayString()),
      (dose) => {
        setAlertDose(dose);
        playAlertSound();
      }
    );
  }, [medications, todayLogs]);

  const handleTake = async (dose: ScheduledDose) => {
    if (!activeProfile?.id || !dose.medication.id) return;
    await logDose(dose.medication.id, activeProfile.id, dose.scheduledTime, dose.scheduledDate, 'taken');
    if (alertDose?.medication.id === dose.medication.id) setAlertDose(null);
  };

  const handleSkip = async (dose: ScheduledDose) => {
    if (!activeProfile?.id || !dose.medication.id) return;
    await logDose(dose.medication.id, activeProfile.id, dose.scheduledTime, dose.scheduledDate, 'skipped');
    if (alertDose?.medication.id === dose.medication.id) setAlertDose(null);
  };

  const handleNotifRequest = async () => {
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
  };

  const isCurrentDay = dateStr === getTodayString();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Alert banner */}
      {alertDose && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-amber-400 text-amber-900 px-4 py-3 flex items-center gap-3 animate-slide-up shadow-lg">
          <Bell size={20} className="flex-shrink-0 animate-bounce" />
          <div className="flex-1">
            <p className="font-bold text-sm">¡Hora de tomar {alertDose.medication.name}!</p>
            <p className="text-xs opacity-80">{alertDose.medication.dosage}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleSkip(alertDose)} className="text-xs bg-amber-300 px-2 py-1 rounded-lg font-semibold">Omitir</button>
            <button onClick={() => handleTake(alertDose)} className="text-xs bg-amber-800 text-white px-2 py-1 rounded-lg font-semibold">Tomar</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-primary-200 text-sm font-medium">
              {activeProfile?.name ?? 'Sin perfil'}
            </p>
            <h1 className="text-2xl font-black">
              {isCurrentDay ? 'Hoy' : format(parseISO(dateStr), "d 'de' MMMM", { locale: es })}
            </h1>
          </div>
          {!notifGranted && (
            <button
              onClick={handleNotifRequest}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
            >
              <BellOff size={14} /> Activar alertas
            </button>
          )}
        </div>

        {/* Date navigator */}
        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => setDateStr(format(subDays(parseISO(dateStr), 1), 'yyyy-MM-dd'))} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <ChevronLeft size={18} />
          </button>
          {[-2, -1, 0, 1, 2].map((offset) => {
            const d = addDays(parseISO(dateStr), offset);
            const ds = format(d, 'yyyy-MM-dd');
            const isSelected = ds === dateStr;
            const isTodayDate = isToday(d);
            return (
              <button
                key={offset}
                onClick={() => setDateStr(ds)}
                className={`flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all ${
                  isSelected ? 'bg-white text-primary-700' : 'hover:bg-white/10 text-primary-100'
                }`}
              >
                <span className="text-xs font-medium">{format(d, 'EEE', { locale: es })}</span>
                <span className={`text-base font-bold ${isTodayDate && !isSelected ? 'text-yellow-300' : ''}`}>
                  {format(d, 'd')}
                </span>
              </button>
            );
          })}
          <button onClick={() => setDateStr(format(addDays(parseISO(dateStr), 1), 'yyyy-MM-dd'))} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-white/10 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black">{doneDoses}/{totalDoses}</p>
            <p className="text-xs text-primary-200 mt-0.5">Dosis hoy</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black">{adherence}%</p>
            <p className="text-xs text-primary-200 mt-0.5">Adherencia</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 text-center flex flex-col items-center">
            <div className="flex items-center gap-1">
              <Flame size={16} className="text-orange-300" />
              <p className="text-2xl font-black">{streak}</p>
            </div>
            <p className="text-xs text-primary-200 mt-0.5">Racha días</p>
          </div>
        </div>
      </div>

      {/* Dose list */}
      <div className="px-4 py-4 space-y-5">
        {totalDoses === 0 ? (
          <div className="text-center py-16">
            <Pill size={48} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">Sin medicamentos para este día</p>
            <p className="text-gray-400 text-sm mt-1">Agrega medicamentos en la pestaña <span className="font-medium">Medicamentos</span></p>
          </div>
        ) : (
          bucketOrder
            .filter((b) => buckets[b]?.length > 0)
            .map((bucket) => (
              <div key={bucket}>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span>{timeBucketLabel(bucket)}</span>
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                    {buckets[bucket].filter((d) => d.status === 'taken').length}/{buckets[bucket].length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {buckets[bucket].map((dose, i) => (
                    <DoseCard
                      key={`${dose.medication.id}-${dose.scheduledTime}-${i}`}
                      dose={dose}
                      onTake={() => handleTake(dose)}
                      onSkip={() => handleSkip(dose)}
                    />
                  ))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
