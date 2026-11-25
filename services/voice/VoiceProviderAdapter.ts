import type { VoiceLanguage, VoiceMessage, VoiceToolExecutionContext, VoiceToolExecutionResult } from './types';

export interface RecognitionCallbacks {
  onStart: () => void;
  onInterimResult: (transcript: string) => void;
  onFinalResult: (transcript: string) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export interface IVoiceProviderAdapter {
  readonly providerName: string;
  isAvailable(): boolean;
  
  // STT
  startRecognition(language: VoiceLanguage, callbacks: RecognitionCallbacks): Promise<void>;
  stopRecognition(): void;
  
  // TTS
  synthesizeSpeech(text: string, language: VoiceLanguage, onEnd?: () => void): Promise<void>;
  stopSpeech(): void;
  
  // LLM + Tool Calling
  processVoiceIntent(
    transcript: string,
    language: VoiceLanguage,
    history: VoiceMessage[],
    context: VoiceToolExecutionContext
  ): Promise<{
    replyText: string;
    spokenReply: string;
    detectedLanguage: VoiceLanguage;
    toolCallResult?: VoiceToolExecutionResult;
  }>;
}
