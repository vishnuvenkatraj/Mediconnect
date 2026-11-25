import React from 'react';
import type { VoiceSessionState, VoiceLanguage } from '../../services/voice/types';

interface VoiceButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  state: VoiceSessionState;
  language: VoiceLanguage;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  isOpen,
  onToggle,
  state,
  language
}) => {
  const getLanguageLabel = () => {
    switch (language) {
      case 'ta-IN': return 'தமிழ்';
      case 'hi-IN': return 'हिन्दी';
      case 'mixed': return 'Tanglish';
      default: return 'English';
    }
  };

  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';
  const isProcessing = state === 'processing';

  return (
    <div className="fixed bottom-6 left-6 z-40 flex items-center gap-2 select-none animate-fadeIn">
      <button
        onClick={onToggle}
        className={`relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-gradient-to-tr from-indigo-700 to-primary text-white scale-105 ring-4 ring-primary/40'
            : isListening
            ? 'bg-gradient-to-tr from-rose-600 to-amber-500 text-white animate-pulse ring-4 ring-rose-400/50 scale-110'
            : isSpeaking
            ? 'bg-gradient-to-tr from-teal-600 to-emerald-500 text-white ring-4 ring-teal-400/40 scale-105'
            : 'bg-gradient-to-tr from-primary via-indigo-600 to-blue-600 hover:scale-105 text-white ring-2 ring-white/30'
        }`}
        aria-label="Open AI Voice Assistant"
        title="MediConnect Multilingual AI Voice Assistant (English, Tamil, Hindi, Tanglish)"
      >
        {/* Pulsing Outer Soundwaves when Active */}
        {(isListening || isSpeaking) && (
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-75" />
        )}

        {/* Central Icon */}
        <span className="text-2xl relative z-10">
          {isOpen ? '✕' : isListening ? '🎙️' : isSpeaking ? '🔊' : isProcessing ? '⏳' : '🎙️'}
        </span>

        {/* Language Badge */}
        <span className="absolute -top-1 -right-1 bg-amber-400 text-gray-900 font-black text-[9px] px-1.5 py-0.5 rounded-full shadow border border-white">
          {getLanguageLabel()}
        </span>
      </button>

      {/* Ambient Floating Pill when closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 dark:bg-dark-card/90 backdrop-blur-md border border-primary/20 shadow-lg text-xs font-bold text-primary dark:text-blue-300 hover:bg-white transition"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Voice AI Assistant</span>
        </button>
      )}
    </div>
  );
};

export default VoiceButton;
