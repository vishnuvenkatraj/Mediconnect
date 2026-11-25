import React, { useState, useEffect, useRef } from 'react';
import type { 
  VoiceSessionState, 
  VoiceLanguage, 
  VoiceMessage, 
  VoiceToolExecutionContext 
} from '../../services/voice/types';
import type { VoiceSessionManager } from '../../services/voice/VoiceSessionManager';

interface VoiceConversationPanelProps {
  sessionManager: VoiceSessionManager;
  isOpen: boolean;
  onClose: () => void;
  context: VoiceToolExecutionContext;
}

export const VoiceConversationPanel: React.FC<VoiceConversationPanelProps> = ({
  sessionManager,
  isOpen,
  onClose,
  context,
}) => {
  const [sessionState, setSessionState] = useState<VoiceSessionState>(sessionManager.getState());
  const [messages, setMessages] = useState<VoiceMessage[]>(sessionManager.getMessages());
  const [interimTranscript, setInterimTranscript] = useState<string>(sessionManager.getInterimTranscript());
  const [language, setLanguageState] = useState<VoiceLanguage>(sessionManager.getLanguage());
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  if (!isOpen) return null;

  const handleLanguageChange = (newLang: VoiceLanguage) => {
    setLanguageState(newLang);
    sessionManager.setLanguage(newLang);
  };

  const handleToggleListening = () => {
    if (sessionState === 'listening' || sessionState === 'requesting_permission') {
      sessionManager.stopListening();
    } else {
      sessionManager.startListening(context);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const toSend = textInput.trim();
    setTextInput('');
    sessionManager.submitTextInput(toSend, context);
  };

  const isListening = sessionState === 'listening';
  const isSpeaking = sessionState === 'speaking';
  const isProcessing = sessionState === 'processing';
  const isPermissionDenied = sessionState === 'permission_denied';

  return (
    <div className="fixed bottom-24 left-6 z-50 w-[95vw] sm:w-[420px] max-w-[460px] h-[580px] max-h-[85vh] bg-white/95 dark:bg-dark-card/95 backdrop-blur-xl border border-primary/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-primary via-indigo-700 to-blue-700 text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
            🎙️
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm tracking-tight">MediConnect Voice AI</h3>
              <span className="text-[9px] uppercase font-black bg-white/20 px-2 py-0.5 rounded-full">
                Indic Live
              </span>
            </div>
            <p className="text-[11px] text-blue-100">Tamil • English • Hindi • Tanglish</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isSpeaking && (
            <button
              onClick={() => sessionManager.stopSpeaking()}
              className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-lg"
              title="Stop voice playback"
            >
              ⏹️ Mute
            </button>
          )}
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
            aria-label="Close voice panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Language Selector Bar */}
      <div className="px-3 py-2 bg-gray-100/80 dark:bg-dark-bg/80 border-b border-gray-200 dark:border-dark-border flex items-center justify-between gap-1 overflow-x-auto text-[11px] font-bold">
        <span className="text-gray-500 dark:text-gray-400 pl-1">Language:</span>
        <div className="flex gap-1">
          {(
            [
              { code: 'mixed', label: 'Tanglish / Mixed' },
              { code: 'en-IN', label: 'English' },
              { code: 'ta-IN', label: 'தமிழ்' },
              { code: 'hi-IN', label: 'हिन्दी' },
            ] as const
          ).map(l => (
            <button
              key={l.code}
              onClick={() => handleLanguageChange(l.code)}
              className={`px-2 py-1 rounded-lg transition ${
                language === l.code
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Permission Denied Alert Banner */}
      {isPermissionDenied && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2 animate-fadeIn">
          <span className="text-base flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <strong className="font-bold">Microphone Access Blocked: </strong>
            <span>Please enable microphone permission in your browser URL bar. You can still use the text input below.</span>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gradient-to-b from-gray-50/50 to-white dark:from-dark-bg/50 dark:to-dark-card/50">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-1`}
          >
            <div
              className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-primary to-blue-600 text-white rounded-br-none'
                  : msg.sender === 'system'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900/40'
                  : 'bg-white dark:bg-gray-800/90 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>

              {/* Tool Execution Card Result */}
              {msg.toolCall && (
                <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50 text-[11px]">
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                    <span>✓ Action Performed:</span>
                    <span className="font-mono bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                      {msg.toolCall.name}
                    </span>
                  </span>
                </div>
              )}
            </div>
            <span className="text-[9px] text-gray-400 px-1">{msg.timestamp}</span>
          </div>
        ))}

        {/* Live Interim Streaming Transcript Bubble */}
        {interimTranscript && (
          <div className="flex items-start gap-2 animate-pulse">
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/30 text-primary dark:text-blue-300 text-xs italic max-w-[85%]">
              <span>🎙️ Hearing: </span>
              <strong>"{interimTranscript}"</strong>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 p-2 text-xs text-gray-500 italic">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
            <span>Understanding intent & executing tools...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Interactive Microphone & Waveform Status Area */}
      <div className="p-3 bg-gray-50 dark:bg-dark-bg border-t border-gray-200 dark:border-dark-border flex flex-col items-center gap-2">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleListening}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                  : 'bg-primary hover:bg-primary/90 text-white'
              }`}
            >
              <span>{isListening ? '⏹️ Stop Listening' : '🎙️ Tap to Speak'}</span>
            </button>
            {isSpeaking && (
              <span className="text-xs text-teal-600 dark:text-teal-400 font-semibold animate-pulse">
                🔊 Speaking...
              </span>
            )}
          </div>

          <button
            onClick={() => sessionManager.clearSession()}
            className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            Clear Chat
          </button>
        </div>

        {/* Text Input Fallback Bar */}
        <form onSubmit={handleTextSubmit} className="flex items-center gap-2 w-full pt-1">
          <input
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder={
              language === 'ta-IN' || language === 'mixed'
                ? 'Type in English or Tanglish (e.g. Doctor appointment book pannu)...'
                : 'Or type your question here...'
            }
            className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={!textInput.trim() || isProcessing}
            className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl transition disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default VoiceConversationPanel;
