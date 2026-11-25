import React, { useState, useMemo } from 'react';
import type { User, Appointment, Medicine, LabTest, Page } from '../../types';
import { VoiceSessionManager } from '../../services/voice/VoiceSessionManager';
import VoiceButton from './VoiceButton';
import VoiceConversationPanel from './VoiceConversationPanel';

interface VoiceAssistantProps {
  currentUser: User | null;
  appointments: Appointment[];
  setAppointments?: React.Dispatch<React.SetStateAction<Appointment[]>>;
  medicines: Medicine[];
  labTests: LabTest[];
  onNavigate: (page: Page) => void;
  onNavigatePatientTab?: (tab: string) => void;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  currentUser,
  appointments,
  setAppointments,
  medicines,
  labTests,
  onNavigate,
  onNavigatePatientTab,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionState, setSessionState] = useState(sessionManager => sessionManager.getState());
  const [language, setLanguage] = useState(sessionManager => sessionManager.getLanguage());

  // Instantiate singleton VoiceSessionManager
  const sessionManager = useMemo(() => {
    return new VoiceSessionManager({
      provider: 'sarvam', // Tries Sarvam, automatically falls back to WebSpeech
      language: 'mixed',  // Tanglish/Mixed by default
    });
  }, []);

  // Sync state & language for button
  React.useEffect(() => {
    const unsubState = sessionManager.subscribeState(setSessionState);
    return () => unsubState();
  }, [sessionManager]);

  const executionContext = useMemo(() => ({
    currentUser,
    appointments,
    setAppointments,
    medicines,
    labTests,
    onNavigate,
    onNavigatePatientTab,
  }), [currentUser, appointments, setAppointments, medicines, labTests, onNavigate, onNavigatePatientTab]);

  return (
    <>
      <VoiceButton
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        state={sessionState}
        language={sessionManager.getLanguage()}
      />

      <VoiceConversationPanel
        sessionManager={sessionManager}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        context={executionContext}
      />
    </>
  );
};

export default VoiceAssistant;
