import type { 
  VoiceLanguage, 
  VoiceMessage, 
  VoiceSessionState, 
  VoiceToolExecutionContext, 
  VoiceProviderConfig 
} from './types';
import type { IVoiceProviderAdapter } from './VoiceProviderAdapter';
import { WebSpeechAdapter } from './WebSpeechAdapter';
import { SarvamVoiceAdapter } from './SarvamVoiceAdapter';

export type SessionStateListener = (state: VoiceSessionState) => void;
export type MessageListener = (messages: VoiceMessage[]) => void;
export type TranscriptListener = (interimTranscript: string) => void;
export type LanguageListener = (language: VoiceLanguage) => void;

export class VoiceSessionManager {
  private state: VoiceSessionState = 'idle';
  private adapter: IVoiceProviderAdapter;
  private language: VoiceLanguage = 'mixed'; // default Tanglish / Multilingual
  private continuousMode: boolean = true;
  private isPaused: boolean = false;
  private autoListenTimer: any = null;
  private currentContext: VoiceToolExecutionContext | null = null;
  private messages: VoiceMessage[] = [];
  private interimTranscript = '';
  private errorMessage = '';

  private stateListeners: Set<SessionStateListener> = new Set();
  private messageListeners: Set<MessageListener> = new Set();
  private transcriptListeners: Set<TranscriptListener> = new Set();
  private languageListeners: Set<LanguageListener> = new Set();

  constructor(config?: Partial<VoiceProviderConfig>) {
    const selectedProvider = config?.provider || 'auto';
    this.language = config?.language || 'mixed';
    this.continuousMode = config?.continuousMode !== false;

    if (selectedProvider === 'sarvam') {
      this.adapter = new SarvamVoiceAdapter();
    } else {
      this.adapter = new WebSpeechAdapter();
    }

    // Initial greeting (Strictly allowed services only: Appointments, Patient Assistance, Doctor Info)
    this.addMessage({
      id: `msg_welcome_${Date.now()}`,
      sender: 'assistant',
      text: "Vanakkam! I'm your MediConnect AI Voice Assistant. Speak in English, தமிழ், हिन्दी, or Tanglish to book doctor appointments, request patient assistance, or ask about our doctors.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }

  public getState(): VoiceSessionState {
    return this.state;
  }

  public getLanguage(): VoiceLanguage {
    return this.language;
  }

  public setLanguage(lang: VoiceLanguage): void {
    this.language = lang;
    this.languageListeners.forEach(fn => fn(this.language));
  }

  public subscribeLanguage(listener: LanguageListener): () => void {
    this.languageListeners.add(listener);
    listener(this.language);
    return () => this.languageListeners.delete(listener);
  }

  public isContinuousMode(): boolean {
    return this.continuousMode;
  }

  public setContinuousMode(enabled: boolean): void {
    this.continuousMode = enabled;
    if (!enabled && this.autoListenTimer) {
      clearTimeout(this.autoListenTimer);
      this.autoListenTimer = null;
    }
  }

  public isSessionPaused(): boolean {
    return this.isPaused;
  }

  public pauseSession(): void {
    this.isPaused = true;
    if (this.autoListenTimer) {
      clearTimeout(this.autoListenTimer);
      this.autoListenTimer = null;
    }
    this.stopListening();
    this.stopSpeaking();
    this.setState('paused');
  }

  public resumeSession(context?: VoiceToolExecutionContext): void {
    this.isPaused = false;
    this.setState('idle');
    const ctx = context || this.currentContext;
    if (ctx && this.continuousMode && ctx.currentUser) {
      this.startListening(ctx).catch(e => console.warn('Resume listening failed:', e));
    }
  }

  public getMessages(): VoiceMessage[] {
    return [...this.messages];
  }

  public getInterimTranscript(): string {
    return this.interimTranscript;
  }

  public getErrorMessage(): string {
    return this.errorMessage;
  }

  public subscribeState(listener: SessionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  public subscribeMessages(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    listener(this.messages);
    return () => this.messageListeners.delete(listener);
  }

  public subscribeTranscript(listener: TranscriptListener): () => void {
    this.transcriptListeners.add(listener);
    listener(this.interimTranscript);
    return () => this.transcriptListeners.delete(listener);
  }

  private setState(newState: VoiceSessionState): void {
    this.state = newState;
    this.stateListeners.forEach(fn => fn(this.state));
  }

  private addMessage(msg: VoiceMessage): void {
    this.messages = [...this.messages, msg];
    this.messageListeners.forEach(fn => fn(this.messages));
  }

  private setInterim(text: string): void {
    this.interimTranscript = text;
    this.transcriptListeners.forEach(fn => fn(this.interimTranscript));
  }

  public async startListening(context: VoiceToolExecutionContext): Promise<void> {
    if (this.state === 'listening' || this.state === 'processing') return;

    this.currentContext = context;
    if (this.autoListenTimer) {
      clearTimeout(this.autoListenTimer);
      this.autoListenTimer = null;
    }
    this.stopSpeaking();
    this.errorMessage = '';
    this.setInterim('');
    this.setState('requesting_permission');

    try {
      await this.adapter.startRecognition(this.language, {
        onStart: () => {
          this.setState('listening');
        },
        onInterimResult: (interim) => {
          this.setInterim(interim);
        },
        onFinalResult: async (finalText) => {
          this.setInterim('');
          if (finalText.trim()) {
            await this.handleUserUtterance(finalText.trim(), context);
          }
        },
        onError: (err) => {
          this.errorMessage = err;
          if (err.toLowerCase().includes('denied') || err.toLowerCase().includes('blocked')) {
            this.setState('permission_denied');
          } else {
            this.setState('error');
          }
        },
        onEnd: () => {
          if (this.state === 'listening') {
            this.setState('idle');
          }
        }
      });
    } catch (e: any) {
      this.errorMessage = e.message || 'Failed to start voice recognition.';
      this.setState('error');
    }
  }

  public stopListening(): void {
    if (this.autoListenTimer) {
      clearTimeout(this.autoListenTimer);
      this.autoListenTimer = null;
    }
    if (this.state === 'listening' || this.state === 'requesting_permission') {
      this.adapter.stopRecognition();
      this.setState('idle');
      this.setInterim('');
    }
  }

  public stopSpeaking(): void {
    this.adapter.stopSpeech();
    if (this.state === 'speaking') {
      this.setState('idle');
    }
  }

  /**
   * Text-input fallback for typed interactions
   */
  public async submitTextInput(text: string, context: VoiceToolExecutionContext): Promise<void> {
    if (!text.trim() || this.state === 'processing') return;
    this.currentContext = context;
    if (this.autoListenTimer) {
      clearTimeout(this.autoListenTimer);
      this.autoListenTimer = null;
    }
    await this.handleUserUtterance(text.trim(), context);
  }

  private async handleUserUtterance(
    utterance: string,
    context: VoiceToolExecutionContext
  ): Promise<void> {
    // 1. Add User Message
    const userMsg: VoiceMessage = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      text: utterance,
      language: this.language,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.addMessage(userMsg);
    this.setState('processing');

    try {
      // 2. Process Intent & Tool Calling through Adapter
      const result = await this.adapter.processVoiceIntent(
        utterance,
        this.language,
        this.messages,
        context
      );

      // Preserve detected language throughout the ongoing conversation
      this.language = result.detectedLanguage;
      this.languageListeners.forEach(fn => fn(this.language));

      // 3. Add Assistant Message
      const assistantMsg: VoiceMessage = {
        id: `msg_a_${Date.now()}`,
        sender: 'assistant',
        text: result.replyText,
        language: result.detectedLanguage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCall: result.toolCallResult ? {
          name: result.toolCallResult.toolName,
          params: {},
          result: result.toolCallResult.data,
          status: result.toolCallResult.success ? 'success' : 'failed'
        } : undefined
      };
      this.addMessage(assistantMsg);

      // 4. Speak response back
      this.setState('speaking');
      await this.adapter.synthesizeSpeech(
        result.spokenReply,
        result.detectedLanguage,
        () => {
          if (
            this.continuousMode && 
            !this.isPaused && 
            this.state !== 'paused' && 
            context.currentUser
          ) {
            this.setState('waiting_for_user');
            if (this.autoListenTimer) {
              clearTimeout(this.autoListenTimer);
            }
            this.autoListenTimer = setTimeout(() => {
              if (
                this.continuousMode && 
                !this.isPaused && 
                (this.state === 'waiting_for_user' || this.state === 'idle')
              ) {
                this.startListening(context).catch(e => console.warn('Auto-listening restart error:', e));
              }
            }, 600); // 600ms acoustic echo prevention
          } else {
            this.setState('idle');
          }
        }
      );
    } catch (err: any) {
      console.error('Voice processing error:', err);
      this.errorMessage = 'Network or provider error processing voice command.';
      this.setState('error');
      this.addMessage({
        id: `msg_err_${Date.now()}`,
        sender: 'system',
        text: 'Sorry, I encountered a temporary connection issue. You can try speaking again or use text input.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  }

  public clearSession(): void {
    if (this.autoListenTimer) {
      clearTimeout(this.autoListenTimer);
      this.autoListenTimer = null;
    }
    this.isPaused = false;
    this.stopListening();
    this.stopSpeaking();
    this.errorMessage = '';
    this.setInterim('');
    this.messages = [{
      id: `msg_welcome_${Date.now()}`,
      sender: 'assistant',
      text: "Vanakkam! I'm your MediConnect AI Voice Assistant. Speak in English, தமிழ், हिन्दी, or Tanglish to book doctor appointments, request patient assistance, or ask about our doctors.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }];
    this.messageListeners.forEach(fn => fn(this.messages));
    this.setState('idle');
  }
}
