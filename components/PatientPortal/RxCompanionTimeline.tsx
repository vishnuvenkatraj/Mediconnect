import React, { useState, useEffect, useMemo } from 'react';
import type { Prescription, User, Doctor, ChronotherapyTimeSlot, FoodDrugInteractionAlert } from '../../types';
import { formatDisplayDate } from '../../services/dataSanitizer';

interface RxCompanionTimelineProps {
  prescriptions: Prescription[];
  user: User;
  doctors: Doctor[];
  onDownloadPdf: (prescription: Prescription) => void;
}

interface ScheduledDose {
  prescription: Prescription;
  slot: ChronotherapyTimeSlot;
  timeRange: string;
  slotIcon: string;
  mealAdvice: string;
  interactionAlerts: FoodDrugInteractionAlert[];
}

export const RxCompanionTimeline: React.FC<RxCompanionTimelineProps> = ({
  prescriptions = [],
  user,
  doctors,
  onDownloadPdf,
}) => {
  const todayKey = new Date().toISOString().split('T')[0];
  const [adherenceLog, setAdherenceLog] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`rx_adherence_${user.id}_${todayKey}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [streakDays, setStreakDays] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`rx_streak_${user.id}`);
      return saved ? parseInt(saved, 10) : 5;
    } catch {
      return 5;
    }
  });

  const [recentCheckedDose, setRecentCheckedDose] = useState<string | null>(null);

  const activePrescriptions = useMemo(() => {
    return prescriptions.filter(p => p.status === 'Active' || p.status === 'Dispensed');
  }, [prescriptions]);

  // Map each active prescription to its optimal chronotherapy blocks
  const scheduledDoses = useMemo((): ScheduledDose[] => {
    const list: ScheduledDose[] = [];

    activePrescriptions.forEach(p => {
      const freq = (p.frequency || '').toLowerCase();
      const med = (p.medication || '').toLowerCase();
      const notes = (p.notes || '').toLowerCase();

      // Detect interaction warnings
      const alerts: FoodDrugInteractionAlert[] = [];
      let mealAdvice = 'Take with water.';

      if (med.includes('amoxicillin') || med.includes('cipro') || med.includes('doxy') || med.includes('iron')) {
        alerts.push({
          type: 'warning',
          icon: '🥛',
          title: 'Dairy Caution',
          instruction: 'Avoid milk, cheese, and yogurt 2 hours before and after taking this medication.'
        });
      }

      if (med.includes('ibuprofen') || med.includes('aspirin') || med.includes('metformin') || med.includes('diclofenac')) {
        alerts.push({
          type: 'info',
          icon: '🥪',
          title: 'Take With Food',
          instruction: 'Take during or immediately after meals to protect your stomach lining.'
        });
        mealAdvice = 'Take with meals.';
      }

      if (med.includes('levothyroxine') || med.includes('omeprazole') || med.includes('pantoprazole')) {
        alerts.push({
          type: 'caution',
          icon: '☕',
          title: 'Empty Stomach Required',
          instruction: 'Take 30-60 minutes before breakfast with plain water; avoid coffee or tea.'
        });
        mealAdvice = 'Empty stomach (30 mins before food).';
      }

      if (med.includes('atorvastatin') || med.includes('simvastatin') || med.includes('sleep') || med.includes('melatonin')) {
        alerts.push({
          type: 'info',
          icon: '🌙',
          title: 'Bedtime Optimization',
          instruction: 'Liver enzymes synthesize lipids predominantly overnight; optimal at bedtime.'
        });
      }

      // Chronotherapy Slots Assignment
      if (freq.includes('three') || freq.includes('tid') || freq.includes('3 times')) {
        list.push({
          prescription: p,
          slot: 'Morning',
          timeRange: '08:00 AM (Breakfast)',
          slotIcon: '🌅',
          mealAdvice,
          interactionAlerts: alerts
        });
        list.push({
          prescription: p,
          slot: 'Afternoon',
          timeRange: '01:00 PM (Lunch)',
          slotIcon: '☀️',
          mealAdvice,
          interactionAlerts: alerts
        });
        list.push({
          prescription: p,
          slot: 'Evening',
          timeRange: '07:30 PM (Dinner)',
          slotIcon: '🌆',
          mealAdvice,
          interactionAlerts: alerts
        });
      } else if (freq.includes('twice') || freq.includes('bid') || freq.includes('2 times')) {
        list.push({
          prescription: p,
          slot: 'Morning',
          timeRange: '08:30 AM (Breakfast)',
          slotIcon: '🌅',
          mealAdvice,
          interactionAlerts: alerts
        });
        list.push({
          prescription: p,
          slot: 'Evening',
          timeRange: '08:00 PM (Dinner)',
          slotIcon: '🌆',
          mealAdvice,
          interactionAlerts: alerts
        });
      } else if (freq.includes('night') || freq.includes('bedtime') || med.includes('statin')) {
        list.push({
          prescription: p,
          slot: 'Bedtime',
          timeRange: '10:00 PM (Before Sleep)',
          slotIcon: '🌙',
          mealAdvice: 'Take with half glass of water before bed.',
          interactionAlerts: alerts
        });
      } else {
        // Default Once Daily -> Morning
        list.push({
          prescription: p,
          slot: 'Morning',
          timeRange: '09:00 AM (Morning Routine)',
          slotIcon: '🌅',
          mealAdvice,
          interactionAlerts: alerts
        });
      }
    });

    return list;
  }, [activePrescriptions]);

  const handleToggleTaken = (doseKey: string) => {
    const isNowTaken = !adherenceLog[doseKey];
    const updated = { ...adherenceLog, [doseKey]: isNowTaken };
    setAdherenceLog(updated);

    try {
      localStorage.setItem(`rx_adherence_${user.id}_${todayKey}`, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    if (isNowTaken) {
      setRecentCheckedDose(doseKey);
      setTimeout(() => setRecentCheckedDose(null), 2500);

      const allTaken = scheduledDoses.every(d => updated[`${d.prescription.id}_${d.slot}`]);
      if (allTaken && scheduledDoses.length > 0) {
        const nextStreak = streakDays + 1;
        setStreakDays(nextStreak);
        try {
          localStorage.setItem(`rx_streak_${user.id}`, nextStreak.toString());
        } catch {}
      }
    }
  };

  const slotsOrder: Array<{ slot: ChronotherapyTimeSlot; title: string; time: string; icon: string }> = [
    { slot: 'Morning', title: 'Morning Window', time: '07:00 AM – 10:00 AM', icon: '🌅' },
    { slot: 'Afternoon', title: 'Midday Window', time: '12:00 PM – 02:30 PM', icon: '☀️' },
    { slot: 'Evening', title: 'Evening Window', time: '06:30 PM – 09:00 PM', icon: '🌆' },
    { slot: 'Bedtime', title: 'Bedtime Window', time: '09:30 PM – 11:30 PM', icon: '🌙' },
  ];

  const totalDosesCount = scheduledDoses.length;
  const takenCount = scheduledDoses.filter(d => adherenceLog[`${d.prescription.id}_${d.slot}`]).length;
  const compliancePercentage = totalDosesCount > 0 ? Math.round((takenCount / totalDosesCount) * 100) : 100;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner: Adherence & Streak */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-700 via-emerald-700 to-teal-800 text-white shadow-lg border border-teal-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
              RxCompanion™
            </span>
            <span className="text-xs text-teal-100 font-medium">Circadian Chronotherapy</span>
          </div>
          <h3 className="text-2xl font-black mt-1">24-Hour Medication Rhythm</h3>
          <p className="text-xs text-teal-100 mt-0.5">
            Optimized medication scheduling aligned with biological clocks and gastric absorption.
          </p>
        </div>

        {/* Adherence Streak Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-center">
            <p className="text-[10px] uppercase font-bold text-teal-200">Adherence Streak</p>
            <p className="text-xl font-black flex items-center justify-center gap-1">
              <span>🔥</span>
              <span>{streakDays} Days</span>
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-center">
            <p className="text-[10px] uppercase font-bold text-teal-200">Today's Progress</p>
            <p className="text-xl font-black text-emerald-300">
              {takenCount} / {totalDosesCount}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-100 dark:bg-dark-bg p-3 rounded-xl border border-gray-200 dark:border-dark-border flex items-center gap-3">
        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">
          Today's Adherence: {compliancePercentage}%
        </span>
        <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${compliancePercentage}%` }}
          />
        </div>
        {compliancePercentage === 100 && totalDosesCount > 0 && (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
            🎉 All Doses Logged!
          </span>
        )}
      </div>

      {/* Chronological Time Windows */}
      <div className="space-y-6">
        {slotsOrder.map(({ slot, title, time, icon }) => {
          const slotDoses = scheduledDoses.filter(d => d.slot === slot);

          return (
            <div
              key={slot}
              className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-sm overflow-hidden"
            >
              {/* Window Header */}
              <div className="px-5 py-3.5 bg-gray-50/80 dark:bg-dark-bg/60 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">{title}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{time}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-200/70 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {slotDoses.length} {slotDoses.length === 1 ? 'medication' : 'medications'}
                </span>
              </div>

              {/* Doses in this window */}
              <div className="p-4 space-y-3">
                {slotDoses.length > 0 ? (
                  slotDoses.map(dose => {
                    const doseKey = `${dose.prescription.id}_${dose.slot}`;
                    const isTaken = Boolean(adherenceLog[doseKey]);
                    const isJustChecked = recentCheckedDose === doseKey;

                    return (
                      <div
                        key={doseKey}
                        className={`p-4 rounded-xl border transition-all duration-300 ${
                          isTaken
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 opacity-90'
                            : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 hover:border-primary/50'
                        } ${isJustChecked ? 'scale-[1.01] ring-2 ring-emerald-500 shadow-md' : ''}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-base text-gray-900 dark:text-white">
                                {dose.prescription.medication}
                              </h5>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                                {dose.prescription.dosage}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 flex items-center gap-2">
                              <span>⏰ {dose.timeRange}</span>
                              <span>•</span>
                              <span>🍽️ {dose.mealAdvice}</span>
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              Prescribed by {dose.prescription.doctorName} ({dose.prescription.frequency})
                            </p>
                          </div>

                          {/* 1-Tap Mark Dose Action */}
                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <button
                              onClick={() => handleToggleTaken(doseKey)}
                              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                                isTaken
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-primary text-white hover:bg-primary/90'
                              }`}
                            >
                              <span>{isTaken ? '✓ Taken Today' : '⚪ Mark as Taken'}</span>
                            </button>
                            <button
                              onClick={() => onDownloadPdf(dose.prescription)}
                              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                              title="Download Prescription PDF"
                            >
                              📄
                            </button>
                          </div>
                        </div>

                        {/* Food-Drug Interaction Safety Radar Alerts */}
                        {dose.interactionAlerts.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/60 space-y-1.5">
                            {dose.interactionAlerts.map((alert, aIdx) => (
                              <div
                                key={aIdx}
                                className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                                  alert.type === 'warning'
                                    ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900/40'
                                    : alert.type === 'caution'
                                    ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-900/40'
                                    : 'bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-900/40'
                                }`}
                              >
                                <span className="text-base flex-shrink-0">{alert.icon}</span>
                                <div>
                                  <strong className="font-semibold">{alert.title}: </strong>
                                  <span>{alert.instruction}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-gray-400 italic py-2">
                    No medications scheduled for this window.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RxCompanionTimeline;
