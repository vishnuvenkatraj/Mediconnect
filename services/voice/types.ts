import type { User, Appointment, Medicine, LabTest, Page, Prescription, Invoice } from '../../types';

export type VoiceLanguage = 'en-IN' | 'ta-IN' | 'hi-IN' | 'mixed'; // mixed = Tanglish / Hinglish

export type VoiceSessionState = 
  | 'idle'
  | 'requesting_permission'
  | 'permission_denied'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'waiting_for_user'
  | 'task_in_progress'
  | 'task_completed'
  | 'paused'
  | 'error';

export interface VoiceMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  language?: VoiceLanguage;
  timestamp: string;
  toolCall?: {
    name: string;
    params: Record<string, any>;
    result?: any;
    status: 'pending' | 'success' | 'failed';
  };
}

export interface VoiceToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface VoiceToolExecutionContext {
  currentUser: User | null;
  users?: User[];
  appointments: Appointment[];
  setAppointments?: React.Dispatch<React.SetStateAction<Appointment[]>>;
  medicines: Medicine[];
  setMedicines?: React.Dispatch<React.SetStateAction<Medicine[]>>;
  prescriptions?: Prescription[];
  setPrescriptions?: React.Dispatch<React.SetStateAction<Prescription[]>>;
  labTests: LabTest[];
  setLabTests?: React.Dispatch<React.SetStateAction<LabTest[]>>;
  invoices?: Invoice[];
  onNavigate: (page: Page) => void;
  onNavigatePatientTab?: (tab: string) => void;
  saveAppointment?: (app: Appointment) => Promise<void> | void;
  updateAppointment?: (id: string, updates: Partial<Appointment>) => Promise<void> | void;
}

export interface VoiceToolExecutionResult {
  toolName: string;
  success: boolean;
  message: string;
  spokenFeedback: string;
  data?: any;
  action?: {
    type: string;
    label: string;
    targetPage?: Page;
    targetTab?: string;
  };
}

export interface VoiceProviderConfig {
  provider: 'sarvam' | 'webspeech_gemini' | 'auto';
  language: VoiceLanguage;
  speechRate?: number;
  speechPitch?: number;
  autoSpeakResponse?: boolean;
  continuousMode?: boolean;
}
