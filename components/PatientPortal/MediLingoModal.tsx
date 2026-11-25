import React, { useState, useEffect } from 'react';
import type { MediLingoExplanation, AnatomicalSystem } from '../../types';
import { translateClinicalRecordWithGemini } from '../../services/geminiService';

interface MediLingoModalProps {
  record: {
    title: string;
    summary: string;
    type: string;
    doctorName?: string;
    date?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MediLingoModal: React.FC<MediLingoModalProps> = ({ record, isOpen, onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [explanation, setExplanation] = useState<MediLingoExplanation | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeSystemHover, setActiveSystemHover] = useState<AnatomicalSystem | null>(null);

  useEffect(() => {
    if (isOpen && record) {
      setLoading(true);
      translateClinicalRecordWithGemini(record.title, record.summary, record.type)
        .then(res => {
          setExplanation(res);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to translate clinical record:', err);
          setLoading(false);
        });
    } else {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const handleSpeak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (!explanation) return;

    const textToSpeak = `Here is your plain English medical explanation. ${explanation.plainEnglishSummary}. Key takeaways: ${explanation.keyTakeaways.join('. ')}.`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyQuestion = (question: string, index: number) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(question);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const currentSystem = explanation?.anatomicalSystem || 'General';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-dark-card border border-primary/30 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-primary text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
              🧬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider bg-white/25 px-2.5 py-0.5 rounded-full">
                  MediLingo™ AI
                </span>
                <span className="text-xs text-blue-100 font-medium">Plain-English Translator</span>
              </div>
              <h3 className="text-xl font-bold mt-0.5">Demystify My Medical Record</h3>
            </div>
          </div>
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
              onClose();
            }}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-gray-800 dark:text-dark-text">
          {loading ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                Translating clinical terminology into plain, compassionate English...
              </p>
              <p className="text-xs text-gray-400">Consulting anatomical and diagnostic models</p>
            </div>
          ) : explanation ? (
            <>
              {/* Record Origin Banner */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{record.type}</span>
                  <h4 className="font-bold text-gray-900 dark:text-white text-base">{record.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {record.doctorName ? `Issued by ${record.doctorName}` : 'Hospital Diagnostic Report'}
                    {record.date ? ` • ${record.date}` : ''}
                  </p>
                </div>
                <button
                  onClick={handleSpeak}
                  className={`self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                    isSpeaking
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-300 hover:bg-primary/20'
                  }`}
                >
                  <span>{isSpeaking ? '⏹️ Stop Reading' : '🔊 Listen in Plain English'}</span>
                </button>
              </div>

              {/* Jargon vs Plain English Side-by-Side Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400 mb-2 uppercase tracking-wide">
                    <span>📜</span>
                    <span>Original Clinical Wording</span>
                  </div>
                  <p className="text-xs font-mono text-gray-700 dark:text-gray-300 leading-relaxed bg-white/70 dark:bg-gray-900/50 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">
                    "{record.summary || 'Findings as recorded in medical chart.'}"
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2 uppercase tracking-wide">
                    <span>🌱</span>
                    <span>What It Means In Simple Terms</span>
                  </div>
                  <p className="text-sm font-medium text-emerald-950 dark:text-emerald-100 leading-relaxed">
                    {explanation.plainEnglishSummary}
                  </p>
                  {explanation.severityNote && (
                    <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-2.5 py-1 rounded-full">
                      <span>✓</span> {explanation.severityNote}
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Anatomical System Visualizer */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/70 dark:from-indigo-950/20 dark:to-blue-950/20 border border-indigo-200 dark:border-indigo-900/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <h5 className="font-bold text-sm text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                      <span>🗺️</span>
                      <span>Anatomical Region Highlighted</span>
                    </h5>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Visualizing where this clinical evaluation focuses on your body.
                    </p>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-600 text-white self-start sm:self-auto">
                    {explanation.systemName}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 bg-white dark:bg-dark-card p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                  {/* SVG Anatomical Silhouette */}
                  <div className="relative w-36 h-48 flex-shrink-0 flex items-center justify-center bg-indigo-50/50 dark:bg-gray-800/50 rounded-xl p-2">
                    <svg viewBox="0 0 100 160" className="w-full h-full">
                      {/* Head */}
                      <circle
                        cx="50"
                        cy="18"
                        r="12"
                        className={`transition-colors duration-300 ${
                          currentSystem === 'Nervous' || activeSystemHover === 'Nervous'
                            ? 'fill-purple-500 filter drop-shadow(0 0 6px rgba(168,85,247,0.8))'
                            : 'fill-gray-300 dark:fill-gray-600'
                        }`}
                      />
                      {/* Neck */}
                      <rect
                        x="46"
                        y="30"
                        width="8"
                        height="6"
                        className={currentSystem === 'Endocrine' ? 'fill-teal-500 animate-pulse' : 'fill-gray-300 dark:fill-gray-600'}
                      />
                      {/* Torso */}
                      <path
                        d="M32,36 L68,36 L64,95 L36,95 Z"
                        className={`transition-colors duration-300 ${
                          currentSystem === 'Cardiovascular'
                            ? 'fill-rose-400'
                            : currentSystem === 'Respiratory'
                            ? 'fill-cyan-400'
                            : currentSystem === 'Digestive'
                            ? 'fill-amber-400'
                            : 'fill-gray-300 dark:fill-gray-600'
                        }`}
                      />
                      {/* Spine / Musculoskeletal indicator */}
                      <line
                        x1="50"
                        y1="36"
                        x2="50"
                        y2="95"
                        stroke={currentSystem === 'Musculoskeletal' ? '#F59E0B' : '#94A3B8'}
                        strokeWidth={currentSystem === 'Musculoskeletal' ? '4' : '2'}
                        strokeDasharray={currentSystem === 'Musculoskeletal' ? 'none' : '2,2'}
                        className={currentSystem === 'Musculoskeletal' ? 'animate-pulse' : ''}
                      />
                      {/* Heart Pulse Node */}
                      <circle
                        cx="54"
                        cy="52"
                        r={currentSystem === 'Cardiovascular' ? '7' : '4'}
                        className={`${
                          currentSystem === 'Cardiovascular'
                            ? 'fill-rose-600 animate-ping'
                            : 'fill-rose-400/50'
                        }`}
                      />
                      {/* Arms */}
                      <line x1="32" y1="38" x2="16" y2="85" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" />
                      <line x1="68" y1="38" x2="84" y2="85" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" />
                      {/* Legs */}
                      <line x1="40" y1="95" x2="36" y2="150" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />
                      <line x1="60" y1="95" x2="64" y2="150" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />
                    </svg>
                  </div>

                  {/* Anatomical Explanation */}
                  <div className="space-y-2 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                      System Role & Function
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {explanation.systemName}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                      {explanation.systemDescription}
                    </p>
                    <div className="pt-2 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-medium">
                        Target System: {currentSystem}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-medium">
                        Non-Invasive Diagnostic
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Takeaways */}
              <div>
                <h5 className="font-bold text-sm text-gray-900 dark:text-white mb-2.5 flex items-center gap-1.5">
                  <span>💡</span>
                  <span>Key Points to Know</span>
                </h5>
                <div className="space-y-2">
                  {explanation.keyTakeaways.map((takeaway, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border flex items-start gap-2.5 text-xs text-gray-700 dark:text-gray-200"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 flex items-center justify-center font-bold flex-shrink-0 text-[10px]">
                        ✓
                      </span>
                      <span className="leading-relaxed">{takeaway}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3 Smart Questions For Your Doctor */}
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-sm text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                    <span>🙋</span>
                    <span>3 Smart Questions to Ask Your Doctor</span>
                  </h5>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                    Tap to copy for visit
                  </span>
                </div>
                <div className="space-y-2">
                  {explanation.smartQuestionsForDoctor.map((q, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-dark-card border border-blue-100 dark:border-blue-900/40 text-xs text-gray-800 dark:text-dark-text gap-3 hover:border-blue-300 transition"
                    >
                      <span className="font-medium flex items-center gap-2">
                        <span className="text-blue-500 font-bold">{idx + 1}.</span>
                        <span>"{q}"</span>
                      </span>
                      <button
                        onClick={() => handleCopyQuestion(q, idx)}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex-shrink-0 px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/40"
                      >
                        {copiedIndex === idx ? '✓ Copied!' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-gray-500 py-10">Unable to load clinical translation.</p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t dark:border-dark-border bg-gray-50 dark:bg-dark-bg flex items-center justify-between">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
            For educational empowerment. Always discuss questions directly with your physician.
          </p>
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
              onClose();
            }}
            className="bg-primary text-white font-semibold py-2 px-5 rounded-xl text-sm hover:bg-primary/90 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediLingoModal;
