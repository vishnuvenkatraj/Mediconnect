import React, { useState, useEffect, useMemo } from 'react';
import type { DailyLifestyleLog, User } from '../../types';
import { MOCK_WELLNESS_DATA } from '../../constants';

interface DietLifestyleGoalsProps {
  patientId: string;
  user?: User;
  onOpenWellnessVitals?: () => void;
}

export const DietLifestyleGoals: React.FC<DietLifestyleGoalsProps> = ({
  patientId,
  user,
  onOpenWellnessVitals,
}) => {
  const todayKey = new Date().toISOString().split('T')[0];

  const [todayLog, setTodayLog] = useState<DailyLifestyleLog>(() => {
    try {
      const saved = localStorage.getItem(`lifestyle_log_${patientId}_${todayKey}`);
      if (saved) return JSON.parse(saved);
    } catch {}

    return {
      id: `ls_${Date.now()}`,
      patientId,
      date: todayKey,
      waterGlasses: 5,
      sleepHours: 7.5,
      sleepQuality: 'Restful',
      vitalityScore: 4,
      activeMinutes: 30,
      stressLevel: 'Low',
      dietFocus: 'Heart-Healthy',
      notes: 'Feeling energetic after morning walk.',
    };
  });

  const [isSavedFeedback, setIsSavedFeedback] = useState<boolean>(false);

  const handleUpdateLog = <K extends keyof DailyLifestyleLog>(key: K, value: DailyLifestyleLog[K]) => {
    setTodayLog(prev => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem(`lifestyle_log_${patientId}_${todayKey}`, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 2000);
  };

  const handleAddGlass = () => {
    if (todayLog.waterGlasses < 12) {
      handleUpdateLog('waterGlasses', todayLog.waterGlasses + 1);
    }
  };

  const handleRemoveGlass = () => {
    if (todayLog.waterGlasses > 0) {
      handleUpdateLog('waterGlasses', todayLog.waterGlasses - 1);
    }
  };

  // Lifestyle-to-Vitals Correlation Insight
  const synergyInsights = useMemo(() => {
    return [
      {
        icon: '🫀',
        title: 'Sleep & Blood Pressure Synergy',
        message:
          todayLog.sleepHours >= 7
            ? 'Optimal 7+ hours of sleep promotes nocturnal blood pressure dipping, resting your cardiovascular system.'
            : 'Shorter sleep cycles can keep cortisol levels elevated, causing mild systolic pressure elevations.',
        tag: todayLog.sleepHours >= 7 ? 'Protective' : 'Attention Suggested'
      },
      {
        icon: '💧',
        title: 'Hydration & Vascular Elasticity',
        message:
          todayLog.waterGlasses >= 6
            ? `Great hydration (${todayLog.waterGlasses * 250} ml logged) maintains optimal blood viscosity and kidney filtration.`
            : 'Dehydration can cause mild orthostatic dizziness and strain kidney filtration.',
        tag: todayLog.waterGlasses >= 6 ? 'Well Hydrated' : 'Hydration Goal: 8 Glasses'
      },
      {
        icon: '🥗',
        title: 'Diet Focus: ' + todayLog.dietFocus,
        message:
          todayLog.dietFocus === 'Heart-Healthy' || todayLog.dietFocus === 'Low Sodium'
            ? 'Limiting excess sodium protects arterial lining and decreases fluid retention around cardiac tissues.'
            : 'Consistent, balanced macronutrient timing stabilizes blood glucose and prevents mid-afternoon energy crashes.',
        tag: 'Dietary Alignment'
      }
    ];
  }, [todayLog.sleepHours, todayLog.waterGlasses, todayLog.dietFocus]);

  const waterTarget = 8;
  const hydrationPct = Math.min(100, Math.round((todayLog.waterGlasses / waterTarget) * 100));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
              BioRhythm & Lifestyle
            </span>
            <span className="text-xs text-emerald-100 font-medium">Holistic Health Companion</span>
          </div>
          <h3 className="text-2xl font-black mt-1">Daily Lifestyle & Circadian Rhythm</h3>
          <p className="text-xs text-emerald-100 mt-1 max-w-xl leading-relaxed">
            Health is built in daily habits. Track your hydration, restorative sleep, and nutritional rhythms to see their direct impact on clinical vitals.
          </p>
        </div>

        {onOpenWellnessVitals && (
          <button
            onClick={onOpenWellnessVitals}
            className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold py-2.5 px-5 rounded-xl shadow-md transition text-xs flex items-center gap-2 self-start md:self-auto"
          >
            <span>📊</span>
            <span>View Clinical Vitals Graphs</span>
          </button>
        )}
      </div>

      {isSavedFeedback && (
        <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 text-xs font-bold text-center border border-emerald-300 dark:border-emerald-800 animate-fadeIn">
          ✓ Daily lifestyle log updated automatically!
        </div>
      )}

      {/* Main Grid: Hydration & Sleep */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hydration Tracker */}
        <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-blue-200 dark:border-dark-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">💧</span>
              <div>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Hydration Tracker</h4>
                <p className="text-xs text-gray-500">Target: 8 glasses (2,000 ml)</p>
              </div>
            </div>
            <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
              {todayLog.waterGlasses} / {waterTarget} ({hydrationPct}%)
            </span>
          </div>

          {/* Visual Glass Row */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 py-2">
            {Array.from({ length: waterTarget }).map((_, i) => {
              const isFilled = i < todayLog.waterGlasses;
              return (
                <button
                  key={i}
                  onClick={() => handleUpdateLog('waterGlasses', i + 1)}
                  className={`h-12 rounded-xl flex items-center justify-center text-lg transition-all ${
                    isFilled
                      ? 'bg-blue-500 text-white shadow-sm scale-105'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                  }`}
                  title={`Glass ${i + 1}`}
                >
                  💧
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRemoveGlass}
                disabled={todayLog.waterGlasses <= 0}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-600 dark:text-gray-300 disabled:opacity-40"
              >
                - 1 Glass
              </button>
              <button
                onClick={handleAddGlass}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
              >
                + 1 Glass
              </button>
            </div>
            <span className="text-xs text-gray-500">~{todayLog.waterGlasses * 250} ml total</span>
          </div>
        </div>

        {/* Circadian Sleep & Recovery */}
        <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-indigo-200 dark:border-dark-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">💤</span>
              <div>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Circadian Sleep & Recovery</h4>
                <p className="text-xs text-gray-500">Restorative nocturnal cycle</p>
              </div>
            </div>
            <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
              {todayLog.sleepHours} hrs
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
              Sleep Duration
            </label>
            <input
              type="range"
              min="3"
              max="12"
              step="0.5"
              value={todayLog.sleepHours}
              onChange={e => handleUpdateLog('sleepHours', parseFloat(e.target.value))}
              className="w-full accent-indigo-600 h-2 bg-gray-200 rounded-lg cursor-pointer dark:bg-gray-700"
            />
            <div className="flex justify-between text-[11px] text-gray-400 mt-1">
              <span>3 hrs</span>
              <span className="font-bold text-indigo-600">7.5 hrs (Target)</span>
              <span>12 hrs</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">
              Sleep Quality Rating
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Restful', 'Fair', 'Restless'] as const).map(q => (
                <button
                  key={q}
                  onClick={() => handleUpdateLog('sleepQuality', q)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition ${
                    todayLog.sleepQuality === q
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                  }`}
                >
                  {q === 'Restful' ? '✨ Restful' : q === 'Fair' ? '👌 Fair' : '⚡ Restless'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Movement, Diet Focus & Vitality Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Diet Focus */}
        <div className="p-5 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-sm space-y-3">
          <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
            <span>🥗</span>
            <span>Nutrition & Diet Focus</span>
          </h4>
          <p className="text-xs text-gray-500">Aligned with clinical recommendations.</p>
          <div className="space-y-1.5">
            {(['Heart-Healthy', 'Low Sodium', 'Balanced', 'Diabetic-Friendly'] as const).map(d => (
              <button
                key={d}
                onClick={() => handleUpdateLog('dietFocus', d)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-between ${
                  todayLog.dietFocus === d
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 font-bold border border-emerald-300 dark:border-emerald-800'
                    : 'bg-gray-50 dark:bg-dark-bg text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                }`}
              >
                <span>{d}</span>
                {todayLog.dietFocus === d && <span>✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Physical Movement */}
        <div className="p-5 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-sm space-y-3">
          <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
            <span>🏃</span>
            <span>Daily Physical Movement</span>
          </h4>
          <p className="text-xs text-gray-500">Target: 30 minutes brisk walking</p>
          <div className="text-center py-2">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {todayLog.activeMinutes} mins
            </span>
          </div>
          <div className="flex items-center gap-2">
            {[15, 30, 45, 60].map(mins => (
              <button
                key={mins}
                onClick={() => handleUpdateLog('activeMinutes', mins)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                  todayLog.activeMinutes === mins
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>

        {/* Vitality & Energy Score */}
        <div className="p-5 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-sm space-y-3">
          <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
            <span>⚡</span>
            <span>Vitality & Energy Score</span>
          </h4>
          <p className="text-xs text-gray-500">Subjective daily wellness sense</p>
          <div className="flex items-center justify-around py-3">
            {[1, 2, 3, 4, 5].map(score => (
              <button
                key={score}
                onClick={() => handleUpdateLog('vitalityScore', score)}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  todayLog.vitalityScore === score
                    ? 'bg-amber-500 text-white scale-110 shadow-md ring-4 ring-amber-200 dark:ring-amber-900/60'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-amber-100'
                }`}
              >
                {score}
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-gray-500">
            {todayLog.vitalityScore >= 4 ? 'Energized & Vibrant' : todayLog.vitalityScore === 3 ? 'Moderate Energy' : 'Rest Advised'}
          </p>
        </div>
      </div>

      {/* Synergy Insight Engine: Clinical Correlated Wisdom */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/70 dark:from-indigo-950/20 dark:to-blue-950/20 border border-indigo-200 dark:border-indigo-900/40 space-y-4">
        <div>
          <h4 className="font-bold text-base text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
            <span>🧬</span>
            <span>Lifestyle-to-Vitals Synergy Insights</span>
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            How your daily habits directly correlate with clinical blood pressure, glucose, and long-term vitality.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {synergyInsights.map((insight, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-white dark:bg-dark-card border border-indigo-100 dark:border-indigo-900/30 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{insight.icon}</span>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300">
                  {insight.tag}
                </span>
              </div>
              <h5 className="font-bold text-xs text-gray-900 dark:text-white">{insight.title}</h5>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                {insight.message}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DietLifestyleGoals;
