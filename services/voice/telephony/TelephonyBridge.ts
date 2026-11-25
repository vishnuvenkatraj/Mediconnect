/**
 * MediConnect Telephony Bridge
 * Connects inbound hospital phone calls (IVR / Voice Bot) to MediConnect VoiceToolDispatcher.
 * 
 * DESIGN PRINCIPLES:
 * 1. ZERO PAID TELEPHONY: No phone numbers purchased, no automated dialing.
 * 2. PATIENT AUTHENTICATION: Caller ID matching against verified patient records.
 * 3. GRACEFUL ESCALATION: Automatic transfer to Hospital Emergency / Reception (+91 44 2836 4000)
 *    upon acute trauma keywords or caller request.
 */

import type { InboundTelephonyCallPayload, TelephonyCallSession, TelephonyActionResponse } from './types';
import type { VoiceToolExecutionContext } from '../types';
import { VoiceToolDispatcher } from '../VoiceToolDispatcher';
import { MOCK_USERS } from '../../../constants';

export class TelephonyBridge {
  private static activeSessions: Map<string, TelephonyCallSession> = new Map();
  public static readonly HOSPITAL_HUMAN_HOTLINE = '+91 44 2836 4000';
  public static readonly EMERGENCY_HOTLINE = '+91 44 2836 4108';

  /**
   * Handle an incoming telephone webhook (e.g. from SIP Trunk or Twilio Voice)
   */
  public static async handleInboundCall(
    payload: InboundTelephonyCallPayload,
    context: VoiceToolExecutionContext
  ): Promise<TelephonyActionResponse> {
    let session = this.activeSessions.get(payload.callSid);

    // Initial Inbound Call Setup (Greeting & IVR Menu)
    if (!session) {
      const matchedPatient = this.resolveCallerToPatient(payload.fromPhoneNumber, context.users || MOCK_USERS);
      session = {
        sessionSid: payload.callSid,
        callerNumber: payload.fromPhoneNumber,
        patientId: matchedPatient?.id,
        patientName: matchedPatient?.name,
        language: payload.languagePreference || 'en-IN',
        turnCount: 0,
        history: [],
        createdAt: new Date().toISOString()
      };
      this.activeSessions.set(payload.callSid, session);

      const callerGreeting = session.patientName 
        ? `Hello ${session.patientName}, welcome to MediConnect Hospital automated phone assistant.`
        : `Welcome to MediConnect Hospital voice assistant.`;

      const prompt = `${callerGreeting} You can speak in English or Tamil. To book a doctor appointment say "Book appointment", to check medicine stock say "Medicine stock", for OPD queue status say "Token status", or press 0 to speak with hospital reception.`;

      return {
        action: 'gather',
        spokenPrompt: prompt,
        language: session.language,
        allowBargeIn: true,
        timeoutSeconds: 5,
        twimlRepresentation: `<Response><Gather input="speech dtmf" timeout="5" language="${session.language}"><Say>${prompt}</Say></Gather></Response>`
      };
    }

    session.turnCount++;

    // 1. Check DTMF Inputs
    if (payload.digits === '0') {
      return this.transferToHuman(session, 'Caller pressed 0 for human assistance.');
    }

    // 2. Process Transcribed Caller Speech
    const spokenText = (payload.speechResult || '').trim();
    if (!spokenText) {
      return {
        action: 'gather',
        spokenPrompt: 'I did not catch that. Please state what you need, such as book appointment, check token, or speak to reception.',
        language: session.language,
        allowBargeIn: true,
        timeoutSeconds: 5
      };
    }

    session.history.push({
      sender: 'caller',
      text: spokenText,
      timestamp: new Date().toISOString()
    });

    const q = spokenText.toLowerCase();

    // 3. Emergency Interception -> Direct Transfer to ER Trauma Team
    if (q.includes('emergency') || q.includes('heart attack') || q.includes('chest pain') || q.includes('bleeding')) {
      return {
        action: 'transfer',
        spokenPrompt: 'Connecting you immediately to the 24/7 Emergency Trauma Department.',
        language: session.language,
        transferDestination: this.EMERGENCY_HOTLINE,
        allowBargeIn: false,
        timeoutSeconds: 0,
        twimlRepresentation: `<Response><Say>Connecting you immediately to emergency trauma department.</Say><Dial>${this.EMERGENCY_HOTLINE}</Dial></Response>`
      };
    }

    // 4. Human Reception Transfer
    if (q.includes('human') || q.includes('reception') || q.includes('helpdesk') || q.includes('operator')) {
      return this.transferToHuman(session, 'Connecting you to hospital reception desk.');
    }

    // 5. Connect to MediConnect Tool Engine
    let toolName = 'check_doctor_availability';
    let params: Record<string, any> = {};

    if (q.includes('book') || q.includes('appointment')) {
      toolName = 'check_doctor_availability';
      params = { specialtyOrName: q.includes('cardio') ? 'Cardiology' : 'General Medicine' };
    } else if (q.includes('token') || q.includes('queue') || q.includes('wait')) {
      toolName = 'get_queue_token';
    } else if (q.includes('medicine') || q.includes('pharmacy') || q.includes('stock')) {
      toolName = 'check_medicine_stock';
      params = { medicineName: q.replace(/(medicine|stock|pharmacy|check)/gi, '').trim() || 'Paracetamol' };
    }

    const toolResult = await VoiceToolDispatcher.executeTool(toolName, params, {
      ...context,
      currentUser: session.patientId ? { id: session.patientId, name: session.patientName || 'Caller', email: 'phone@hms.com', role: 'PATIENT', password: '' } : null
    });

    session.history.push({
      sender: 'assistant',
      text: toolResult.spokenFeedback,
      timestamp: new Date().toISOString()
    });

    const followUp = `${toolResult.spokenFeedback}. How else can I assist you on this call?`;

    return {
      action: 'gather',
      spokenPrompt: followUp,
      language: session.language,
      allowBargeIn: true,
      timeoutSeconds: 5,
      twimlRepresentation: `<Response><Gather input="speech dtmf" timeout="5" language="${session.language}"><Say>${followUp}</Say></Gather></Response>`
    };
  }

  /**
   * Resolve incoming Caller Phone Number to an existing Patient Profile
   */
  private static resolveCallerToPatient(fromNumber: string, users: any[]): any | null {
    if (!fromNumber) return null;
    const cleanNumber = fromNumber.replace(/\D/g, '').slice(-10);
    return users.find(u => {
      const uPhone = (u.phone || '').replace(/\D/g, '').slice(-10);
      return uPhone && uPhone === cleanNumber;
    }) || null;
  }

  private static transferToHuman(session: TelephonyCallSession, reason: string): TelephonyActionResponse {
    return {
      action: 'transfer',
      spokenPrompt: `${reason} Please hold while your call is transferred to a hospital coordinator.`,
      language: session.language,
      transferDestination: this.HOSPITAL_HUMAN_HOTLINE,
      allowBargeIn: false,
      timeoutSeconds: 0,
      twimlRepresentation: `<Response><Say>Please hold while your call is transferred to a hospital coordinator.</Say><Dial>${this.HOSPITAL_HUMAN_HOTLINE}</Dial></Response>`
    };
  }

  public static endCallSession(callSid: string): void {
    this.activeSessions.delete(callSid);
  }
}
