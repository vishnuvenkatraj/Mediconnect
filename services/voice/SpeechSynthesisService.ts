import type { VoiceLanguage } from './types';

export class SpeechSynthesisService {
  private isSpeakingActive = false;

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  public stop(): void {
    if (SpeechSynthesisService.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.warn('Speech cancellation error:', e);
      }
      this.isSpeakingActive = false;
    }
  }

  public isSpeaking(): boolean {
    return this.isSpeakingActive;
  }

  /**
   * Strips markdown formatting, links, bullets, and emojis,
   * expands doctor titles, and spells dates phonetically so speech synthesis reads naturally.
   */
  private cleanTextForSpeech(text: string, language: VoiceLanguage): string {
    let cleaned = text
      .replace(/[*#_~`>•–—]/g, '') // remove markdown symbols & bullets
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '') // emojis
      .replace(/🚨|⚠️|💊|🧪|🩺|🗺️|♿|📄|🧏|🤝|🔔|✅|🚫|📅|📋|👤|📊|ℹ️/g, ''); // special hospital icons

    // Expand Doctor titles for natural pronunciation
    if (language === 'ta-IN') {
      cleaned = cleaned.replace(/\bDr\.\s*/gi, 'மருத்துவர் ');
    } else {
      cleaned = cleaned.replace(/\bDr\.\s*/gi, 'Doctor ');
    }

    // Expand ISO dates e.g. 2026-11-26 to natural spoken format
    cleaned = cleaned.replace(/(\d{4})-(\d{2})-(\d{2})/g, (_match, year, month, day) => {
      const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthNamesTa = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
      const mIdx = parseInt(month, 10) - 1;
      const dNum = parseInt(day, 10);
      if (language === 'ta-IN') {
        return `${year} ${monthNamesTa[mIdx] || month} ${dNum}`;
      }
      return `${monthNamesEn[mIdx] || month} ${dNum}, ${year}`;
    });

    return cleaned.replace(/\s+/g, ' ').trim();
  }

  public speak(
    text: string,
    language: VoiceLanguage,
    onEnd?: () => void,
    rate = 0.95,
    pitch = 1.0
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!SpeechSynthesisService.isSupported()) {
        if (onEnd) onEnd();
        resolve();
        return;
      }

      this.stop(); // cancel any active utterance

      const cleanText = this.cleanTextForSpeech(text, language);
      if (!cleanText) {
        if (onEnd) onEnd();
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = rate;
      utterance.pitch = pitch;

      // Select language code and matching native voice
      const voices = window.speechSynthesis.getVoices();
      let matchedVoice: SpeechSynthesisVoice | null = null;

      if (language === 'ta-IN') {
        utterance.lang = 'ta-IN';
        matchedVoice = voices.find(v => v.lang === 'ta-IN' || v.lang.startsWith('ta')) ||
                       voices.find(v => v.name.toLowerCase().includes('tamil') || v.name.toLowerCase().includes('valluvar')) ||
                       voices.find(v => v.lang.includes('IN')) ||
                       null;
      } else if (language === 'hi-IN') {
        utterance.lang = 'hi-IN';
        matchedVoice = voices.find(v => v.lang === 'hi-IN' || v.lang.startsWith('hi')) ||
                       voices.find(v => v.name.toLowerCase().includes('hindi') || v.name.toLowerCase().includes('kalpana') || v.name.toLowerCase().includes('hemant')) ||
                       voices.find(v => v.lang.includes('IN')) ||
                       null;
      } else if (language === 'mixed') {
        // Tanglish: Appropriate Tamil voice where supported, with Indian English fallback
        matchedVoice = voices.find(v => v.lang === 'ta-IN' || v.lang.startsWith('ta')) ||
                       voices.find(v => v.name.toLowerCase().includes('tamil') || v.name.toLowerCase().includes('valluvar')) ||
                       voices.find(v => v.lang === 'en-IN') ||
                       voices.find(v => v.lang.includes('IN')) ||
                       null;
        utterance.lang = matchedVoice?.lang || 'en-IN';
      } else {
        utterance.lang = 'en-IN';
        matchedVoice = voices.find(v => v.lang === 'en-IN') ||
                       voices.find(v => v.lang.startsWith('en')) ||
                       null;
      }

      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onstart = () => {
        this.isSpeakingActive = true;
      };

      utterance.onend = () => {
        this.isSpeakingActive = false;
        if (onEnd) onEnd();
        resolve();
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        this.isSpeakingActive = false;
        if (onEnd) onEnd();
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }
}
