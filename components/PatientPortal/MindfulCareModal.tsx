import React, { useState, useEffect, useRef } from 'react';
import type { User } from '../../types';
import { generatePreVisitPocketBrief } from '../../services/geminiService';
import { triggerVibration } from '../../services/queueService';

interface MindfulCareModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

type BreathingPhase = 'Inhale' | 'Hold (Full)' | 'Exhale' | 'Hold (Empty)';

export const MindfulCareModal: React.FC<MindfulCareModalProps> = ({ isOpen, onClose, user }) => {
  const [activeTab, setActiveTab] = useState<'breathing' | 'agenda'>('breathing');

  // Breathing State
  const [phase, setPhase] = useState<BreathingPhase>('Inhale');
  const [secondsLeft, setSecondsLeft] = useState<number>(4);
  const [cycleCount, setCycleCount] = useState<number>(0);
  const [isBreathingActive, setIsBreathingActive] = useState<boolean>(true);

  // Agenda Form State
  const [primarySymptom, setPrimarySymptom] = useState<string>('');
  const [durationTimeline, setDurationTimeline] = useState<string>('');
  const [keyWorry, setKeyWorry] = useState<string>('');
  const [generatedBrief, setGeneratedBrief] = useState<string>('');
  const [isGeneratingBrief, setIsGeneratingBrief] = useState<boolean>(false);
  const [copiedBrief, setCopiedBrief] = useState<boolean>(false);

  // 4-4-4-4 Box Breathing Timer Effect
  useEffect(() => {
    if (!isOpen || activeTab !== 'breathing' || !isBreathingActive) return;

    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev > 1) {
          return prev - 1;
        }

        // Transition Phase
        setPhase(current => {
          let nextPhase: BreathingPhase = 'Inhale';
          if (current === 'Inhale') nextPhase = 'Hold (Full)';
          else if (current === 'Hold (Full)') nextPhase = 'Exhale';
          else if (current === 'Exhale') nextPhase = 'Hold (Empty)';
          else {
            nextPhase = 'Inhale';
            setCycleCount(c => c + 1);
          }

          // Gentle haptic feedback on phase shift
          triggerVibration([100]);
          return nextPhase;
        });

        return 4;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, activeTab, isBreathingActive]);

  if (!isOpen) return null;

  const handleGenerateBrief = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primarySymptom.trim()) return;

    setIsGeneratingBrief(true);
    try {
      const brief = await generatePreVisitPocketBrief({
        symptoms: primarySymptom,
        duration: durationTimeline,
        worryOrQuestion: keyWorry,
        patientName: user.name,
      });
      setGeneratedBrief(brief);
    } catch {
      setGeneratedBrief('Unable to generate pocket brief.');
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  const handleCopyBrief = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(generatedBrief);
      setCopiedBrief(true);
      setTimeout(() => setCopiedBrief(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-dark-card border border-teal-500/30 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-teal-800 via-cyan-800 to-teal-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
              🕊️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-extrabold tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                  MindfulCare™
                </span>
                <span className="text-xs text-teal-200">Pre-Consultation Anxiety Calmer</span>
              </div>
              <h3 className="text-lg font-bold">White-Coat Calmer & Visit Prep</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-sm font-semibold">
          <button
            onClick={() => setActiveTab('breathing')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'breathing'
                ? 'border-teal-600 text-teal-700 dark:text-teal-300 bg-white dark:bg-dark-card font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <span>🧘</span>
            <span>Haptic Box-Breathing</span>
          </button>
          <button
            onClick={() => setActiveTab('agenda')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'agenda'
                ? 'border-teal-600 text-teal-700 dark:text-teal-300 bg-white dark:bg-dark-card font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <span>📝</span>
            <span>2-Min Visit Agenda Builder</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-gray-800 dark:text-dark-text">
          {activeTab === 'breathing' ? (
            <div className="space-y-6 text-center">
              <div>
                <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                  Physiological Sigh & Box Breathing
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                  Soothes the sympathetic nervous system, lowering rapid heart rates and elevated blood pressure spikes before your doctor calls your name.
                </p>
              </div>

              {/* Animated Visual Breathing Lotus / Ring */}
              <div className="relative w-56 h-56 mx-auto flex items-center justify-center">
                {/* Outer animated halo */}
                <div
                  className={`absolute inset-0 rounded-full transition-all duration-1000 ease-in-out ${
                    phase === 'Inhale'
                      ? 'scale-110 bg-teal-400/30 dark:bg-teal-500/20'
                      : phase === 'Exhale'
                      ? 'scale-75 bg-blue-400/20 dark:bg-blue-500/10'
                      : 'scale-95 bg-teal-300/20'
                  }`}
                />

                {/* Central Circle */}
                <div
                  className={`w-40 h-40 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all duration-1000 ease-in-out ${
                    phase === 'Inhale'
                      ? 'bg-gradient-to-tr from-teal-600 to-emerald-500 scale-105 ring-8 ring-teal-300/40'
                      : phase === 'Hold (Full)'
                      ? 'bg-gradient-to-tr from-emerald-600 to-teal-700 scale-105 ring-4 ring-emerald-300/40'
                      : phase === 'Exhale'
                      ? 'bg-gradient-to-tr from-cyan-700 to-blue-600 scale-90 ring-6 ring-blue-300/30'
                      : 'bg-gradient-to-tr from-teal-800 to-cyan-900 scale-90 ring-4 ring-teal-200/20'
                  }`}
                >
                  <span className="text-xs uppercase font-extrabold tracking-widest text-teal-100">
                    {phase}
                  </span>
                  <span className="text-4xl font-black mt-0.5">{secondsLeft}s</span>
                  <span className="text-[10px] text-teal-200/80 mt-1">4-4-4-4 Rhythm</span>
                </div>
              </div>

              {/* Haptic Notification & Cycle Tracker */}
              <div className="flex items-center justify-center gap-4 text-xs">
                <span className="px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-semibold flex items-center gap-1.5">
                  <span>📳</span> Gentle Haptics Active
                </span>
                <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold">
                  Cycles Completed: {cycleCount}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/40 text-xs text-teal-900 dark:text-teal-200 text-left">
                <strong>💡 Did you know?</strong> Box breathing is used by cardiac rehabilitation centers and surgeons. 4 cycles can lower acute systolic blood pressure by up to 6–10 mmHg.
              </div>

              <button
                onClick={() => setIsBreathingActive(!isBreathingActive)}
                className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
              >
                {isBreathingActive ? 'Pause Breathing Guide' : 'Resume Breathing Guide'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                  2-Minute Pre-Visit Thought Organizer
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Patients often freeze or forget symptoms in the exam room. Organize your thoughts now into a concise pocket brief.
                </p>
              </div>

              <form onSubmit={handleGenerateBrief} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    1. Main Symptom or Reason for Visit
                  </label>
                  <input
                    type="text"
                    value={primarySymptom}
                    onChange={e => setPrimarySymptom(e.target.value)}
                    placeholder="e.g. Sharp pain in lower back when sitting down"
                    required
                    className="w-full p-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      2. Duration & Timeline
                    </label>
                    <input
                      type="text"
                      value={durationTimeline}
                      onChange={e => setDurationTimeline(e.target.value)}
                      placeholder="e.g. Started 5 days ago after lifting luggage"
                      className="w-full p-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      3. Your #1 Worry or Question
                    </label>
                    <input
                      type="text"
                      value={keyWorry}
                      onChange={e => setKeyWorry(e.target.value)}
                      placeholder="e.g. Is it a herniated disc or muscle spasm?"
                      className="w-full p-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isGeneratingBrief || !primarySymptom.trim()}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition shadow-sm disabled:opacity-50"
                >
                  {isGeneratingBrief ? 'Crafting Your Doctor Pocket Brief...' : '✨ Create Pocket Doctor Brief'}
                </button>
              </form>

              {generatedBrief && (
                <div className="mt-4 p-4 rounded-xl bg-teal-50/80 dark:bg-dark-bg border border-teal-300 dark:border-teal-800 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-teal-800 dark:text-teal-300">
                      📄 Your Ready Pocket Brief
                    </span>
                    <button
                      onClick={handleCopyBrief}
                      className="text-xs font-bold px-2.5 py-1 rounded bg-teal-600 text-white hover:bg-teal-700"
                    >
                      {copiedBrief ? '✓ Copied!' : 'Copy to Clipboard'}
                    </button>
                  </div>
                  <div className="text-xs font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed bg-white dark:bg-gray-900 p-3 rounded-lg border border-teal-200 dark:border-gray-700">
                    {generatedBrief}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    💡 Hold this screen up to your doctor or read it aloud during the first 60 seconds of your visit.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t dark:border-dark-border bg-gray-50 dark:bg-dark-bg flex justify-end">
          <button
            onClick={onClose}
            className="bg-teal-700 hover:bg-teal-800 text-white font-semibold py-2 px-5 rounded-xl text-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default MindfulCareModal;
