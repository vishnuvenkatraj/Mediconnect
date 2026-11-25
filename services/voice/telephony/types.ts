/**
 * MediConnect Telephony Architecture Specification & Types
 * Designed for future SIP / Twilio Voice / Exotel / Sarvam AI Inbound Telephone Integration
 * 
 * NOTE: Architectural preparation only.
 * No real phone numbers are purchased and no active telephony charges occur.
 */

import type { VoiceLanguage } from '../types';

export interface InboundTelephonyCallPayload {
  callSid: string;
  fromPhoneNumber: string;      // Caller ID in E.164 format (e.g., +919876543210)
  toPhoneNumber: string;        // MediConnect Hospital Reception line
  callStatus: 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed';
  speechResult?: string;        // Transcribed speech from telephony STT
  digits?: string;              // DTMF keypad input (e.g., "1", "2")
  languagePreference?: VoiceLanguage;
}

export interface TelephonyCallSession {
  sessionSid: string;
  callerNumber: string;
  patientId?: string;
  patientName?: string;
  language: VoiceLanguage;
  turnCount: number;
  activeIntent?: string;
  history: Array<{
    sender: 'caller' | 'assistant';
    text: string;
    timestamp: string;
  }>;
  createdAt: string;
}

export type TelephonyActionType = 'gather' | 'say' | 'transfer' | 'hangup';

export interface TelephonyActionResponse {
  action: TelephonyActionType;
  spokenPrompt: string;
  language: VoiceLanguage;
  transferDestination?: string; // e.g. Hospital Reception: +91 44 2836 4000
  allowBargeIn: boolean;
  timeoutSeconds: number;
  twimlRepresentation?: string;  // Compatible with standard TwiML/XML
  sarvamPayload?: Record<string, any>; // Compatible with Sarvam telephony
}
