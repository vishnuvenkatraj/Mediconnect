import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { User, Medicine, Appointment, LabTest, Page, Prescription, Invoice } from '../types';
import type { 
  VoiceSessionState, 
  VoiceLanguage, 
  VoiceMessage, 
  VoiceToolExecutionContext 
} from '../services/voice/types';
import { VoiceSessionManager } from '../services/voice/VoiceSessionManager';

interface HealthAssistantProps {
  users: User[];
  medicines: Medicine[];
  appointments: Appointment[];
  currentUser?: User | null;
  setAppointments?: React.Dispatch<React.SetStateAction<Appointment[]>>;
  setMedicines?: React.Dispatch<React.SetStateAction<Medicine[]>>;
  prescriptions?: Prescription[];
  setPrescriptions?: React.Dispatch<React.SetStateAction<Prescription[]>>;
  labTests?: LabTest[];
  setLabTests?: React.Dispatch<React.SetStateAction<LabTest[]>>;
  invoices?: Invoice[];
  onNavigate?: (page: Page) => void;
  onNavigatePatientTab?: (tab: string) => void;
}

export const HealthAssistant: React.FC<HealthAssistantProps> = ({
  users,
  medicines,
  appointments,
  currentUser = null,
  setAppointments,
  setMedicines,
  prescriptions = [],
  setPrescriptions,
  labTests = [],
  setLabTests,
  invoices = [],
  onNavigate = () => {},
  onNavigatePatientTab,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [audioVoiceEnabled, setAudioVoiceEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Singleton VoiceSessionManager instance powering MediBot
  const sessionManager = useMemo(() => {
    return new VoiceSessionManager({
      provider: 'sarvam', // Auto-falls back to WebSpeech
      language: 'mixed',  // Tanglish/Mixed default
      autoSpeakResponse: true,
      continuousMode: true,
    });
  }, []);

  const [sessionState, setSessionState] = useState<VoiceSessionState>(sessionManager.getState());
  const [messages, setMessages] = useState<VoiceMessage[]>(sessionManager.getMessages());
  const [interimTranscript, setInterimTranscript] = useState<string>(sessionManager.getInterimTranscript());
  const [language, setLanguage] = useState<VoiceLanguage>(sessionManager.getLanguage());
  const [continuousMode, setContinuousMode] = useState<boolean>(sessionManager.isContinuousMode());

  // Subscribe to SessionManager events
  useEffect(() => {
    const unsubState = sessionManager.subscribeState(setSessionState);
    const unsubMsgs = sessionManager.subscribeMessages(setMessages);
    const unsubTranscript = sessionManager.subscribeTranscript(setInterimTranscript);

    return () => {
      unsubState();
      unsubMsgs();
      unsubTranscript();
    };
  }, [sessionManager]);

  // Listen for global logout event to shut down voice streams immediately
  useEffect(() => {
    const handleVoiceStop = () => {
      sessionManager.stopListening();
      sessionManager.stopSpeaking();
      sessionManager.clearSession();
    };
    window.addEventListener('mediconnect_voice_stop', handleVoiceStop);
    return () => {
      window.removeEventListener('mediconnect_voice_stop', handleVoiceStop);
    };
  }, [sessionManager]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      sessionManager.stopListening();
      sessionManager.stopSpeaking();
    };
  }, [sessionManager]);

  const executionContext: VoiceToolExecutionContext = useMemo(() => ({
    currentUser,
    users,
    appointments,
    setAppointments,
    medicines,
    setMedicines,
    prescriptions,
    setPrescriptions,
    labTests,
    setLabTests,
    invoices,
    onNavigate,
    onNavigatePatientTab,
  }), [
    currentUser,
    users,
    appointments,
    setAppointments,
    medicines,
    setMedicines,
    prescriptions,
    setPrescriptions,
    labTests,
    setLabTests,
    invoices,
    onNavigate,
    onNavigatePatientTab
  ]);

  // Keyboard accessibility: Escape closes drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        sessionManager.stopListening();
        sessionManager.stopSpeaking();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, sessionManager]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, interimTranscript, isOpen]);

  const handleToggleListening = () => {
    if (!currentUser) {
      alert("Please log in to your MediConnect account first to use AI voice features.");
      return;
    }

    if (sessionState === 'listening' || sessionState === 'requesting_permission') {
      sessionManager.stopListening();
    } else {
      // If speaking, interrupt speech first
      sessionManager.stopSpeaking();
      sessionManager.startListening(executionContext);
    }
  };

  const handleToggleContinuous = () => {
    const next = !continuousMode;
    setContinuousMode(next);
    sessionManager.setContinuousMode(next);
  };

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim() || sessionState === 'processing') return;

    // Interrupt any active speech
    sessionManager.stopSpeaking();
    const query = textInput.trim();
    setTextInput('');
    sessionManager.submitTextInput(query, executionContext);
  };

  const handleLanguageChange = (newLang: VoiceLanguage) => {
    setLanguage(newLang);
    sessionManager.setLanguage(newLang);
  };

  const handleInterruptSpeech = () => {
    sessionManager.stopSpeaking();
  };

  const isListening = sessionState === 'listening';
  const isSpeaking = sessionState === 'speaking';
  const isProcessing = sessionState === 'processing';
  const isWaitingForUser = sessionState === 'waiting_for_user';
  const isPaused = sessionState === 'paused';
  const isPermissionDenied = sessionState === 'permission_denied';

  const getLanguagePill = () => {
    switch (language) {
      case 'ta-IN': return 'தமிழ்';
      case 'hi-IN': return 'हिन्दी';
      case 'mixed': return 'Tanglish';
      default: return 'English';
    }
  };

  return (
    <>
      {/* Floating MediBot Trigger Button */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 select-none animate-fadeIn">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/95 dark:bg-dark-card/95 backdrop-blur-md border border-primary/30 shadow-xl text-xs font-bold text-primary dark:text-blue-300 hover:scale-105 transition"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>MediBot AI Voice & Chat</span>
            <span className="bg-amber-400 text-gray-900 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
              {getLanguagePill()}
            </span>
          </button>
        )}

        <button
          onClick={() => {
            if (isOpen) {
              sessionManager.stopListening();
              sessionManager.stopSpeaking();
            }
            setIsOpen(!isOpen);
          }}
          className={`relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
            isOpen
              ? 'bg-gradient-to-tr from-gray-700 to-gray-900 text-white scale-105'
              : isListening
              ? 'bg-gradient-to-tr from-rose-600 via-amber-500 to-rose-700 text-white animate-pulse ring-4 ring-rose-400/50 scale-110'
              : isSpeaking
              ? 'bg-gradient-to-tr from-teal-600 to-emerald-500 text-white ring-4 ring-teal-400/40 scale-105'
              : 'bg-gradient-to-tr from-primary via-indigo-600 to-blue-600 text-white hover:scale-110 shadow-glow-primary'
          }`}
          aria-label="Open MediBot Assistant"
        >
          {/* Animated soundwave ring when listening/speaking */}
          {(isListening || isSpeaking) && (
            <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping opacity-75" />
          )}

          <div className="relative z-10 flex items-center justify-center">
            {isOpen ? (
              <span className="text-xl font-bold">✕</span>
            ) : isListening ? (
              <span className="text-2xl animate-bounce">🎙️</span>
            ) : isSpeaking ? (
              <span className="text-2xl">🔊</span>
            ) : (
              <div className="flex items-center text-xl">
                <span>💬</span>
                <span className="text-xs absolute -bottom-1 -right-1">🎙️</span>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Multimodal MediBot Chat & Voice Drawer */}
      {isOpen && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-label="MediBot AI Multimodal Healthcare Voice Assistant"
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[94vw] sm:w-[420px] max-w-[450px] h-[600px] max-h-[85vh] bg-white dark:bg-dark-card rounded-2xl shadow-2xl flex flex-col border border-primary/30 overflow-hidden animate-fadeIn"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary via-indigo-700 to-blue-700 text-white p-4 rounded-t-2xl flex justify-between items-center shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
                🩺
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold tracking-tight">MediBot Assistant</h3>
                  <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-400/30 text-emerald-100 border border-emerald-300/30">
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-blue-100">Voice & Text • English, தமிழ், हिन्दी</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Privacy Wipe / Clear Chat Button */}
              <button
                type="button"
                onClick={() => sessionManager.clearSession()}
                className="p-1.5 rounded-lg text-xs hover:bg-white/10 text-white/80 hover:text-white transition"
                title="Wipe conversation history (Privacy)"
                aria-label="Clear chat history"
              >
                🗑️
              </button>

              {/* Speaker Mute/Unmute Toggle */}
              <button
                type="button"
                onClick={() => {
                  if (audioVoiceEnabled) sessionManager.stopSpeaking();
                  setAudioVoiceEnabled(!audioVoiceEnabled);
                }}
                className={`p-1.5 rounded-lg text-xs font-bold transition ${
                  audioVoiceEnabled ? 'bg-white/20 text-white' : 'bg-rose-500/80 text-white'
                }`}
                title={audioVoiceEnabled ? 'Voice Responses: Enabled' : 'Voice Responses: Muted'}
                aria-label={audioVoiceEnabled ? 'Mute voice responses' : 'Unmute voice responses'}
              >
                {audioVoiceEnabled ? '🔊' : '🔇'}
              </button>

              <button
                type="button"
                onClick={() => {
                  sessionManager.stopListening();
                  sessionManager.stopSpeaking();
                  setIsOpen(false);
                }}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
                aria-label="Close MediBot"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Language Selector & Continuous Mode Toolbar */}
          <div className="px-3 py-2 bg-gray-100/90 dark:bg-dark-bg/90 border-b border-gray-200 dark:border-dark-border flex items-center justify-between text-[11px] font-bold">
            <div className="flex items-center gap-1">
              <span className="text-gray-500 dark:text-gray-400">Lang:</span>
              <div className="flex gap-1" role="group" aria-label="Language selection">
                {(
                  [
                    { code: 'mixed', label: 'Mixed' },
                    { code: 'en-IN', label: 'English' },
                    { code: 'ta-IN', label: 'தமிழ்' },
                    { code: 'hi-IN', label: 'हिन्दी' },
                  ] as const
                ).map(l => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => handleLanguageChange(l.code)}
                    aria-pressed={language === l.code}
                    className={`px-1.5 py-0.5 rounded transition ${
                      language === l.code
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Continuous Mode (Auto-Listen) Toggle */}
            <button
              type="button"
              onClick={handleToggleContinuous}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition ${
                continuousMode
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
              title="Continuous Conversation: Microphone automatically resumes listening after assistant finishes speaking"
            >
              <span>{continuousMode ? '🔄 Continuous ON' : '⏸️ Continuous OFF'}</span>
            </button>
          </div>

          {/* Ephemeral Audio & Privacy Consent Notice */}
          <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between text-[10px] text-emerald-800 dark:text-emerald-300">
            <span className="flex items-center gap-1 font-medium">
              <span>🔒</span>
              <span>Ephemeral Voice Session: Real-time processing • Zero audio retention.</span>
            </span>
          </div>

          {/* Unauthenticated Security Warning Banner */}
          {!currentUser && (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
              <span>🔒</span>
              <span>Please log in to your patient account to access AI voice commands.</span>
            </div>
          )}

          {/* Microphone Permission Warning Banner */}
          {isPermissionDenied && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2 animate-fadeIn">
              <span className="text-base flex-shrink-0">⚠️</span>
              <div className="flex-1">
                <strong>Microphone Blocked: </strong>
                <span>Please allow microphone permissions in your browser URL bar to speak. You can still type below.</span>
              </div>
            </div>
          )}

          {/* Auto-listening Waiting For User Pill */}
          {isWaitingForUser && (
            <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 border-b border-indigo-200 dark:border-indigo-900 text-xs flex items-center justify-between animate-fadeIn text-indigo-900 dark:text-indigo-200">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                <span>Auto-listening resuming... Speak your response</span>
              </span>
              <button
                onClick={() => sessionManager.pauseSession()}
                className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px]"
              >
                ⏸️ Pause
              </button>
            </div>
          )}

          {/* Session Paused Pill */}
          {isPaused && (
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-900 text-xs flex items-center justify-between animate-fadeIn text-amber-900 dark:text-amber-200">
              <span className="flex items-center gap-1.5 font-semibold">
                <span>⏸️ Voice Session Paused</span>
              </span>
              <button
                onClick={() => sessionManager.resumeSession(executionContext)}
                className="px-2.5 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px]"
              >
                ▶ Resume
              </button>
            </div>
          )}

          {/* Assistant Speaking Interruption Pill */}
          {isSpeaking && (
            <div className="px-4 py-2 bg-teal-50 dark:bg-teal-950/60 border-b border-teal-200 dark:border-teal-900 text-xs flex items-center justify-between animate-fadeIn text-teal-900 dark:text-teal-200">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                <span>MediBot is speaking...</span>
              </span>
              <button
                onClick={handleInterruptSpeech}
                className="px-2.5 py-0.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px]"
              >
                ⏹️ Stop / Interrupt
              </button>
            </div>
          )}

          {/* Unified Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50/50 dark:bg-dark-bg/50 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-1`}
              >
                <div
                  className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-primary to-blue-600 text-white rounded-br-none'
                      : msg.sender === 'system'
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200'
                      : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-dark-text border border-gray-200 dark:border-gray-700 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Tool Result Visual Card */}
                  {msg.toolCall && (
                    <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50 text-[11px] space-y-1.5">
                      <div className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                        <span>✓ Hospital Action:</span>
                        <span className="font-mono bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                          {msg.toolCall.name}
                        </span>
                      </div>

                      {msg.toolCall.result?.action && (
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              const action = msg.toolCall?.result?.action;
                              if (action?.targetPage) {
                                onNavigate(action.targetPage);
                              }
                              if (action?.targetTab) {
                                window.dispatchEvent(new CustomEvent('mediconnect_navigate_tab', { detail: { tab: action.targetTab } }));
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-[11px] transition shadow-xs mt-1"
                          >
                            <span>🔗</span>
                            <span>{msg.toolCall.result.action.label}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-gray-400 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {/* Live Streaming Speech Transcript */}
            {interimTranscript && (
              <div className="flex items-start gap-2 animate-pulse">
                <div className="p-3 rounded-2xl bg-primary/10 border border-primary/30 text-primary dark:text-blue-300 text-xs italic max-w-[85%]">
                  <span>🎙️ Hearing: </span>
                  <strong>"{interimTranscript}"</strong>
                </div>
              </div>
            )}

            {/* Processing State */}
            {isProcessing && (
              <div className="flex items-center gap-2 p-2 text-xs text-gray-500 italic">
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                <span>MediBot is thinking & verifying hospital records...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Unified Controls: Microphone, Waveform & Text Fallback */}
          <div className="p-3 bg-white dark:bg-dark-card border-t border-gray-200 dark:border-dark-border space-y-2">
            {/* Listening Waveform Bar */}
            {isListening && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="font-bold">Listening now... Speak in {getLanguagePill()}</span>
                </div>
                <button
                  onClick={handleToggleListening}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700"
                >
                  Done Speaking
                </button>
              </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleSendText} className="flex items-center gap-2">
              {/* Mic Button */}
              <button
                type="button"
                onClick={handleToggleListening}
                className={`p-2.5 rounded-full transition shadow-sm flex items-center justify-center flex-shrink-0 ${
                  isListening
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-gray-100 hover:bg-primary/10 text-primary dark:bg-gray-800 dark:text-blue-300'
                }`}
                title={isListening ? 'Stop listening' : 'Start voice input'}
              >
                <span className="text-lg">🎙️</span>
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={
                  language === 'ta-IN' || language === 'mixed'
                    ? 'Type or speak in English or Tanglish...'
                    : 'Type or speak your question...'
                }
                className="flex-1 border rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-transparent dark:text-dark-text dark:border-gray-600"
                disabled={isProcessing}
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={isProcessing || !textInput.trim()}
                className="bg-primary text-white rounded-xl px-3.5 py-2 hover:bg-primary/90 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-xs font-bold transition flex-shrink-0"
                aria-label="Send message"
              >
                Send
              </button>
            </form>

            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
              🔒 Safe Hospital Guidance. Not a substitute for physician diagnosis.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default HealthAssistant;
