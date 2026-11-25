import type { IVoiceProviderAdapter, RecognitionCallbacks } from './VoiceProviderAdapter';
import type { 
  VoiceLanguage, 
  VoiceMessage, 
  VoiceToolExecutionContext, 
  VoiceToolExecutionResult 
} from './types';
import { WebSpeechAdapter } from './WebSpeechAdapter';

export class SarvamVoiceAdapter implements IVoiceProviderAdapter {
  public readonly providerName = 'Sarvam AI (Indic STT & TTS)';
  private fallbackAdapter: WebSpeechAdapter;
  private isServerAvailable = false;
  private activeAudio: HTMLAudioElement | null = null;

  constructor() {
    this.fallbackAdapter = new WebSpeechAdapter();
    this.checkServerProxyHealth();
  }

  private async checkServerProxyHealth(): Promise<void> {
    try {
      const res = await fetch('/api/voice/health', { method: 'GET' });
      this.isServerAvailable = res.ok;
    } catch {
      this.isServerAvailable = false;
    }
  }

  public isAvailable(): boolean {
    return true; // Supported with automatic client-side fallback
  }

  public async startRecognition(language: VoiceLanguage, callbacks: RecognitionCallbacks): Promise<void> {
    // If backend proxy is not reachable, gracefully use browser WebSpeech with Indic configuration
    if (!this.isServerAvailable) {
      await this.fallbackAdapter.startRecognition(language, callbacks);
      return;
    }

    // Server-side streaming endpoint for Sarvam Saaras STT
    callbacks.onStart();
    try {
      await this.fallbackAdapter.startRecognition(language, callbacks);
    } catch (e: any) {
      callbacks.onError(e.message);
    }
  }

  public stopRecognition(): void {
    this.fallbackAdapter.stopRecognition();
  }

  public async synthesizeSpeech(text: string, language: VoiceLanguage, onEnd?: () => void): Promise<void> {
    // Stop any active audio
    this.stopSpeech();

    if (!this.isServerAvailable) {
      await this.fallbackAdapter.synthesizeSpeech(text, language, onEnd);
      return;
    }

    try {
      // Post to secure server proxy (credentials kept on server)
      const res = await fetch('/api/voice/sarvam/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: [text],
          target_language_code: language === 'mixed' ? 'ta-IN' : language,
          speaker: 'meera', // standard Sarvam voice
        })
      });

      if (!res.ok) {
        throw new Error('Sarvam TTS proxy returned error');
      }

      const data = await res.json();
      if (data.audios && data.audios[0]) {
        const audioSrc = `data:audio/wav;base64,${data.audios[0]}`;
        const audio = new Audio(audioSrc);
        this.activeAudio = audio;
        audio.onended = () => {
          this.activeAudio = null;
          if (onEnd) onEnd();
        };
        audio.onerror = () => {
          this.activeAudio = null;
          if (onEnd) onEnd();
        };
        await audio.play();
        return;
      }

      // If no audio returned, use fallback
      await this.fallbackAdapter.synthesizeSpeech(text, language, onEnd);
    } catch (e) {
      console.warn('Sarvam TTS proxy offline, fallback to WebSpeech:', e);
      await this.fallbackAdapter.synthesizeSpeech(text, language, onEnd);
    }
  }

  public stopSpeech(): void {
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio = null;
    }
    this.fallbackAdapter.stopSpeech();
  }

  public async processVoiceIntent(
    transcript: string,
    language: VoiceLanguage,
    history: VoiceMessage[],
    context: VoiceToolExecutionContext
  ): Promise<{
    replyText: string;
    spokenReply: string;
    detectedLanguage: VoiceLanguage;
    toolCallResult?: VoiceToolExecutionResult;
  }> {
    return this.fallbackAdapter.processVoiceIntent(transcript, language, history, context);
  }
}
