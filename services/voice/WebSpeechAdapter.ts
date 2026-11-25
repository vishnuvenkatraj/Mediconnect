import type { IVoiceProviderAdapter, RecognitionCallbacks } from './VoiceProviderAdapter';
import type { 
  VoiceLanguage, 
  VoiceMessage, 
  VoiceToolExecutionContext, 
  VoiceToolExecutionResult 
} from './types';
import { SpeechRecognitionService } from './SpeechRecognitionService';
import { SpeechSynthesisService } from './SpeechSynthesisService';
import { VoiceToolDispatcher } from './VoiceToolDispatcher';
import { MOCK_DOCTORS } from '../../constants';
import { getChatbotResponse } from '../geminiService';
import {
  findDoctorByQuery,
  extractSpecialty,
  getAllDepartments,
  parseDateFromText,
  detectMonthOnly,
  parseTimeFromText,
  type MonthPreference
} from './doctorDateParser';
import { matchSymptomToSpecialist } from './symptomSpecialistService';

interface ProgressiveBookingState {
  inProgress: boolean;
  step: 'awaiting_booking_consent' | 'awaiting_spec' | 'awaiting_date' | 'awaiting_slot' | 'awaiting_confirmation' | 'idle';
  doctorSpec?: string;
  doctorName?: string;
  doctorId?: string;
  date?: string;
  availableSlots?: string[];
  time?: string;
  monthOnlyPreference?: MonthPreference;
  symptomTriggered?: boolean;
}

interface CancellationState {
  inProgress: boolean;
  appointmentId?: string;
  doctorName?: string;
  date?: string;
  time?: string;
}

interface RescheduleState {
  inProgress: boolean;
  step: 'awaiting_date' | 'awaiting_slot' | 'awaiting_confirmation' | 'idle';
  appointmentId?: string;
  doctorName?: string;
  date?: string;
  availableSlots?: string[];
  time?: string;
}

export class WebSpeechAdapter implements IVoiceProviderAdapter {
  public readonly providerName = 'WebSpeech + Intelligent Multi-Turn Agent';
  private recognitionService: SpeechRecognitionService;
  private synthesisService: SpeechSynthesisService;
  private bookingState: ProgressiveBookingState = { inProgress: false, step: 'idle' };
  private cancellationState: CancellationState = { inProgress: false };
  private rescheduleState: RescheduleState = { inProgress: false, step: 'idle' };
  private userIntroducedName: string | null = null;

  constructor() {
    this.recognitionService = new SpeechRecognitionService();
    this.synthesisService = new SpeechSynthesisService();
  }

  public isAvailable(): boolean {
    return SpeechRecognitionService.isSupported() && SpeechSynthesisService.isSupported();
  }

  public async startRecognition(language: VoiceLanguage, callbacks: RecognitionCallbacks): Promise<void> {
    const perm = await this.recognitionService.requestMicrophonePermission();
    if (!perm.granted) {
      callbacks.onError(perm.error || 'Microphone permission denied.');
      return;
    }
    this.recognitionService.startRecognition(language, callbacks);
  }

  public stopRecognition(): void {
    this.recognitionService.stopRecognition();
  }

  public async synthesizeSpeech(text: string, language: VoiceLanguage, onEnd?: () => void): Promise<void> {
    await this.synthesisService.speak(text, language, onEnd);
  }

  public stopSpeech(): void {
    this.synthesisService.stop();
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
    const detectedLang = this.detectLanguage(transcript, language);
    this.activeLanguage = detectedLang;
    const q = transcript.toLowerCase().trim();

    // =============================================================
    // 0. EXPLICIT LANGUAGE SWITCHING COMMANDS
    // =============================================================
    const isLanguageSwitchRequest =
      q.includes('speak in ') || q.includes('switch to ') || q.includes('talk in ') ||
      q.includes('தமிழில் பேசு') || q.includes('தமிழ் பேசு') || q.includes('tamil-la pesu') ||
      q.includes('tamil-la pesunga') || q.includes('தமிழ் பேசவும்') ||
      q.includes('हिंदी में बोलो') || q.includes('hindi me bolo') || q.includes('hindi me baat') ||
      q.includes('tanglish-la pesu') || q.includes('tanglish-la pesunga');

    if (isLanguageSwitchRequest) {
      let switchReply = "Certainly! I will now speak in English. How can I assist you today?";
      if (detectedLang === 'ta-IN') {
        switchReply = "சரி! நான் இனி தமிழில் உரையாடுகிறேன். உங்களுக்கு எவ்வாறு உதவ வேண்டும்?";
      } else if (detectedLang === 'mixed') {
        switchReply = "Sure! Ippo naan Tanglish-la pesren. Ungalukku hospital-la enna help venum?";
      } else if (detectedLang === 'hi-IN') {
        switchReply = "ज़रूर! मैं अब हिन्दी में बातचीत करूँगा। मैं आपकी क्या मदद करूँ?";
      }
      return {
        replyText: switchReply,
        spokenReply: switchReply,
        detectedLanguage: detectedLang
      };
    }

    // =============================================================
    // 1. MEDICAL SAFETY GUARDRAILS (Highest Priority Interception)
    // =============================================================

    // Emergency Detection: Immediate ER Protocol
    const isEmergency = 
      q.includes('emergency') || q.includes('heart attack') || q.includes('crushing chest pain') ||
      q.includes('difficulty breathing') || q.includes('cannot breathe') || q.includes('stroke') ||
      q.includes('unconscious') || q.includes('bleeding heavily') || q.includes('suicide') ||
      q.includes('மாரடைப்பு') || q.includes('மூச்சு திணறல்') || q.includes('அவசரம்');

    if (isEmergency) {
      const emergencyResult = await VoiceToolDispatcher.executeTool('get_emergency_info', {}, context);
      const spoken = (detectedLang === 'ta-IN' || detectedLang === 'mixed')
        ? "அவசர உதவிக்கு உடனடியாக Ground Floor Room ER-101 அல்லது 123 456 7890 என்ற எண்ணை தொடர்பு கொள்ளவும்."
        : emergencyResult.spokenFeedback;

      return {
        replyText: `🚨 **EMERGENCY ASSISTANCE ALERT**\n\nIf you or someone nearby is experiencing acute chest pain, shortness of breath, or heavy trauma, please seek immediate emergency care:\n• **Location:** Ground Floor Room ER-101 (Ambulance Bay Entrance)\n• **Direct Hotline:** (123) 456-7890\n• **Ambulance Dispatch:** x911\n\nDo not wait for an outpatient appointment.`,
        spokenReply: spoken,
        detectedLanguage: detectedLang,
        toolCallResult: emergencyResult
      };
    }

    // Refusal of Medical Diagnosis (Safety Guardrail)
    if (
      q.includes('diagnose me') || q.includes('do i have cancer') || q.includes('what disease do i have') ||
      q.includes('what is wrong with me') || q.includes('ennaku enna disease') || q.includes('kya bimari hai')
    ) {
      const refusal = (detectedLang === 'ta-IN' || detectedLang === 'mixed')
        ? "நான் ஒரு AI உதவியாளர். என்னால் மருத்துவ நோய் கணிப்பு (diagnosis) செய்ய முடியாது. உங்கள் பாதுகாப்பிற்காக எங்கள் மருத்துவரை அணுகவும். நான் உங்களுக்கு appointment book செய்யவா?"
        : detectedLang === 'hi-IN'
        ? "मैं एक AI सहायक हूँ और चिकित्सकीय निदान (diagnosis) नहीं कर सकता। कृपया हमारे योग्य डॉक्टर से परामर्श लें।"
        : "I am an AI assistant and strictly cannot provide a clinical diagnosis. For your safety, only a qualified physician can evaluate your symptoms. Would you like me to book a consultation with our specialist?";
      return {
        replyText: `🛡️ **Medical Safety Disclaimer**\n\n${refusal}`,
        spokenReply: refusal,
        detectedLanguage: detectedLang
      };
    }

    // Refusal of Medication Prescriptions (Safety Guardrail)
    if (
      q.includes('prescribe me') || q.includes('what tablet should i take') || q.includes('what medicine should i take') ||
      q.includes('how much dose should i take') || q.includes('marunthu sollu') || q.includes('konsi dawa lu')
    ) {
      const refusal = (detectedLang === 'ta-IN' || detectedLang === 'mixed')
        ? "மருந்துகளை பரிந்துரைக்க (prescribe) எனக்கு அனுமதி இல்லை. தவறான மருந்துகளை எடுப்பது ஆபத்தானது. தயவுசெய்து எங்கள் மருத்துவரிடம் ஆலோசனை பெறவும்."
        : detectedLang === 'hi-IN'
        ? "मैं दवाइयाँ प्रिस्क्राइब नहीं कर सकता। उचित नुस्खे के लिए कृपया हमारे डॉक्टर से परामर्श करें।"
        : "I cannot prescribe medications or recommend pharmaceutical dosages. For your health and safety, all prescriptions must come from a licensed physician. Would you like me to schedule a doctor visit?";
      return {
        replyText: `💊 **Prescription Safety Policy**\n\n${refusal}`,
        spokenReply: refusal,
        detectedLanguage: detectedLang
      };
    }

    // =============================================================
    // 1B. STRICT SERVICE RESTRICTIONS (Section B - Excluded Services)
    // MediBot must NOT provide or advertise:
    // - Queue token status
    // - Pharmacy inventory
    // - Laboratory test status
    // - Medical report access
    // - Hospital navigation
    // =============================================================
    const isProhibitedQuery =
      // 1. Queue Token Status & Live Queue
      q.includes('queue token') || q.includes('token number') || q.includes('waiting time') || 
      q.includes('opd queue') || q.includes('my token') || q.includes('token status') ||
      q.includes('acknowledge alert') || q.includes('stop vibration') ||
      q.includes('வரிசை டோக்கன்') || q.includes('டோக்கன்') || q.includes('टोकन') || q.includes('कतार') ||
      // 2. Pharmacy Inventory & Medicine Stock
      q.includes('medicine availability') || q.includes('medicine stock') || q.includes('in stock') ||
      q.includes('check medicine') || q.includes('active prescription') || q.includes('my medicines') ||
      q.includes('prescription') || q.includes('marunthu irukka') || q.includes('tablet irukka') ||
      q.includes('மருந்து இருக்கிறதா') || q.includes('மருந்துகள் இருப்பு') || q.includes('dawa available') ||
      q.includes('dawa hai kya') || q.includes('pharmacy inventory') || q.includes('pharmacy stock') ||
      // 3. Laboratory Test Status
      q.includes('laboratory report') || q.includes('lab test') || q.includes('blood test') ||
      q.includes('lab report status') || q.includes('lab report enna aachu') || q.includes('லேப் டெஸ்ட்') ||
      q.includes('லேப் ரிப்போர்ட்') || q.includes('लैब टेस्ट') || q.includes('लैब रिपोर्ट') ||
      // 4. Medical Report Access & MediLingo
      q.includes('medical report') || q.includes('explain my report') || q.includes('explain report') ||
      q.includes('explain my') || q.includes('medilingo') || q.includes('view report') ||
      q.includes('access report') || q.includes('my reports') || q.includes('what does my test mean') ||
      q.includes('மருத்துவ அறிக்கை') || q.includes('ரிப்போர்ட் பார்க்க') ||
      // 5. Hospital Navigation & WayFinder Indoor Maps
      ((q.includes('indoor map') || q.includes('wayfinder') || q.includes('how do i get to') ||
      q.includes('where is') || q.includes('direction to') || q.includes('guide me to') ||
      q.includes('hospital map') || q.includes('navigation') || q.includes('வழிகாட்டுதல்') ||
      q.includes('எங்கு உள்ளது') || q.includes('ராஸ்தா') || q.includes('दिशा')) && !q.startsWith('open '));

    if (isProhibitedQuery) {
      if (detectedLang === 'ta-IN') {
        const text = "நான் தற்போது மருத்துவ ஆலோசனை முன்பதிவு, நோயாளி உதவி மற்றும் மருத்துவர் தகவல்களில் மட்டுமே உதவ முடியும். பிற சேவைகளுக்கு சம்பந்தப்பட்ட மருத்துவமனை துறையை தொடர்பு கொள்ளவும்.";
        return { replyText: `ℹ️ ${text}`, spokenReply: text, detectedLanguage: detectedLang };
      }
      if (detectedLang === 'mixed') {
        const text = "Naan ippo doctor appointment booking, patient assistance, koodave doctor information-la mattum dhaan help panna mudiyum. Matha services-ku hospital department-ah contact pannunga.";
        return { replyText: `ℹ️ ${text}`, spokenReply: text, detectedLanguage: detectedLang };
      }
      if (detectedLang === 'hi-IN') {
        const text = "मैं वर्तमान में केवल डॉक्टर अपॉइंटमेंट बुकिंग, रोगी सहायता और डॉक्टर की जानकारी में आपकी सहायता कर सकता हूँ। अन्य सेवाओं के लिए कृपया संबंधित अस्पताल विभाग से संपर्क करें।";
        return { replyText: `ℹ️ ${text}`, spokenReply: text, detectedLanguage: detectedLang };
      }
      const text = "I can currently help you with appointment booking, patient assistance and doctor information. Please contact the appropriate hospital department for other services.";
      return { replyText: `ℹ️ ${text}`, spokenReply: text, detectedLanguage: detectedLang };
    }

    // =============================================================
    // 2. IDENTITY & CAPABILITIES QUERIES (Multilingual: EN, TA, Tanglish, HI)
    // Strictly Allowed Services: Appointment Booking, Patient Assistance, Doctor Information
    // =============================================================
    const isIdentityQuery = 
      q.includes('what is your name') || q.includes('who are you') || q.includes('what can you do') ||
      q.includes('tell me about yourself') || q.includes('introduce yourself') || q.includes('who r u') ||
      // Tamil Unicode:
      q.includes('உன் பெயர் என்ன') || q.includes('உங்கள் பெயர் என்ன') || q.includes('நீங்கள் யார்') || 
      q.includes('உன்னால் என்ன செய்ய முடியும்') || q.includes('உன் பெயர்') ||
      // Tanglish:
      q.includes('un peru enna') || q.includes('unga peru enna') || q.includes('neenga yaaru') || 
      q.includes('neenga yarru') || q.includes('un name enna') || q.includes('unga name enna') ||
      // Hindi Unicode & Romanized (Both formal 'Aapka' and informal 'Tumhara'):
      q.includes('आपका नाम क्या है') || q.includes('तुम्हारा नाम क्या है') || q.includes('तुम्हारा नाम') ||
      q.includes('आप कौन हो') || q.includes('तुम कौन हो') || q.includes('आपका नाम') ||
      q.includes('aapka naam kya hai') || q.includes('tumhara naam kya hai') || q.includes('tumhara naam') ||
      q.includes('aap kaun ho') || q.includes('tum kaun ho');

    if (isIdentityQuery) {
      if (detectedLang === 'ta-IN') {
        const reply = "வணக்கம்! நான் MediConnect AI உதவியாளர். மருத்துவர் ஆலோசனை முன்பதிவு (Appointment Booking), நோயாளி உதவி (Patient Assistance) மற்றும் மருத்துவர் தகவல்கள் (Doctor Information) ஆகியவற்றில் நான் உங்களுக்கு உதவ முடியும். நான் உங்களுக்கு எவ்வாறு உதவ வேண்டும்?";
        return { replyText: reply, spokenReply: reply, detectedLanguage: 'ta-IN' };
      }
      if (detectedLang === 'mixed') {
        const reply = "Vanakkam! En peyar MediConnect AI Voice Assistant. Doctor appointment booking, patient assistance, koodave doctor information therinjukka naan ungalukku udhavi seiven. Ungalukku eppadi udhava vendum?";
        return { replyText: reply, spokenReply: reply, detectedLanguage: 'mixed' };
      }
      if (detectedLang === 'hi-IN') {
        const reply = "नमस्ते! मैं MediConnect AI सहायक हूँ। मैं आपको डॉक्टर अपॉइंटमेंट बुक करने, रोगी सहायता प्राप्त करने और डॉक्टर की जानकारी जानने में सहायता कर सकता हूँ। मैं आपकी क्या मदद करूँ?";
        return { replyText: reply, spokenReply: reply, detectedLanguage: 'hi-IN' };
      }
      const reply = "Hello! I am MediConnect AI Voice Assistant. I can help you with appointment booking, patient assistance, and doctor information. How can I assist you today?";
      return { replyText: reply, spokenReply: reply, detectedLanguage: 'en-IN' };
    }

    // =============================================================
    // 2B. USER NAME INTRODUCTION & CONVERSATION MEMORY
    // =============================================================

    // User introducing their own name: "My name is Vishnu", "I am Vishnu", "En peyar Vishnu", "Mera naam Vishnu hai"
    const nameIntroMatch = q.match(/(?:my name is|i am|call me|en peyar|ennoda peru|mera naam|mera nam)\s+([a-zA-Z\u0B80-\u0BFF\u0900-\u097F]+)/i);
    const isQuestioningOwnName = q.includes('what') || q.includes('kya') || q.includes('enna') || q.includes('who') || q.includes('yaar');

    if (nameIntroMatch && !isQuestioningOwnName) {
      const extractedRaw = nameIntroMatch[1].trim();
      const formattedName = extractedRaw.charAt(0).toUpperCase() + extractedRaw.slice(1);
      this.userIntroducedName = formattedName;

      let reply = `Nice to meet you, ${formattedName}! How can I assist you with your health or hospital visit today?`;
      if (detectedLang === 'ta-IN') {
        reply = `உங்களை சந்தித்ததில் மகிழ்ச்சி, ${formattedName}! இன்று உங்களுக்கு நான் எவ்வாறு உதவ வேண்டும்?`;
      } else if (detectedLang === 'mixed') {
        reply = `Unga peyar ${formattedName}, sandhithadhil romba sandhosham! Ungalukku hospital-la enna help venum?`;
      } else if (detectedLang === 'hi-IN') {
        reply = `आपसे मिलकर खुशी हुई, ${formattedName}! आज मैं आपकी क्या सहायता कर सकता हूँ?`;
      }
      return { replyText: reply, spokenReply: reply, detectedLanguage: detectedLang };
    }

    // User asking for their own name: "What is my name?", "Do you know my name?", "Who am I?", "En peyar enna?", "Mera naam kya hai?"
    const isAskingOwnName = 
      q.includes('what is my name') || q.includes('do you know my name') || q.includes('remember my name') ||
      q.includes('who am i') || q.includes('ennoda peru enna') || q.includes('en peyar enna') ||
      q.includes('mera naam kya hai') || q.includes('mera name kya hai') || q.includes('என் பெயர் என்ன');

    if (isAskingOwnName) {
      let knownName = this.userIntroducedName;
      if (!knownName && history && history.length > 0) {
        for (let i = history.length - 1; i >= 0; i--) {
          const pastMsg = history[i].text.toLowerCase();
          const match = pastMsg.match(/(?:my name is|i am|call me|en peyar|ennoda peru|mera naam|mera nam)\s+([a-zA-Z\u0B80-\u0BFF\u0900-\u097F]+)/i);
          if (match && !pastMsg.includes('what') && !pastMsg.includes('kya') && !pastMsg.includes('enna')) {
            knownName = match[1].trim();
            knownName = knownName.charAt(0).toUpperCase() + knownName.slice(1);
            this.userIntroducedName = knownName;
            break;
          }
        }
      }
      if (!knownName && context.currentUser?.name) {
        knownName = context.currentUser.name;
      }

      if (knownName) {
        let reply = `Your name is ${knownName}. How can I help you today?`;
        if (detectedLang === 'ta-IN') {
          reply = `உங்கள் பெயர் ${knownName}. இன்று நான் உங்களுக்கு எவ்வாறு உதவ வேண்டும்?`;
        } else if (detectedLang === 'mixed') {
          reply = `Unga peyar ${knownName}. Solleenga, ungalukku enna help pannanum?`;
        } else if (detectedLang === 'hi-IN') {
          reply = `आपका नाम ${knownName} है। मैं आज आपकी क्या सहायता कर सकता हूँ?`;
        }
        return { replyText: reply, spokenReply: reply, detectedLanguage: detectedLang };
      } else {
        let reply = "I don't know your name yet. You can introduce yourself by saying 'My name is...'!";
        if (detectedLang === 'ta-IN' || detectedLang === 'mixed') {
          reply = "உங்கள் பெயர் எனக்கு இன்னும் தெரியவில்லை. 'My name is...' என்று கூறி அறிமுகம் செய்து கொள்ளலாம்!";
        } else if (detectedLang === 'hi-IN') {
          reply = "मुझे अभी आपका नाम नहीं पता। आप 'Mera naam...' कहकर अपना परिचय दे सकते हैं!";
        }
        return { replyText: reply, spokenReply: reply, detectedLanguage: detectedLang };
      }
    }

    // =============================================================
    // 3. NAVIGATION COMMANDS VS DIRECT ACTION COMMANDS
    // =============================================================

    // Pure Navigation Intent Detection: "Open appointments", "Open medical records", "Open pharmacy", "Show my dashboard", etc.
    // RULE: Navigate to the corresponding page WITHOUT performing any transactions.
    const isExplicitNavCommand = 
      q.startsWith('open ') || q.startsWith('go to ') || q.startsWith('navigate to ') || 
      q.startsWith('show my ') || q.startsWith('show ') || q.startsWith('take me to ');

    if (isExplicitNavCommand) {
      // Clear any pending progressive states on deliberate page switch
      this.bookingState = { inProgress: false, step: 'idle' };
      this.cancellationState = { inProgress: false };
      this.rescheduleState = { inProgress: false, step: 'idle' };

      const navTarget = q.replace(/^(open|go to|navigate to|show my|show|take me to)\s+/i, '').trim();
      const toolRes = await VoiceToolDispatcher.executeTool('navigate_to_page', { target: navTarget }, context);
      return {
        replyText: toolRes.message,
        spokenReply: toolRes.spokenFeedback,
        detectedLanguage: detectedLang,
        toolCallResult: toolRes
      };
    }

    // =============================================================
    // 3. MULTI-TURN CANCELLATION FLOW (Explicit Confirmation)
    // =============================================================
    if (this.cancellationState.inProgress) {
      if (q.includes('yes') || q.includes('confirm') || q.includes('cancel it') || q.includes('aama') || q.includes('haan')) {
        const appToCancel = this.cancellationState;
        this.cancellationState = { inProgress: false };
        const toolRes = await VoiceToolDispatcher.executeTool('cancel_appointment', {
          appointmentId: appToCancel.appointmentId,
          doctorNameOrSpec: appToCancel.doctorName
        }, context);
        return {
          replyText: toolRes.message,
          spokenReply: toolRes.spokenFeedback,
          detectedLanguage: detectedLang,
          toolCallResult: toolRes
        };
      }

      if (q.includes('no') || q.includes('stop') || q.includes('keep') || q.includes('vendaam') || q.includes('nahi')) {
        this.cancellationState = { inProgress: false };
        const cancelAborted = "Cancellation cancelled. Your appointment remains scheduled.";
        return { replyText: cancelAborted, spokenReply: cancelAborted, detectedLanguage: detectedLang };
      }
    }

    // =============================================================
    // 4. MULTI-TURN PROGRESSIVE BOOKING FLOW (Step-by-Step + Slots + Confirmation)
    // =============================================================
    if (this.bookingState.inProgress) {
      // A. Cancellation / Abort
      if (q.includes('cancel') || q.includes('stop') || q.includes('never mind') || q.includes('vendaam') || q.includes('nahi chahiye')) {
        this.bookingState = { inProgress: false, step: 'idle' };
        let msg = "Appointment booking has been cancelled. How else can I assist you?";
        if (detectedLang === 'ta-IN') {
          msg = "முன்பதிவு ரத்து செய்யப்பட்டது. உங்களுக்கு வேறு ஏதேனும் உதவி தேவையா?";
        } else if (detectedLang === 'mixed') {
          msg = "Appointment booking cancel aayiduchu. Vera edhavadhu help venuma?";
        } else if (detectedLang === 'hi-IN') {
          msg = "अपॉइंटमेंट बुकिंग रद्द कर दी गई है। क्या मैं आपकी कोई और मदद कर सकता हूँ?";
        }
        return { replyText: msg, spokenReply: msg, detectedLanguage: detectedLang };
      }

      // Step: Awaiting Booking Consent (After Symptom Recommendation)
      if (this.bookingState.step === 'awaiting_booking_consent') {
        const isAffirmative =
          q.includes('yes') || q.includes('sure') || q.includes('aama') || q.includes('haan') ||
          q.includes('book') || q.includes('confirm') || q.includes('ok') || q.includes('seri') ||
          q.includes('kandippa') || q.includes('correct') || q.includes('ஆம்') || q.includes('சரி') ||
          q.includes('உறுதி') || q.includes('हाँ') || q.includes('जी हाँ');

        if (isAffirmative) {
          if (this.bookingState.date) {
            this.bookingState.step = 'awaiting_slot';
            const availRes = await VoiceToolDispatcher.executeTool('check_doctor_availability', {
              specialtyOrName: this.bookingState.doctorId || this.bookingState.doctorName,
              date: this.bookingState.date
            }, context);
            const slots: string[] = availRes.data?.availableSlots || ['10:00 AM', '11:30 AM'];
            this.bookingState.availableSlots = slots;

            let reply = `📅 **Available Slots for ${this.bookingState.doctorName} on ${this.bookingState.date}:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Which slot would you prefer?*`;
            let spoken = `Available slots for ${this.bookingState.doctorName} on ${this.bookingState.date} are ${slots.slice(0, 2).join(' and ')}. Which one would you prefer?`;

            if (detectedLang === 'ta-IN') {
              reply = `📅 **${this.bookingState.doctorName} மருத்துவரிடம் ${this.bookingState.date} அன்று கிடைக்கும் நேரங்கள்:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*எந்த நேரம் உங்களுக்கு வசதியாக இருக்கும்?*`;
              spoken = `${this.bookingState.date} அன்று ${slots.slice(0, 2).join(' மற்றும் ')} ஆகிய நேரங்கள் உள்ளன. எந்த நேரம் உங்களுக்கு வசதியாக இருக்கும்?`;
            } else if (detectedLang === 'mixed') {
              reply = `📅 **${this.bookingState.doctorName}-kitta ${this.bookingState.date} Slots:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Endha slot ungalukku venum?*`;
              spoken = `${this.bookingState.date}-la ${slots.slice(0, 2).join(' and ')} available-ah irukku. Endha time ungalukku venum?`;
            } else if (detectedLang === 'hi-IN') {
              reply = `📅 **${this.bookingState.doctorName} के साथ ${this.bookingState.date} को उपलब्ध स्लॉट:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*आप कौन सा समय पसंद करेंगे?*`;
              spoken = `${this.bookingState.date} को उपलब्ध समय: ${slots.slice(0, 2).join(' और ')}। आप कौन सा समय पसंद करेंगे?`;
            }

            return { replyText: reply, spokenReply: spoken, detectedLanguage: detectedLang };
          } else {
            this.bookingState.step = 'awaiting_date';
            let askDate = `Which date would you prefer with ${this.bookingState.doctorName}? (e.g. Tomorrow, next Friday, or a specific date like December 15)`;
            if (detectedLang === 'ta-IN') {
              askDate = `${this.bookingState.doctorName} மருத்துவரிடம் எந்த தேதியில் நீங்கள் வர விரும்புகிறீர்கள்? (உதாரணம்: நாளை, அல்லது ஒரு குறிப்பிட்ட தேதி)`;
            } else if (detectedLang === 'mixed') {
              askDate = `Endha date-ku appointment venum? (Example: Naalaikku, or specific date like December 15)`;
            } else if (detectedLang === 'hi-IN') {
              askDate = `आप ${this.bookingState.doctorName} के साथ किस तारीख को आना चाहेंगे? (उदाहरण: कल, या कोई विशेष तारीख)`;
            }
            return { replyText: askDate, spokenReply: askDate, detectedLanguage: detectedLang };
          }
        }

        if (q.includes('no') || q.includes('vendaam') || q.includes('nahi') || q.includes('not now') || q.includes('இல்லை') || q.includes('வேண்டாம்') || q.includes('नहीं')) {
          this.bookingState = { inProgress: false, step: 'idle' };
          let msg = "Understood! Let me know if you need any other assistance or information about our doctors.";
          if (detectedLang === 'ta-IN') {
            msg = "சரி! உங்களுக்கு வேறு ஏதேனும் உதவி தேவைப்பட்டால் தயங்காமல் கேட்கவும்.";
          } else if (detectedLang === 'mixed') {
            msg = "Seri! Vera edhavadhu hospital assistance venumna sollunga.";
          } else if (detectedLang === 'hi-IN') {
            msg = "ठीक है! यदि आपको किसी अन्य सहायता की आवश्यकता हो, तो कृपया बताएं।";
          }
          return { replyText: msg, spokenReply: msg, detectedLanguage: detectedLang };
        }
      }

      // Step: Awaiting Department / Doctor Selection
      if (this.bookingState.step === 'awaiting_spec') {
        const sMatch = matchSymptomToSpecialist(q);
        const doc = findDoctorByQuery(q, MOCK_DOCTORS) || (sMatch ? MOCK_DOCTORS.find(d => d.id === sMatch.doctorId) : undefined);
        const spec = doc ? doc.specialization : (sMatch ? sMatch.department : extractSpecialty(q));

        if (spec) {
          const matchedDoc = doc || MOCK_DOCTORS.find(d => d.specialization === spec);
          this.bookingState.doctorSpec = spec;
          this.bookingState.doctorName = matchedDoc?.name || `Dr. (${spec})`;
          this.bookingState.doctorId = matchedDoc?.id;
          this.bookingState.step = 'awaiting_date';

          // Check if patient also mentioned a date in this utterance (e.g. "Cardiology on December 15")
          const monthOnly = detectMonthOnly(q);
          const date = parseDateFromText(q);

          if (date) {
            this.bookingState.date = date;
            const availRes = await VoiceToolDispatcher.executeTool('check_doctor_availability', {
              specialtyOrName: matchedDoc?.id || matchedDoc?.name || spec,
              date: date
            }, context);
            const slots: string[] = availRes.data?.availableSlots || ['10:00 AM', '11:30 AM'];
            this.bookingState.availableSlots = slots;
            this.bookingState.step = 'awaiting_slot';

            let reply = `📅 **Available Slots for ${this.bookingState.doctorName} on ${date}:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Which slot would you prefer?*`;
            let spoken = `Available slots for ${this.bookingState.doctorName} on ${date} are ${slots.slice(0, 2).join(' and ')}. Which one would you prefer?`;

            if (detectedLang === 'ta-IN') {
              reply = `📅 **${this.bookingState.doctorName} மருத்துவரிடம் ${date} அன்று கிடைக்கும் நேரங்கள்:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*எந்த நேரம் உங்களுக்கு வசதியாக இருக்கும்?*`;
              spoken = `${date} அன்று ${slots.slice(0, 2).join(' மற்றும் ')} ஆகிய நேரங்கள் உள்ளன. எந்த நேரம் உங்களுக்கு வசதியாக இருக்கும்?`;
            } else if (detectedLang === 'mixed') {
              reply = `📅 **${this.bookingState.doctorName}-kitta ${date} Slots:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Endha slot ungalukku venum?*`;
              spoken = `${date}-la ${slots.slice(0, 2).join(' and ')} available-ah irukku. Endha time ungalukku venum?`;
            } else if (detectedLang === 'hi-IN') {
              reply = `📅 **${this.bookingState.doctorName} के साथ ${date} को उपलब्ध स्लॉट:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*आप कौन सा समय पसंद करेंगे?*`;
              spoken = `${date} को उपलब्ध समय: ${slots.slice(0, 2).join(' और ')}। आप कौन सा समय पसंद करेंगे?`;
            }

            return { replyText: reply, spokenReply: spoken, detectedLanguage: detectedLang };
          }

          if (monthOnly) {
            this.bookingState.monthOnlyPreference = monthOnly;
            const docLabel = this.bookingState.doctorName;
            let msg = `We have consultations available with ${docLabel} in ${monthOnly.monthName} ${monthOnly.year}. Which date would you prefer? (For example: ${monthOnly.monthName} 5, ${monthOnly.monthName} 15, or ${monthOnly.monthName} 22)`;
            if (detectedLang === 'ta-IN') {
              msg = `${docLabel} மருத்துவரிடம் ${monthOnly.monthName} ${monthOnly.year}-ல் ஆலோசனைகள் உள்ளன. நீங்கள் எந்த தேதியை விரும்புகிறீர்கள்? (உதாரணம்: ${monthOnly.monthName} 5, ${monthOnly.monthName} 15)`;
            } else if (detectedLang === 'mixed') {
              msg = `${docLabel}-kitta ${monthOnly.monthName} ${monthOnly.year}-la slots irukku. Entha date-la paaka virumbureenga? (Example: ${monthOnly.monthName} 5, ${monthOnly.monthName} 15)`;
            } else if (detectedLang === 'hi-IN') {
              msg = `${docLabel} के साथ ${monthOnly.monthName} ${monthOnly.year} में अपॉइंटमेंट उपलब्ध हैं। आप किस तारीख को आना चाहेंगे? (उदाहरण: ${monthOnly.monthName} 5, ${monthOnly.monthName} 15)`;
            }
            return { replyText: msg, spokenReply: msg, detectedLanguage: detectedLang };
          }

          const docLabel = matchedDoc ? `${matchedDoc.name} (${spec})` : spec;
          let askDate = `${docLabel} selected. Which date would you prefer? (e.g. Tomorrow, next Friday, or a specific date like December 15)`;
          if (detectedLang === 'ta-IN') {
            askDate = `${spec} துறை தேர்ந்தெடுக்கப்பட்டது. ${docLabel} மருத்துவரிடம் எந்த தேதியில் நீங்கள் வர விரும்புகிறீர்கள்? (உதாரணம்: நாளை, அல்லது ஒரு குறிப்பிட்ட தேதி)`;
          } else if (detectedLang === 'mixed') {
            askDate = `${docLabel} select aachu. Entha date-la paaka virumbureenga? (Example: Naalaikku, or specific date)`;
          } else if (detectedLang === 'hi-IN') {
            askDate = `${spec} चुन लिया गया है। आप ${docLabel} के साथ किस तारीख को आना चाहेंगे? (उदाहरण: कल, या कोई विशेष तारीख)`;
          }
          return { replyText: askDate, spokenReply: askDate, detectedLanguage: detectedLang };
        } else {
          const deptList = getAllDepartments(MOCK_DOCTORS).join(', ');
          let askAgain = `Which department or doctor would you like to consult? Available: ${deptList}.`;
          if (detectedLang === 'ta-IN') {
            askAgain = `எந்த மருத்துவ துறை அல்லது மருத்துவரிடம் ஆலோசனை பெற விரும்புகிறீர்கள்? கிடைக்கும் துறைகள்: ${deptList}.`;
          } else if (detectedLang === 'mixed') {
            askAgain = `Endha department illa doctor-ah consult panna virumbureenga? Available: ${deptList}.`;
          } else if (detectedLang === 'hi-IN') {
            askAgain = `आप किस विभाग या डॉक्टर से परामर्श लेना चाहेंगे? उपलब्ध विभाग: ${deptList}।`;
          }
          return { replyText: askAgain, spokenReply: askAgain, detectedLanguage: detectedLang };
        }
      }

      // Step: Awaiting Date Selection -> Checks Backend Availability
      if (this.bookingState.step === 'awaiting_date') {
        // 1. Check if patient changed the doctor or department
        const changedDoc = findDoctorByQuery(q, MOCK_DOCTORS);
        const hasDoctorChange = changedDoc && (q.includes('change') || q.includes('doctor') || q.includes('dr') || q.includes('with') || q.includes('instead'));
        if (hasDoctorChange) {
          this.bookingState.doctorName = changedDoc.name;
          this.bookingState.doctorId = changedDoc.id;
          this.bookingState.doctorSpec = changedDoc.specialization; // Remap department correctly!

          if (!parseDateFromText(q) && !detectMonthOnly(q)) {
            let askNewDate = `Doctor changed to ${changedDoc.name} (${changedDoc.specialization}). Which date would you prefer? (You can say Tomorrow, next Friday, or a specific date like December 15)`;
            if (detectedLang === 'ta-IN') {
              askNewDate = `மருத்துவர் ${changedDoc.name} (${changedDoc.specialization}) தேர்ந்தெடுக்கப்பட்டார். எந்த தேதியில் நீங்கள் வர விரும்புகிறீர்கள்?`;
            } else if (detectedLang === 'mixed') {
              askNewDate = `Doctor changed to ${changedDoc.name} (${changedDoc.specialization}). Entha date-ku appointment venum?`;
            } else if (detectedLang === 'hi-IN') {
              askNewDate = `डॉक्टर बदलकर ${changedDoc.name} (${changedDoc.specialization}) कर दिया गया है। आप किस तारीख को आना चाहेंगे?`;
            }
            return { replyText: askNewDate, spokenReply: askNewDate, detectedLanguage: detectedLang };
          }
        }

        // 2. Check if user specified a month-only preference
        const monthOnly = detectMonthOnly(q);
        if (monthOnly) {
          this.bookingState.monthOnlyPreference = monthOnly;
          const docName = this.bookingState.doctorName || 'our specialist';
          let msg = `We have consultations available with ${docName} in ${monthOnly.monthName} ${monthOnly.year}. Which date would you prefer? (For example: ${monthOnly.monthName} 5, ${monthOnly.monthName} 15, or ${monthOnly.monthName} 22)`;
          if (detectedLang === 'ta-IN') {
            msg = `${docName} மருத்துவரிடம் ${monthOnly.monthName} ${monthOnly.year}-ல் ஆலோசனைகள் உள்ளன. நீங்கள் எந்த தேதியை விரும்புகிறீர்கள்? (உதாரணம்: ${monthOnly.monthName} 5, ${monthOnly.monthName} 15)`;
          } else if (detectedLang === 'mixed') {
            msg = `${docName}-kitta ${monthOnly.monthName} ${monthOnly.year}-la slots irukku. Entha date-la paaka virumbureenga? (Example: ${monthOnly.monthName} 5, ${monthOnly.monthName} 15)`;
          } else if (detectedLang === 'hi-IN') {
            msg = `${docName} के साथ ${monthOnly.monthName} ${monthOnly.year} में अपॉइंटमेंट उपलब्ध हैं। आप किस तारीख को आना चाहेंगे? (उदाहरण: ${monthOnly.monthName} 5, ${monthOnly.monthName} 15)`;
          }
          return { replyText: msg, spokenReply: msg, detectedLanguage: detectedLang };
        }

        // 3. Parse specific date (using pending month if available)
        const resolvedDate = parseDateFromText(q, new Date(), this.bookingState.monthOnlyPreference);
        if (resolvedDate) {
          this.bookingState.date = resolvedDate;

          // Call backend availability check for the RETAINED doctor
          const availRes = await VoiceToolDispatcher.executeTool('check_doctor_availability', {
            specialtyOrName: this.bookingState.doctorId || this.bookingState.doctorName || this.bookingState.doctorSpec,
            date: resolvedDate
          }, context);

          const slots: string[] = availRes.data?.availableSlots || ['10:00 AM', '11:30 AM'];
          this.bookingState.availableSlots = slots;
          this.bookingState.step = 'awaiting_slot';

          if (slots.length === 0) {
            let noSlots = `Sorry, ${this.bookingState.doctorName} has no available slots on ${resolvedDate}. Would you like to check another date?`;
            if (detectedLang === 'ta-IN') {
              noSlots = `மன்னிக்கவும், ${resolvedDate} அன்று ${this.bookingState.doctorName} மருத்துவரிடம் நேரங்கள் இல்லை. வேறு தேதியை பார்க்கவா?`;
            } else if (detectedLang === 'mixed') {
              noSlots = `Sorry, ${resolvedDate}-la ${this.bookingState.doctorName}-kitta slots illa. Vera date check pannava?`;
            } else if (detectedLang === 'hi-IN') {
              noSlots = `क्षमा करें, ${resolvedDate} को ${this.bookingState.doctorName} के साथ कोई स्लॉट उपलब्ध नहीं है। क्या आप कोई अन्य तारीख देखना चाहेंगे?`;
            }
            this.bookingState.step = 'awaiting_date';
            return { replyText: noSlots, spokenReply: noSlots, detectedLanguage: detectedLang };
          }

          let reply = `📅 **Available Slots on ${resolvedDate} (${this.bookingState.doctorName}):**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Which slot would you prefer?*`;
          let spoken = `There are available slots for ${this.bookingState.doctorName} on ${resolvedDate}: ${slots.slice(0, 2).join(' and ')}. Which one would you prefer?`;

          if (detectedLang === 'ta-IN') {
            reply = `📅 **${this.bookingState.doctorName} மருத்துவரிடம் ${resolvedDate} அன்று கிடைக்கும் நேரங்கள்:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*எந்த நேரம் உங்களுக்கு வசதியாக இருக்கும்?*`;
            spoken = `${resolvedDate} அன்று ${slots.slice(0, 2).join(' மற்றும் ')} ஆகிய நேரங்கள் உள்ளன. எந்த நேரம் உங்களுக்கு வசதியாக இருக்கும்?`;
          } else if (detectedLang === 'mixed') {
            reply = `📅 **${this.bookingState.doctorName}-kitta ${resolvedDate} Available Slots:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Endha slot ungalukku venum?*`;
            spoken = `${resolvedDate}-la ${slots.slice(0, 2).join(' and ')} slots available-ah irukku. Endha time ungalukku venum?`;
          } else if (detectedLang === 'hi-IN') {
            reply = `📅 **${this.bookingState.doctorName} के साथ ${resolvedDate} को उपलब्ध स्लॉट:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*आप कौन सा समय पसंद करेंगे?*`;
            spoken = `${resolvedDate} को उपलब्ध समय: ${slots.slice(0, 2).join(' और ')}। आप कौन सा समय पसंद करेंगे?`;
          }

          return { replyText: reply, spokenReply: spoken, detectedLanguage: detectedLang };
        } else {
          let askDateAgain = `Which date would you prefer with ${this.bookingState.doctorName}? (You can say Tomorrow, next Friday, or a specific date like December 15)`;
          if (detectedLang === 'ta-IN') {
            askDateAgain = `${this.bookingState.doctorName} மருத்துவரிடம் எந்த தேதியில் நீங்கள் வர விரும்புகிறீர்கள்? (உதாரணம்: நாளை, அல்லது ஒரு குறிப்பிட்ட தேதி)`;
          } else if (detectedLang === 'mixed') {
            askDateAgain = `${this.bookingState.doctorName}-kitta endha date-ku appointment venum? (Example: Naalaikku, or specific date like December 15)`;
          } else if (detectedLang === 'hi-IN') {
            askDateAgain = `आप ${this.bookingState.doctorName} के साथ किस तारीख को आना चाहेंगे? (उदाहरण: कल, या कोई विशेष तारीख)`;
          }
          return { replyText: askDateAgain, spokenReply: askDateAgain, detectedLanguage: detectedLang };
        }
      }

      // Step: Awaiting Slot Choice -> Asks for Explicit Confirmation
      if (this.bookingState.step === 'awaiting_slot') {
        // 1. Check if patient changed the DOCTOR
        const changedDoc = findDoctorByQuery(q, MOCK_DOCTORS);
        if (changedDoc && (q.includes('change') || q.includes('doctor') || q.includes('dr') || q.includes('instead')) && changedDoc.id !== this.bookingState.doctorId) {
          this.bookingState.doctorName = changedDoc.name;
          this.bookingState.doctorId = changedDoc.id;
          this.bookingState.doctorSpec = changedDoc.specialization; // Remap department correctly!

          const availRes = await VoiceToolDispatcher.executeTool('check_doctor_availability', {
            specialtyOrName: changedDoc.id || changedDoc.name,
            date: this.bookingState.date
          }, context);
          const slots: string[] = availRes.data?.availableSlots || ['10:00 AM', '11:30 AM'];
          this.bookingState.availableSlots = slots;

          let msg = `Doctor changed to ${changedDoc.name} (${changedDoc.specialization}). Available slots on ${this.bookingState.date} are: ${slots.slice(0, 2).join(' and ')}. Which one would you prefer?`;
          let reply = `👨‍⚕️ **Doctor Updated to ${changedDoc.name} (${changedDoc.specialization})**\n📅 Available slots on ${this.bookingState.date}:\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Which slot would you prefer?*`;

          if (detectedLang === 'ta-IN') {
            msg = `மருத்துவர் ${changedDoc.name} (${changedDoc.specialization})-க்கு மாற்றப்பட்டார். ${this.bookingState.date} அன்று கிடைக்கும் நேரங்கள்: ${slots.slice(0, 2).join(' மற்றும் ')}. எந்த நேரம் வேண்டும்?`;
            reply = `👨‍⚕️ **மருத்துவர் ${changedDoc.name} (${changedDoc.specialization})**\n📅 ${this.bookingState.date} அன்று கிடைக்கும் நேரங்கள்:\n${slots.map(s => `• ${s}`).join('\n')}\n\n*எந்த நேரம் வேண்டும்?*`;
          } else if (detectedLang === 'mixed') {
            msg = `Doctor changed to ${changedDoc.name} (${changedDoc.specialization}). ${this.bookingState.date}-la slots: ${slots.slice(0, 2).join(' and ')}. Endha slot venum?`;
            reply = `👨‍⚕️ **Doctor Updated: ${changedDoc.name} (${changedDoc.specialization})**\n📅 Available slots on ${this.bookingState.date}:\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Endha slot venum?*`;
          } else if (detectedLang === 'hi-IN') {
            msg = `डॉक्टर बदलकर ${changedDoc.name} (${changedDoc.specialization}) कर दिया गया है। ${this.bookingState.date} को उपलब्ध समय: ${slots.slice(0, 2).join(' और ')}। आप कौन सा समय पसंद करेंगे?`;
            reply = `👨‍⚕️ **डॉक्टर अपडेट: ${changedDoc.name} (${changedDoc.specialization})**\n📅 ${this.bookingState.date} को उपलब्ध स्लॉट:\n${slots.map(s => `• ${s}`).join('\n')}\n\n*आप कौन सा समय पसंद करेंगे?*`;
          }

          return { replyText: reply, spokenReply: msg, detectedLanguage: detectedLang };
        }

        // 2. Check if patient changed the DATE (e.g. "Change it to December 18" / "No, change date to 2026-11-30")
        const correctedDate = parseDateFromText(q, new Date(), this.bookingState.monthOnlyPreference);
        const isDateCorrection = correctedDate && (
          q.includes('date') || q.includes('change') || q.includes('no') ||
          q.includes('instead') || q.includes('different') || correctedDate !== this.bookingState.date
        );

        if (isDateCorrection && correctedDate) {
          this.bookingState.date = correctedDate;
          // Re-query availability for the RETAINED doctor on the new date
          const availRes = await VoiceToolDispatcher.executeTool('check_doctor_availability', {
            specialtyOrName: this.bookingState.doctorId || this.bookingState.doctorName || this.bookingState.doctorSpec,
            date: correctedDate
          }, context);

          const slots: string[] = availRes.data?.availableSlots || ['10:00 AM', '11:30 AM'];
          this.bookingState.availableSlots = slots;

          if (slots.length === 0) {
            let noSlots = `Sorry, ${this.bookingState.doctorName} has no available slots for ${correctedDate}. Would you like to check another date?`;
            if (detectedLang === 'ta-IN') {
              noSlots = `மன்னிக்கவும், ${correctedDate} அன்று ${this.bookingState.doctorName} மருத்துவரிடம் நேரங்கள் இல்லை. வேறு தேதியை பார்க்கவா?`;
            } else if (detectedLang === 'mixed') {
              noSlots = `Sorry, ${correctedDate}-la ${this.bookingState.doctorName}-kitta slots illa. Vera date check pannava?`;
            } else if (detectedLang === 'hi-IN') {
              noSlots = `क्षमा करें, ${correctedDate} को ${this.bookingState.doctorName} के साथ कोई स्लॉट उपलब्ध नहीं है। क्या आप कोई अन्य तारीख देखना चाहेंगे?`;
            }
            this.bookingState.step = 'awaiting_date';
            return { replyText: noSlots, spokenReply: noSlots, detectedLanguage: detectedLang };
          }

          let offerSlots = `Date updated to ${correctedDate} for ${this.bookingState.doctorName}. Available slots are: ${slots.slice(0, 2).join(' and ')}. Which one would you prefer?`;
          let reply = `📅 **Updated Date to ${correctedDate} (${this.bookingState.doctorName}):**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Which slot would you prefer?*`;

          if (detectedLang === 'ta-IN') {
            offerSlots = `தேதி ${correctedDate}-க்கு மாற்றப்பட்டது. கிடைக்கும் நேரங்கள்: ${slots.slice(0, 2).join(' மற்றும் ')}. எந்த நேரம் உங்களுக்கு வசதியாக இருக்கும்?`;
            reply = `📅 **தேதி ${correctedDate}-க்கு மாற்றப்பட்டது (${this.bookingState.doctorName}):**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*எந்த நேரம் வேண்டும்?*`;
          } else if (detectedLang === 'mixed') {
            offerSlots = `Date ${correctedDate}-ku update aachu. Slots: ${slots.slice(0, 2).join(' and ')}. Endha time venum?`;
            reply = `📅 **Updated Date to ${correctedDate} (${this.bookingState.doctorName}):**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Endha slot venum?*`;
          } else if (detectedLang === 'hi-IN') {
            offerSlots = `तारीख बदलकर ${correctedDate} कर दी गई है। उपलब्ध समय: ${slots.slice(0, 2).join(' और ')}। आप कौन सा समय पसंद करेंगे?`;
            reply = `📅 **तारीख अपडेट: ${correctedDate} (${this.bookingState.doctorName}):**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*आप कौन सा समय पसंद करेंगे?*`;
          }

          return { replyText: reply, spokenReply: offerSlots, detectedLanguage: detectedLang };
        }

        // 3. Otherwise, process as slot choice
        const chosenSlot = parseTimeFromText(q, this.bookingState.availableSlots);
        this.bookingState.time = chosenSlot;
        this.bookingState.step = 'awaiting_confirmation';

        const doctorName = this.bookingState.doctorName || 'our specialist';
        const department = this.bookingState.doctorSpec || 'General';
        const date = this.bookingState.date || 'tomorrow';
        const time = this.bookingState.time;

        let confirmationPrompt = `I have ${doctorName} in ${department} on ${date} at ${time}. Should I confirm this appointment?`;
        let confirmReply = `📋 **Please Confirm Your Appointment:**\n• **Doctor:** ${doctorName}\n• **Department:** ${department}\n• **Date:** ${date}\n• **Time:** ${time}\n\n**Should I confirm this appointment?** *(Say "Yes" to confirm or "No" to cancel)*`;

        if (detectedLang === 'ta-IN') {
          confirmationPrompt = `${department} துறையில் ${doctorName} மருத்துவரிடம் ${date} அன்று ${time} மணிக்கு appointment உறுதி செய்யவா?`;
          confirmReply = `📋 **முன்பதிவை உறுதிப்படுத்தவும்:**\n• **மருத்துவர்:** ${doctorName}\n• **துறை:** ${department}\n• **தேதி:** ${date}\n• **நேரம்:** ${time}\n\n**இந்த appointment-ஐ உறுதி செய்யவா?** *(உறுதி செய்ய "ஆம்" என்றும், ரத்து செய்ய "இல்லை" என்றும் கூறவும்)*`;
        } else if (detectedLang === 'mixed') {
          confirmationPrompt = `${department} department-la ${doctorName} kitta ${date} anikku ${time}-ku appointment confirm pannava?`;
          confirmReply = `📋 **Appointment Confirmation:**\n• **Doctor:** ${doctorName}\n• **Department:** ${department}\n• **Date:** ${date}\n• **Time:** ${time}\n\n**Intha appointment confirm pannava?** *("Yes" nu sollunga)*`;
        } else if (detectedLang === 'hi-IN') {
          confirmationPrompt = `क्या मैं ${department} विभाग में ${doctorName} के साथ ${date} को ${time} बजे अपॉइंटमेंट कन्फर्म करूँ?`;
          confirmReply = `📋 **कृपया अपनी अपॉइंटमेंट की पुष्टि करें:**\n• **डॉक्टर:** ${doctorName}\n• **विभाग:** ${department}\n• **तारीख:** ${date}\n• **समय:** ${time}\n\n**क्या मैं यह अपॉइंटमेंट कन्फर्म करूँ?** *(कन्फर्म करने के लिए "हाँ" कहें)*`;
        }

        return { replyText: confirmReply, spokenReply: confirmationPrompt, detectedLanguage: detectedLang };
      }

      // Step: Explicit Confirmation Response Check
      if (this.bookingState.step === 'awaiting_confirmation') {
        const isConfirmAffirmative =
          q.includes('yes') || q.includes('confirm') || q.includes('sure') || q.includes('correct') ||
          q.includes('aama') || q.includes('haan') || q.includes('ஆம்') || q.includes('சரி') ||
          q.includes('உறுதி') || q.includes('हाँ') || q.includes('जी हाँ');

        if (isConfirmAffirmative) {
          const finalDocId = this.bookingState.doctorId;
          const finalDocName = this.bookingState.doctorName;
          const finalSpec = this.bookingState.doctorSpec!;
          const finalDate = this.bookingState.date!;
          const finalTime = this.bookingState.time!;
          this.bookingState = { inProgress: false, step: 'idle' };

          // Execute actual backend booking tool
          const bookingResult = await VoiceToolDispatcher.executeTool('book_appointment', {
            doctorNameOrSpec: finalDocId || finalDocName || finalSpec,
            date: finalDate,
            time: finalTime
          }, context);

          if (bookingResult.success) {
            let successReply = `✅ **Appointment Confirmed!**\n• **Doctor:** ${finalDocName}\n• **Department:** ${finalSpec}\n• **Date:** ${finalDate}\n• **Time:** ${finalTime}\n\nYour appointment has been synchronized with the hospital system.`;
            let successSpoken = `Your appointment with ${finalDocName} in ${finalSpec} has been confirmed for ${finalDate} at ${finalTime}.`;

            if (detectedLang === 'ta-IN') {
              successReply = `✅ **முன்பதிவு வெற்றிகரமாக முடிந்தது!**\n• **மருத்துவர்:** ${finalDocName}\n• **துறை:** ${finalSpec}\n• **தேதி:** ${finalDate}\n• **நேரம்:** ${finalTime}\n\nஉங்கள் விவரங்கள் நோயாளி மற்றும் மருத்துவர் போர்ட்டல்களில் பதிவு செய்யப்பட்டுள்ளன.`;
              successSpoken = `${finalDocName} மருத்துவரிடம் ${finalDate} அன்று ${finalTime} மணிக்கு உங்கள் appointment உறுதி செய்யப்பட்டது.`;
            } else if (detectedLang === 'mixed') {
              successReply = `✅ **Appointment Confirmed!**\n• **Doctor:** ${finalDocName}\n• **Department:** ${finalSpec}\n• **Date:** ${finalDate}\n• **Time:** ${finalTime}\n\nPortal-la appointment synchronize aayiduchu.`;
              successSpoken = `${finalDocName} kitta ${finalDate} anikku ${finalTime}-ku unga appointment confirm aayiduchu!`;
            } else if (detectedLang === 'hi-IN') {
              successReply = `✅ **अपॉइंटमेंट सफलतापूर्वक बुक हो गई!**\n• **डॉक्टर:** ${finalDocName}\n• **विभाग:** ${finalSpec}\n• **तारीख:** ${finalDate}\n• **समय:** ${finalTime}\n\nविवरण आपके पोर्टल में अपडेट कर दिया गया है।`;
              successSpoken = `${finalDocName} के साथ ${finalDate} को ${finalTime} बजे आपकी अपॉइंटमेंट कन्फर्म हो गई है।`;
            }

            return {
              replyText: successReply,
              spokenReply: successSpoken,
              detectedLanguage: detectedLang,
              toolCallResult: bookingResult
            };
          } else {
            // Failure (e.g. duplicate or slot taken)
            let failReply = bookingResult.message;
            let failSpoken = bookingResult.spokenFeedback;
            if (detectedLang === 'ta-IN') {
              failReply = `⚠️ **முன்பதிவு தோல்வி:** ${bookingResult.message}`;
              failSpoken = `மன்னிக்கவும், இந்த நேரத்தில் முன்பதிவு செய்ய முடியவில்லை. தயவுசெய்து வேறு நேரத்தை தேர்வு செய்யவும்.`;
            } else if (detectedLang === 'mixed') {
              failReply = `⚠️ **Booking Issue:** ${bookingResult.message}`;
              failSpoken = `Sorry, indha slot-la book panna mudiyala. Vera time choose pannunga.`;
            } else if (detectedLang === 'hi-IN') {
              failReply = `⚠️ **बुकिंग विफल:** ${bookingResult.message}`;
              failSpoken = `क्षमा करें, इस समय अपॉइंटमेंट बुक नहीं हो सकी। कृपया कोई अन्य समय चुनें।`;
            }
            return {
              replyText: failReply,
              spokenReply: failSpoken,
              detectedLanguage: detectedLang,
              toolCallResult: bookingResult
            };
          }
        }

        const isConfirmNegative =
          q.includes('no') || q.includes('cancel') || q.includes('vendaam') || q.includes('nahi') ||
          q.includes('இல்லை') || q.includes('வேண்டாம்') || q.includes('नहीं');

        if (isConfirmNegative) {
          this.bookingState = { inProgress: false, step: 'idle' };
          let cancelMsg = "Appointment booking has been cancelled. Let me know if you would like to book a different time.";
          if (detectedLang === 'ta-IN') {
            cancelMsg = "முன்பதிவு ரத்து செய்யப்பட்டது. உங்களுக்கு வேறு நேரம் தேவைப்பட்டால் கூறவும்.";
          } else if (detectedLang === 'mixed') {
            cancelMsg = "Appointment booking cancel aayiduchu. Vera time venumna sollunga.";
          } else if (detectedLang === 'hi-IN') {
            cancelMsg = "अपॉइंटमेंट बुकिंग रद्द कर दी गई है। यदि आप कोई अन्य समय बुक करना चाहते हैं तो बताएं।";
          }
          return { replyText: cancelMsg, spokenReply: cancelMsg, detectedLanguage: detectedLang };
        }

        // Change doctor at confirmation step
        const changedDoc = findDoctorByQuery(q, MOCK_DOCTORS);
        if (changedDoc && (q.includes('change') || q.includes('doctor') || q.includes('dr') || q.includes('instead')) && changedDoc.id !== this.bookingState.doctorId) {
          this.bookingState.doctorName = changedDoc.name;
          this.bookingState.doctorId = changedDoc.id;
          this.bookingState.doctorSpec = changedDoc.specialization;
          this.bookingState.step = 'awaiting_slot';

          const availRes = await VoiceToolDispatcher.executeTool('check_doctor_availability', {
            specialtyOrName: changedDoc.id || changedDoc.name,
            date: this.bookingState.date
          }, context);
          const slots: string[] = availRes.data?.availableSlots || ['10:00 AM', '11:30 AM'];
          this.bookingState.availableSlots = slots;
          const offerSlots = `Doctor changed to ${changedDoc.name} (${changedDoc.specialization}). Available slots on ${this.bookingState.date} are: ${slots.slice(0, 2).join(' and ')}. Which one would you prefer?`;
          return {
            replyText: `👨‍⚕️ **Doctor Updated to ${changedDoc.name} (${changedDoc.specialization})**\n📅 Available slots on ${this.bookingState.date}:\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Which slot would you prefer?*`,
            spokenReply: offerSlots,
            detectedLanguage: detectedLang
          };
        }

        // Mid-flow date correction at confirmation step
        const correctedDate = parseDateFromText(q, new Date(), this.bookingState.monthOnlyPreference);
        if (correctedDate && (q.includes('change') || q.includes('date') || q.includes('different') || q.includes('instead'))) {
          this.bookingState.date = correctedDate;
          this.bookingState.step = 'awaiting_slot';
          const availRes = await VoiceToolDispatcher.executeTool('check_doctor_availability', {
            specialtyOrName: this.bookingState.doctorId || this.bookingState.doctorName || this.bookingState.doctorSpec,
            date: correctedDate
          }, context);
          const slots: string[] = availRes.data?.availableSlots || ['10:00 AM', '11:30 AM'];
          this.bookingState.availableSlots = slots;
          const offerSlots = `Date updated to ${correctedDate} for ${this.bookingState.doctorName}. Available slots are: ${slots.slice(0, 2).join(' and ')}. Which one would you prefer?`;
          return {
            replyText: `📅 **Updated Date to ${correctedDate} (${this.bookingState.doctorName}):**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Which slot would you prefer?*`,
            spokenReply: offerSlots,
            detectedLanguage: detectedLang
          };
        }

        // Mid-flow time correction
        if (q.includes('change') || q.includes('different') || q.includes('pm') || q.includes('am')) {
          const newSlot = parseTimeFromText(q);
          if (newSlot) {
            this.bookingState.time = newSlot;
            const reconfirm = `Updated time to ${newSlot}. Should I confirm this appointment for ${this.bookingState.date} with ${this.bookingState.doctorName} at ${newSlot}?`;
            return { replyText: reconfirm, spokenReply: reconfirm, detectedLanguage: detectedLang };
          }
        }
      }
    }

    // =============================================================
    // 5. DIRECT ACTION COMMANDS (Conversational Handling)
    // =============================================================

    // 5A. SYMPTOM-TO-SPECIALIST RECOGNITION & BOOKING INTEGRATION
    // (Part 2 & Part 3: All 10 registered doctors, natural language symptoms,
    //  Tamil, Hindi, Tanglish, and English with specialist priority)
    const symptomMatch = matchSymptomToSpecialist(transcript);
    if (symptomMatch && !isExplicitNavCommand && !isIdentityQuery && !isProhibitedQuery) {
      if (symptomMatch.isEmergency) {
        const emergencyResult = await VoiceToolDispatcher.executeTool('get_emergency_info', {}, context);
        const spoken = (detectedLang === 'ta-IN' || detectedLang === 'mixed')
          ? "அவசர உதவிக்கு உடனடியாக Ground Floor Room ER-101 அல்லது 123 456 7890 என்ற எண்ணை தொடர்பு கொள்ளவும்."
          : emergencyResult.spokenFeedback;
        return {
          replyText: `🚨 **URGENT EMERGENCY ALERT**\n\n${symptomMatch.emergencyWarning || emergencyResult.message}`,
          spokenReply: spoken,
          detectedLanguage: detectedLang,
          toolCallResult: emergencyResult
        };
      }

      // Check if user also gave a date in the same utterance (e.g. "Tooth pain, book tomorrow")
      const date = parseDateFromText(q);
      const monthOnly = detectMonthOnly(q);

      if (date) {
        this.bookingState = {
          inProgress: true,
          step: 'awaiting_slot',
          doctorSpec: symptomMatch.department,
          doctorName: symptomMatch.doctorName,
          doctorId: symptomMatch.doctorId,
          date: date
        };

        const availRes = await VoiceToolDispatcher.executeTool('check_doctor_availability', {
          specialtyOrName: symptomMatch.doctorId || symptomMatch.doctorName,
          date: date
        }, context);
        const slots: string[] = availRes.data?.availableSlots || ['10:00 AM', '11:30 AM'];
        this.bookingState.availableSlots = slots;

        let reply = `🩺 **${symptomMatch.department} Specialist: ${symptomMatch.doctorName}**\n📅 Available slots on ${date}:\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Which slot would you prefer?*`;
        let spoken = `Based on your symptoms, ${symptomMatch.department} with ${symptomMatch.doctorName} is recommended. Available slots on ${date} are ${slots.slice(0, 2).join(' and ')}. Which one would you prefer?`;

        if (detectedLang === 'ta-IN') {
          reply = `🩺 **${symptomMatch.department} சிறப்பு மருத்துவர்: ${symptomMatch.doctorName}**\n📅 ${date} அன்று கிடைக்கும் நேரங்கள்:\n${slots.map(s => `• ${s}`).join('\n')}\n\n*எந்த நேரம் உங்களுக்கு வசதியாக இருக்கும்?*`;
          spoken = `உங்கள் அறிகுறிகளுக்கு ${symptomMatch.department} மருத்துவர் ${symptomMatch.doctorName} பொருத்தமானவர். ${date} அன்று ${slots.slice(0, 2).join(' மற்றும் ')} நேரங்கள் உள்ளன. எந்த நேரம் வேண்டும்?`;
        } else if (detectedLang === 'mixed') {
          reply = `🩺 **${symptomMatch.department} Specialist: ${symptomMatch.doctorName}**\n📅 ${date} Available Slots:\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Endha slot venum?*`;
          spoken = `Unga symptoms-ku ${symptomMatch.department} specialist ${symptomMatch.doctorName} suitable. ${date}-la ${slots.slice(0, 2).join(' and ')} slots available. Endha time venum?`;
        } else if (detectedLang === 'hi-IN') {
          reply = `🩺 **${symptomMatch.department} विशेषज्ञ: ${symptomMatch.doctorName}**\n📅 ${date} को उपलब्ध स्लॉट:\n${slots.map(s => `• ${s}`).join('\n')}\n\n*आप कौन सा समय पसंद करेंगे?*`;
          spoken = `आपके लक्षणों के लिए ${symptomMatch.department} विशेषज्ञ ${symptomMatch.doctorName} उपयुक्त हैं। ${date} को ${slots.slice(0, 2).join(' और ')} उपलब्ध हैं। आप कौन सा समय पसंद करेंगे?`;
        }

        return { replyText: reply, spokenReply: spoken, detectedLanguage: detectedLang };
      }

      // No date yet: suggest specialist and ask to book (preserving doctor in state)
      this.bookingState = {
        inProgress: true,
        step: 'awaiting_booking_consent',
        doctorSpec: symptomMatch.department,
        doctorName: symptomMatch.doctorName,
        doctorId: symptomMatch.doctorId,
        symptomTriggered: true
      };

      const resp = symptomMatch.suggestedResponses[detectedLang] || symptomMatch.suggestedResponses.en;
      return {
        replyText: `🩺 **Specialist Recommendation:**\n${resp}`,
        spokenReply: resp,
        detectedLanguage: detectedLang
      };
    }

    // A. Start Appointment Booking
    const isBookingStarter = 
      q.includes('book an appointment') || q.includes('book appointment') || 
      q.includes('appointment book') || q.includes('schedule consultation') ||
      q.includes('schedule appointment') || q.includes('want to book') ||
      q.includes('doctor appointment') ||
      // Tamil Unicode (Comprehensive matching):
      q.includes('அப்பாயிண்ட்மெண்ட்') || q.includes('அப்பாயிண்ட்மென்ட்') ||
      q.includes('முன்பதிவு') || q.includes('புக் பண்ணணும்') ||
      q.includes('புக் செய்ய') || q.includes('டாக்டர் பார்க்க') ||
      q.includes('மருத்துவரை பார்க்க') || q.includes('அப்பாயிண்ட்மென்ட் வேண்டும்') ||
      // Tanglish:
      q.includes('appointment venum') || q.includes('appointment panna') || 
      q.includes('appointment pannanum') || q.includes('doctor appointment venum') ||
      q.includes('doctor paakanum') || q.includes('appointment book panna mudiyuma') ||
      // Hindi Unicode & Romanized:
      q.includes('अपॉइंटमेंट बुक करना है') || q.includes('अपॉइंटमेंट चाहिए') ||
      q.includes('अपॉइंटमेंट') || q.includes('डॉक्टर से मिलना है') ||
      q.includes('डॉक्टर अपॉइंटमेंट चाहिए') || q.includes('appointment book karna hai') ||
      q.includes('doctor appointment chahiye') || q.includes('doctor ka appointment') ||
      q.includes('doctor se milna hai');

    if (isBookingStarter) {
      const doc = findDoctorByQuery(q, MOCK_DOCTORS);
      const spec = doc ? doc.specialization : extractSpecialty(q);
      const monthOnly = detectMonthOnly(q);
      const date = parseDateFromText(q);

      this.bookingState = {
        inProgress: true,
        step: spec ? (date ? 'awaiting_slot' : 'awaiting_date') : 'awaiting_spec',
        doctorSpec: spec,
        doctorName: doc?.name,
        doctorId: doc?.id,
        date: date,
        monthOnlyPreference: monthOnly
      };

      if (!spec) {
        let askSpec = `Certainly! Which doctor would you like to consult, or would you like me to suggest a specialist based on your symptoms?`;
        if (detectedLang === 'ta-IN') {
          askSpec = `உங்களுக்கு எந்த மருத்துவரை சந்திக்க வேண்டும்? எந்தப் பிரிவில் முன்பதிவு செய்ய விரும்புகிறீர்கள்?`;
        } else if (detectedLang === 'mixed') {
          askSpec = `Kandippa! Endha doctor-ah paakanum? Illa unga problem enna-nu sollunga, suitable specialist-ah suggest panren.`;
        } else if (detectedLang === 'hi-IN') {
          askSpec = monthOnly
            ? `आप किस डॉक्टर से मिलना चाहते हैं? मैं अगले महीने की उपलब्ध अपॉइंटमेंट तारीखें देख सकता हूँ।`
            : `आप किस डॉक्टर से मिलना चाहते हैं? किस विभाग में अपॉइंटमेंट बुक करना चाहेंगे?`;
        }
        return { replyText: askSpec, spokenReply: askSpec, detectedLanguage: detectedLang };
      }

      // If user specified month-only (e.g. "I want to book an appointment with Dr. Jane Smith next month")
      if (monthOnly && !date) {
        const docName = doc?.name || `our ${spec} specialist`;
        let askDate = `We have consultations available with ${docName} in ${monthOnly.monthName} ${monthOnly.year}. Which date would you prefer? (For example: ${monthOnly.monthName} 5, ${monthOnly.monthName} 15, or ${monthOnly.monthName} 22)`;
        if (detectedLang === 'ta-IN') {
          askDate = `${docName} மருத்துவரிடம் ${monthOnly.monthName} ${monthOnly.year}-ல் ஆலோசனைகள் உள்ளன. நீங்கள் எந்த தேதியை விரும்புகிறீர்கள்? (உதாரணம்: ${monthOnly.monthName} 5, ${monthOnly.monthName} 15)`;
        } else if (detectedLang === 'mixed') {
          askDate = `${docName}-kitta ${monthOnly.monthName} ${monthOnly.year}-la slots irukku. Entha date-la paaka virumbureenga? (Example: ${monthOnly.monthName} 5, ${monthOnly.monthName} 15)`;
        } else if (detectedLang === 'hi-IN') {
          askDate = `${docName} के साथ ${monthOnly.monthName} ${monthOnly.year} में अपॉइंटमेंट उपलब्ध हैं। आप किस तारीख को आना चाहेंगे? (उदाहरण: ${monthOnly.monthName} 5, ${monthOnly.monthName} 15)`;
        }
        return { replyText: askDate, spokenReply: askDate, detectedLanguage: detectedLang };
      }

      if (!date) {
        const docLabel = doc?.name ? `${doc.name} (${spec})` : spec;
        let askDate = `${docLabel} selected. Which date would you prefer? (e.g. Tomorrow, or a specific date)`;
        if (detectedLang === 'ta-IN') {
          askDate = `${spec} துறை தேர்ந்தெடுக்கப்பட்டது. எந்த தேதியில் நீங்கள் வர விரும்புகிறீர்கள்? (உதாரணம்: நாளை, அல்லது ஒரு குறிப்பிட்ட தேதி)`;
        } else if (detectedLang === 'mixed') {
          askDate = `${spec} select aachu. Entha date-la paaka virumbureenga? (Example: Naalaikku, or specific date)`;
        } else if (detectedLang === 'hi-IN') {
          askDate = `${spec} चुन लिया गया है। आप किस तारीख को आना चाहेंगे? (उदाहरण: कल, या कोई विशेष तारीख)`;
        }
        return { replyText: askDate, spokenReply: askDate, detectedLanguage: detectedLang };
      }

      // If both doctor/spec and date were specified in the first sentence:
      // Query availability and present slots immediately!
      const availRes = await VoiceToolDispatcher.executeTool('check_doctor_availability', {
        specialtyOrName: doc?.id || doc?.name || spec,
        date: date
      }, context);
      const slots: string[] = availRes.data?.availableSlots || ['10:00 AM', '11:30 AM'];
      this.bookingState.availableSlots = slots;
      this.bookingState.step = 'awaiting_slot';

      const docDisplay = doc?.name || `our ${spec} specialist`;
      let reply = `📅 **Available Slots for ${docDisplay} on ${date}:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Which slot would you prefer?*`;
      let spoken = `Available slots for ${docDisplay} on ${date} are ${slots.slice(0, 2).join(' and ')}. Which one would you prefer?`;

      if (detectedLang === 'ta-IN') {
        reply = `📅 **${docDisplay} மருத்துவரிடம் ${date} அன்று கிடைக்கும் நேரங்கள்:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*எந்த நேரம் உங்களுக்கு வசதியாக இருக்கும்?*`;
        spoken = `${date} அன்று ${slots.slice(0, 2).join(' மற்றும் ')} ஆகிய நேரங்கள் உள்ளன. எந்த நேரம் உங்களுக்கு வசதியாக இருக்கும்?`;
      } else if (detectedLang === 'mixed') {
        reply = `📅 **${docDisplay}-kitta ${date} Slots:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*Endha slot venum?*`;
        spoken = `${date}-la ${slots.slice(0, 2).join(' and ')} slots available-ah irukku. Endha time ungalukku venum?`;
      } else if (detectedLang === 'hi-IN') {
        reply = `📅 **${docDisplay} के साथ ${date} को उपलब्ध स्लॉट:**\n${slots.map(s => `• ${s}`).join('\n')}\n\n*आप कौन सा समय पसंद करेंगे?*`;
        spoken = `${date} को उपलब्ध समय: ${slots.slice(0, 2).join(' और ')}। आप कौन सा समय पसंद करेंगे?`;
      }

      return {
        replyText: reply,
        spokenReply: spoken,
        detectedLanguage: detectedLang
      };
    }

    // B. Cancel Appointment
    if (
      q.includes('cancel my appointment') || q.includes('cancel appointment') ||
      q.includes('appointment cancel') || q.includes('cancel panni kudu')
    ) {
      if (!context.currentUser) {
        let notLogged = 'Please log in to your patient account first to manage or cancel appointments.';
        if (detectedLang === 'ta-IN') notLogged = 'அப்பாயிண்ட்மென்ட் ரத்து செய்ய முதலில் உங்கள் நோயாளி கணக்கில் உள்நுழையவும்.';
        else if (detectedLang === 'mixed') notLogged = 'Appointment cancel panna mudhalla patient account-la log in pannunga.';
        else if (detectedLang === 'hi-IN') notLogged = 'अपॉइंटमेंट रद्द करने के लिए कृपया पहले अपने रोगी खाते में लॉगिन करें।';
        return {
          replyText: notLogged,
          spokenReply: notLogged,
          detectedLanguage: detectedLang
        };
      }

      const upcoming = (context.appointments || []).filter(
        a => a.patientId === context.currentUser?.id && a.status === 'Upcoming'
      );

      if (upcoming.length === 0) {
        let msg = "You currently have no upcoming appointments to cancel.";
        if (detectedLang === 'ta-IN') msg = "உங்களுக்கு தற்போது ரத்து செய்ய வேண்டிய வரவிருக்கும் முன்பதிவுகள் எதுவும் இல்லை.";
        else if (detectedLang === 'mixed') msg = "Unga account-la ippo upcoming appointments edhum illa cancel panna.";
        else if (detectedLang === 'hi-IN') msg = "रद्द करने के लिए आपके पास वर्तमान में कोई आगामी अपॉइंटमेंट नहीं है।";
        return { replyText: msg, spokenReply: msg, detectedLanguage: detectedLang };
      }

      const target = upcoming[0];
      this.cancellationState = {
        inProgress: true,
        appointmentId: target.id,
        doctorName: target.doctorName,
        date: target.date,
        time: target.time
      };

      let askConfirm = `Are you sure you want to cancel your upcoming appointment with ${target.doctorName} on ${target.date} at ${target.time}?`;
      let confirmReply = `⚠️ **Confirm Cancellation:**\n• **Doctor:** ${target.doctorName}\n• **Date:** ${target.date} at ${target.time}\n\n**Are you sure you want to cancel this appointment?** *(Say "Yes" to cancel)*`;

      if (detectedLang === 'ta-IN') {
        askConfirm = `${target.doctorName} மருத்துவரிடம் ${target.date} அன்று உள்ள உங்கள் appointment-ஐ ரத்து செய்ய விரும்புகிறீர்களா? (Yes / No)`;
        confirmReply = `⚠️ **முன்பதிவு ரத்து உறுதிப்படுத்தல்:**\n• **மருத்துவர்:** ${target.doctorName}\n• **தேதி:** ${target.date} (${target.time})\n\n**இந்த appointment-ஐ ரத்து செய்யவா?** *(ரத்து செய்ய "ஆம்" எனக் கூறவும்)*`;
      } else if (detectedLang === 'mixed') {
        askConfirm = `${target.doctorName} kitta ${target.date} anikku irukra appointment-ah cancel panna poringala?`;
        confirmReply = `⚠️ **Confirm Cancellation:**\n• **Doctor:** ${target.doctorName}\n• **Date:** ${target.date} at ${target.time}\n\n**Intha appointment-ah cancel pannava?** *("Yes" nu sollunga)*`;
      } else if (detectedLang === 'hi-IN') {
        askConfirm = `क्या आप ${target.doctorName} के साथ ${target.date} को ${target.time} बजे अपनी अपॉइंटमेंट रद्द करना चाहते हैं?`;
        confirmReply = `⚠️ **अपॉइंटमेंट रद्द करने की पुष्टि:**\n• **डॉक्टर:** ${target.doctorName}\n• **तारीख:** ${target.date} (${target.time})\n\n**क्या आप यह अपॉइंटमेंट रद्द करना चाहते हैं?** *(रद्द करने के लिए "हाँ" कहें)*`;
      }

      return {
        replyText: confirmReply,
        spokenReply: askConfirm,
        detectedLanguage: detectedLang
      };
    }

    // C. Reschedule Appointment
    if (q.includes('reschedule my appointment') || q.includes('reschedule appointment') || q.includes('change appointment time')) {
      if (!context.currentUser) {
        let msg = 'Please log in to reschedule your appointment.';
        if (detectedLang === 'ta-IN') msg = 'அப்பாயிண்ட்மென்ட் மாற்றி அமைக்க முதலில் உள்நுழையவும்.';
        else if (detectedLang === 'mixed') msg = 'Appointment reschedule panna login pannunga.';
        else if (detectedLang === 'hi-IN') msg = 'अपॉइंटमेंट बदलने के लिए कृपया लॉगिन करें।';
        return {
          replyText: msg,
          spokenReply: msg,
          detectedLanguage: detectedLang
        };
      }
      this.bookingState = { inProgress: true, step: 'awaiting_spec' };
      let ask = "Sure! Which doctor or department would you like to reschedule?";
      if (detectedLang === 'ta-IN') ask = "நிச்சயமாக! எந்த மருத்துவர் அல்லது துறையை மாற்றி அமைக்க வேண்டும்?";
      else if (detectedLang === 'mixed') ask = "Sure! Entha doctor illa department reschedule pannanum?";
      else if (detectedLang === 'hi-IN') ask = "ज़रूर! आप किस डॉक्टर या विभाग की अपॉइंटमेंट बदलना चाहते हैं?";
      return { replyText: ask, spokenReply: ask, detectedLanguage: detectedLang };
    }

    // D. Allowed Service 3: Doctor Information & Availability
    const isDoctorInfoQuery = 
      q.includes('who is') || q.includes('doctor name') || q.includes('doctor list') ||
      q.includes('doctors list') || q.includes('our doctors') || q.includes('doctor profile') ||
      q.includes('about dr') || q.includes('about doctor') || q.includes('tell me about dr') ||
      q.includes('doctor availability') || q.includes('doctor timings') || q.includes('is doctor available') ||
      q.includes('doctor eppo') || q.includes('doctor irukkangala') || q.includes('டாக்டர் இருக்கிறாரா') ||
      q.includes('மருத்துவர் விவரம்') || q.includes('டாக்டர்கள் யார்') || q.includes('doctor available hai') ||
      q.includes('doctor kab aayenge') || q.includes('who is the doctor') || q.includes('specialist') ||
      q.includes('doctors in');

    if (isDoctorInfoQuery) {
      // 1. Check if user is asking about doctor availability specifically
      if (q.includes('availability') || q.includes('timings') || q.includes('available') || q.includes('eppo') || q.includes('kab')) {
        const toolRes = await VoiceToolDispatcher.executeTool('check_doctor_availability', {
          specialtyOrName: q
        }, context);
        return { replyText: toolRes.message, spokenReply: toolRes.spokenFeedback, detectedLanguage: detectedLang, toolCallResult: toolRes };
      }

      // 2. Check if a specific doctor or specialty is mentioned
      const matchedDoc = this.matchDoctorFromText(q);
      if (matchedDoc) {
        let reply = `👨‍⚕️ **Doctor Profile: ${matchedDoc.name}**\n• **Specialization:** ${matchedDoc.specialization}\n• **Experience:** ${matchedDoc.experience} years\n• **Availability:** ${matchedDoc.availability}\n• **Bio:** ${matchedDoc.bio}\n\n*Would you like to book an appointment with ${matchedDoc.name}?*`;
        let spoken = `${matchedDoc.name} is a specialist in ${matchedDoc.specialization} with ${matchedDoc.experience} years of experience. Available during ${matchedDoc.availability}. Would you like to book an appointment?`;

        if (detectedLang === 'ta-IN') {
          reply = `👨‍⚕️ **மருத்துவர் விவரம்: ${matchedDoc.name}**\n• **துறை:** ${matchedDoc.specialization}\n• **அனுபவம்:** ${matchedDoc.experience} ஆண்டுகள்\n• **நேரம்:** ${matchedDoc.availability}\n• **விவரம்:** ${matchedDoc.bio}\n\n*நீங்கள் ${matchedDoc.name} மருத்துவரிடம் appointment book செய்ய விரும்புகிறீர்களா?*`;
          spoken = `${matchedDoc.name} மருத்துவர் ${matchedDoc.specialization} துறையில் ${matchedDoc.experience} ஆண்டுகள் அனுபவம் கொண்டவர். இவரிடம் நீங்கள் appointment முன்பதிவு செய்ய விரும்புகிறீர்களா?`;
        } else if (detectedLang === 'mixed') {
          reply = `👨‍⚕️ **Doctor Profile: ${matchedDoc.name}**\n• **Specialization:** ${matchedDoc.specialization}\n• **Experience:** ${matchedDoc.experience} years\n• **Availability:** ${matchedDoc.availability}\n\n*${matchedDoc.name}-kitta appointment book panna virumbureengala?*`;
          spoken = `${matchedDoc.name} avar ${matchedDoc.specialization} specialist. ${matchedDoc.experience} years experience irukku. Appointment book panna sollunga.`;
        } else if (detectedLang === 'hi-IN') {
          reply = `👨‍⚕️ **डॉक्टर प्रोफ़ाइल: ${matchedDoc.name}**\n• **विशेषज्ञता:** ${matchedDoc.specialization}\n• **अनुभव:** ${matchedDoc.experience} वर्ष\n• **उपलब्धता:** ${matchedDoc.availability}\n• **परिचय:** ${matchedDoc.bio}\n\n*क्या आप ${matchedDoc.name} के साथ अपॉइंटमेंट बुक करना चाहते हैं?*`;
          spoken = `${matchedDoc.name} ${matchedDoc.specialization} के विशेषज्ञ हैं। क्या आप इनके साथ अपॉइंटमेंट बुक करना चाहते हैं?`;
        }

        return { replyText: reply, spokenReply: spoken, detectedLanguage: detectedLang };
      }

      // 3. General Doctors List
      const docListStr = MOCK_DOCTORS.map(d => `• **${d.name}** - ${d.specialization} (${d.experience} yrs exp)`).join('\n');
      const spokenDocs = MOCK_DOCTORS.map(d => `${d.name}, ${d.specialization}`).join('. ');

      let reply = `🏥 **Our Hospital Medical Specialists:**\n${docListStr}\n\n*You can ask about any doctor or say "Book an appointment" to schedule a visit.*`;
      let spoken = `Our medical specialists include ${spokenDocs}. Which doctor or department would you like to consult?`;

      if (detectedLang === 'ta-IN') {
        reply = `🏥 **எங்கள் மருத்துவமனை மருத்துவர்கள் பட்டியல்:**\n${docListStr}\n\n*நீங்கள் குறிப்பிட்ட மருத்துவரைப் பற்றி கேட்கலாம் அல்லது "Appointment முன்பதிவு செய்ய" என்று கூறலாம்.*`;
        spoken = `எங்கள் சிறப்பு மருத்துவர்கள் விவரங்கள் உள்ளன. எந்த மருத்துவரிடம் நீங்கள் ஆலோசனை பெற விரும்புகிறீர்கள்?`;
      } else if (detectedLang === 'mixed') {
        reply = `🏥 **Hospital Specialists List:**\n${docListStr}\n\n*Entha doctor-ah consult panna virumbureenga?*`;
        spoken = `Namma hospital-la Cardiology, Pediatrics, Neurology, Orthopedics, Dentistry, General Medicine koodave 10 specialists irukaanga. Yaarai consult panna virumbureenga?`;
      } else if (detectedLang === 'hi-IN') {
        reply = `🏥 **हमारे अस्पताल के विशेषज्ञ डॉक्टर:**\n${docListStr}\n\n*आप किसी भी डॉक्टर के बारे में पूछ सकते हैं या अपॉइंटमेंट बुक करने के लिए कह सकते हैं।*`;
        spoken = `हमारे यहाँ 10 विशेषज्ञ डॉक्टर उपलब्ध हैं। आप किस डॉक्टर से परामर्श लेना चाहते हैं?`;
      }

      return { replyText: reply, spokenReply: spoken, detectedLanguage: detectedLang };
    }

    // E. Check My Appointments (Personal Appointments)
    if (q.includes('my appointment') || q.includes('upcoming appointments') || q.includes('ennoda appointment') || q.includes('mera appointment') || q.includes('என் அப்பாயிண்ட்மெண்ட்')) {
      if (!context.currentUser) {
        let msg = 'Please log in to your patient account first to view your scheduled appointments.';
        if (detectedLang === 'ta-IN') msg = 'உங்கள் அப்பாயிண்ட்மென்ட்களைப் பார்க்க முதலில் உள்நுழையவும்.';
        else if (detectedLang === 'mixed') msg = 'Unga appointments paaka mudhalla patient account-la login pannunga.';
        else if (detectedLang === 'hi-IN') msg = 'अपनी अपॉइंटमेंट देखने के लिए कृपया पहले लॉगिन करें।';
        return { replyText: msg, spokenReply: msg, detectedLanguage: detectedLang };
      }
      const toolRes = await VoiceToolDispatcher.executeTool('get_my_appointments', {}, context);
      return { replyText: toolRes.message, spokenReply: toolRes.spokenFeedback, detectedLanguage: detectedLang, toolCallResult: toolRes };
    }

    // F. Allowed Service 2: Patient Assistance (Wheelchair, General Assistance, Reception/Staff)
    if (
      q.includes('wheelchair') || q.includes('wheel chair') || q.includes('வீல்சேர்') || q.includes('व्हीलचेयर') ||
      q.includes('assistance') || q.includes('உதவி') || q.includes('सहायता') ||
      q.includes('human') || q.includes('talk to someone') || q.includes('helpdesk') ||
      q.includes('reception') || q.includes('hospital staff') || q.includes('staff')
    ) {
      if (q.includes('human') || q.includes('talk to someone') || q.includes('helpdesk') || q.includes('reception') || q.includes('staff')) {
        const toolRes = await VoiceToolDispatcher.executeTool('connect_human_assistance', {}, context);
        return { replyText: toolRes.message, spokenReply: toolRes.spokenFeedback, detectedLanguage: detectedLang, toolCallResult: toolRes };
      }

      const type = (q.includes('wheelchair') || q.includes('wheel chair') || q.includes('வீல்சேர்') || q.includes('व्हीलचेयर')) ? 'wheelchair' : 'general';
      const location = q.includes('parking') ? 'Accessible Car Parking' : q.includes('emergency') ? 'Emergency Bay' : q.includes('elevator') ? 'Elevator Lobby' : 'Main Entrance Ramps';
      const toolRes = await VoiceToolDispatcher.executeTool('request_hospital_assistance', {
        assistanceType: type,
        location: location
      }, context);
      return { replyText: toolRes.message, spokenReply: toolRes.spokenFeedback, detectedLanguage: detectedLang, toolCallResult: toolRes };
    }

    // Fallback: Invoke MediBot Knowledge Base for general hospital queries
    try {
      const chatbotReply = await getChatbotResponse(transcript, {
        users: context.users || [],
        medicines: context.medicines || [],
        appointments: context.appointments || []
      }, history);
      if (chatbotReply && chatbotReply.trim()) {
        const spoken = chatbotReply.replace(/[*#_`~>•]/g, '').replace(/\n+/g, ' ').trim();
        return {
          replyText: chatbotReply,
          spokenReply: spoken,
          detectedLanguage: detectedLang
        };
      }
    } catch (e) {
      console.warn('Fallback to hospital knowledge base failed:', e);
    }

    // Default Fallback (Strictly allowed services only: Appointments, Assistance, Doctor Info)
    const defaultMsg = detectedLang === 'ta-IN'
      ? "வணக்கம்! நான் MediConnect AI உதவியாளர். நீங்கள் மருத்துவர் ஆலோசனை முன்பதிவு செய்யலாம், நோயாளி உதவி கோரலாம், அல்லது மருத்துவர்கள் பற்றிய தகவல்களை பெறலாம். நான் உங்களுக்கு எவ்வாறு உதவ வேண்டும்?"
      : detectedLang === 'mixed'
      ? "Vanakkam! Naan MediConnect AI Assistant. Neenga doctor appointment book panna, wheelchair/patient assistance kettu vanga, illa doctor information therinjukka mudiyum. Ungalukku eppadi udhava vendum?"
      : detectedLang === 'hi-IN'
      ? "नमस्ते! मैं आपका MediConnect AI सहायक हूँ। आप डॉक्टर अपॉइंटमेंट बुक कर सकते हैं, रोगी सहायता मांग सकते हैं या डॉक्टरों की जानकारी प्राप्त कर सकते हैं। मैं आपकी क्या मदद करूँ?"
      : "Hello! I am your MediConnect Assistant. You can ask me to book doctor appointments, request patient or wheelchair assistance, or enquire about our doctors. How can I help you?";

    return {
      replyText: defaultMsg,
      spokenReply: defaultMsg,
      detectedLanguage: detectedLang
    };
  }

  // -------------------------------------------------------------
  // Internal Helpers for Language & Text Parsing
  // -------------------------------------------------------------
  private detectLanguage(transcript: string, fallback: VoiceLanguage): VoiceLanguage {
    const isTamilUnicode = /[\u0B80-\u0BFF]/.test(transcript);
    if (isTamilUnicode) return 'ta-IN';

    const isHindiUnicode = /[\u0900-\u097F]/.test(transcript);
    if (isHindiUnicode) return 'hi-IN';

    const lower = transcript.toLowerCase().trim();

    // Explicit Language Switching
    if (
      lower.includes('speak in tamil') || lower.includes('switch to tamil') ||
      lower.includes('tamil-la pesu') || lower.includes('tamizh-la pesu') ||
      lower.includes('tamil la pesu') || lower.includes('tamil please')
    ) {
      return 'ta-IN';
    }

    if (
      lower.includes('speak in hindi') || lower.includes('switch to hindi') ||
      lower.includes('hindi me bolo') || lower.includes('hindi me baat') ||
      lower.includes('hindi please')
    ) {
      return 'hi-IN';
    }

    if (
      lower.includes('speak in tanglish') || lower.includes('switch to tanglish') ||
      lower.includes('tanglish-la pesu') || lower.includes('tanglish la pesu') ||
      lower.includes('tanglish please')
    ) {
      return 'mixed';
    }

    if (
      lower.includes('speak in english') || lower.includes('switch to english') ||
      lower.includes('english please') || lower.includes('talk in english')
    ) {
      return 'en-IN';
    }

    const tanglishKeywords = [
      'vanakkam', 'ennoda', 'irukku', 'irukkangala', 'panna', 'pannanum', 'mudiyuma', 'mudiyum',
      'eppo', 'eppodhu', 'marunthu', 'venum', 'aama', 'vendaam', 'peru', 'enga',
      'epdi', 'vazhi', 'kudunga', 'paakanum', 'ungalukku', 'neenga', 'yaaru', 'enna',
      'enakku', 'mattum', 'dhaan', 'matha', 'pannunga', 'solleenga', 'valikuthu', 'valikkuthu',
      'vali', 'pallu', 'pal', 'mutti', 'kuzhandhai', 'kaachal', 'sali', 'udambu', 'naalaikku',
      'endha', 'kitta', 'sollunga', 'koodave', 'therinjukka', 'paaka', 'kaal', 'muthugu'
    ];
    if (tanglishKeywords.some(kw => lower.includes(kw))) {
      return 'mixed';
    }

    const hinglishKeywords = [
      'namaste', 'kaun', 'chahiye', 'karna', 'karni', 'batao', 'dawa', 'milna', 'kahan',
      'aaj', 'kal', 'apna', 'naam', 'kaise', 'mujhe', 'karo', 'hoga', 'mera', 'meri',
      'dard', 'ghutne', 'daant', 'bukhar', 'sardi', 'hai', 'bhi', 'kya', 'nahi', 'haan',
      'theek', 'aapka', 'chhattee', 'seene', 'bachhe', 'bacha'
    ];
    if (hinglishKeywords.some(kw => lower.includes(kw))) {
      return 'hi-IN';
    }

    // If user explicitly asks a new command/question in English
    const englishSentenceStarters = [
      'what is', 'who is', 'how can', 'i want', 'can i', 'book an', 'book a', 'cancel my',
      'reschedule my', 'tell me', 'show me', 'open ', 'where is', 'guide me', 'connect me',
      'i need', 'i have', 'my knee', 'my tooth', 'teeth alignment'
    ];
    if (englishSentenceStarters.some(starter => lower.startsWith(starter) || lower.includes(starter))) {
      return 'en-IN';
    }

    // Retain existing active language during multi-turn slot/confirmation answers (e.g. "Tomorrow", "Yes", "10 AM", "December 15")
    if (fallback) {
      return fallback;
    }

    return 'en-IN';
  }

  private matchDoctorFromText(text: string) {
    return findDoctorByQuery(text, MOCK_DOCTORS);
  }

  private extractSpecialty(text: string): string | undefined {
    return extractSpecialty(text);
  }

  private parseDateFromText(text: string): string | undefined {
    return parseDateFromText(text, new Date(), this.bookingState.monthOnlyPreference);
  }

  private parseTimeFromText(text: string, availableSlots?: string[]): string {
    return parseTimeFromText(text, availableSlots);
  }
}
