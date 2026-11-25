import type { VoiceLanguage } from './types';
import type { RecognitionCallbacks } from './VoiceProviderAdapter';

export class SpeechRecognitionService {
  private recognition: any = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isListeningActive = false;

  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  public async requestMicrophonePermission(): Promise<{ granted: boolean; error?: string }> {
    if (this.mediaStream && this.mediaStream.active) {
      return { granted: true };
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { granted: false, error: 'Microphone API not supported on this browser.' };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;
      this.setupAudioAnalyser(stream);
      return { granted: true };
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return { granted: false, error: 'Microphone permission denied. Please allow microphone access in your browser settings.' };
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        return { granted: false, error: 'No microphone hardware found on this device.' };
      }
      return { granted: false, error: err.message || 'Microphone access failed.' };
    }
  }

  private setupAudioAnalyser(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);
    } catch (e) {
      console.warn('AudioAnalyser setup skipped:', e);
    }
  }

  public getAudioLevel(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    return Math.min(100, Math.round((avg / 128) * 100));
  }

  public startRecognition(language: VoiceLanguage, callbacks: RecognitionCallbacks): void {
    if (!SpeechRecognitionService.isSupported()) {
      callbacks.onError('Web Speech Recognition is not supported in this browser. Use text input.');
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRec();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    // Set recognition language
    if (language === 'ta-IN') {
      this.recognition.lang = 'ta-IN';
    } else if (language === 'hi-IN') {
      this.recognition.lang = 'hi-IN';
    } else if (language === 'mixed') {
      // For Tanglish, browser recognition handles Indian English with colloquial context or Tamil
      this.recognition.lang = 'en-IN';
    } else {
      this.recognition.lang = 'en-IN';
    }

    this.recognition.onstart = () => {
      this.isListeningActive = true;
      callbacks.onStart();
    };

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      if (interim) {
        callbacks.onInterimResult(interim);
      }
      if (final) {
        callbacks.onFinalResult(final);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.isListeningActive = false;
      const err = event.error;
      if (err === 'not-allowed') {
        callbacks.onError('Microphone permission blocked. Please allow mic access in your address bar.');
      } else if (err === 'no-speech') {
        // Natural pause or silence: return to idle gracefully without error banner
        callbacks.onEnd();
      } else if (err === 'audio-capture') {
        callbacks.onError('No audio capture device found or microphone is in use by another application.');
      } else {
        callbacks.onError(`Recognition notice: ${err}`);
      }
    };

    this.recognition.onend = () => {
      this.isListeningActive = false;
      callbacks.onEnd();
    };

    try {
      this.recognition.start();
    } catch (e: any) {
      callbacks.onError('Could not start recognition: ' + e.message);
    }
  }

  public stopRecognition(): void {
    this.isListeningActive = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
  }

  public isListening(): boolean {
    return this.isListeningActive;
  }
}
