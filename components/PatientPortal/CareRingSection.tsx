import React, { useState, useEffect } from 'react';
import type { User, QueueEntry, Appointment, CareRingBeacon } from '../../types';

interface CareRingSectionProps {
  user: User;
  queueEntry?: QueueEntry;
  appointments?: Appointment[];
}

export const CareRingSection: React.FC<CareRingSectionProps> = ({ user, queueEntry, appointments }) => {
  const [companionPin, setCompanionPin] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`carering_pin_${user.id}`);
      return saved || 'CR-7824';
    } catch {
      return 'CR-7824';
    }
  });

  const [lastHeartbeat, setLastHeartbeat] = useState<string>(() => {
    try {
      return localStorage.getItem(`carering_heartbeat_${user.id}`) || 'Just now';
    } catch {
      return 'Just now';
    }
  });

  const [heartbeatSentFeedback, setHeartbeatSentFeedback] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const handleSendHeartbeat = () => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLastHeartbeat(timeStr);
    try {
      localStorage.setItem(`carering_heartbeat_${user.id}`, timeStr);
    } catch {}

    setHeartbeatSentFeedback(true);
    setTimeout(() => setHeartbeatSentFeedback(false), 3000);
  };

  const handleRegeneratePin = () => {
    const newPin = `CR-${Math.floor(1000 + Math.random() * 9000)}`;
    setCompanionPin(newPin);
    try {
      localStorage.setItem(`carering_pin_${user.id}`, newPin);
    } catch {}
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      const shareUrl = `${window.location.origin}?carering=${companionPin}&patient=${encodeURIComponent(user.name)}`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Determine current ambient hospital milestone
  const currentStatusLabel = queueEntry?.status === 'In Consultation'
    ? `In Consultation with ${queueEntry.doctorName}`
    : queueEntry?.status === 'Your Turn'
    ? `Entering Consultation Room (${queueEntry.roomNumber})`
    : queueEntry
    ? `In Waiting Atrium (Token ${queueEntry.tokenNumber})`
    : 'Hospital Care Visit Active';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-primary text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
              CareRing™ Guardian
            </span>
            <span className="text-xs text-blue-100 font-medium">Family Telemetry & Peace of Mind</span>
          </div>
          <h3 className="text-2xl font-black mt-1">Ambient Family Guardian Beacon</h3>
          <p className="text-xs text-blue-100 mt-1 max-w-xl leading-relaxed">
            Keeps your family caregivers informed of your hospital journey in real time — with zero privacy intrusion or medical record exposure.
          </p>
        </div>

        {/* 1-Tap Heartbeat Button */}
        <button
          onClick={handleSendHeartbeat}
          className="bg-white text-primary hover:bg-blue-50 font-black py-3 px-6 rounded-2xl shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 self-start md:self-auto"
        >
          <span className="text-xl">❤️</span>
          <span>Send "I'm Doing Great" Ping</span>
        </button>
      </div>

      {heartbeatSentFeedback && (
        <div className="p-4 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm font-bold flex items-center justify-between animate-fadeIn">
          <span>✓ Reassurance heartbeat broadcast to your CareRing family!</span>
          <span className="text-xs text-emerald-700 dark:text-emerald-400">Timestamp: {lastHeartbeat}</span>
        </div>
      )}

      {/* Main Grid: Beacon Details + Live Ambient Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Companion Access Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
              <span>🔑</span>
              <span>Companion Access Pass</span>
            </h4>
            <span className="text-[10px] uppercase font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 px-2.5 py-0.5 rounded-full">
              Private PIN
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Share this companion PIN with a spouse, child, or caregiver. They can follow your hospital check-in milestones without logging into your full account.
          </p>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-center">
            <span className="text-xs uppercase font-extrabold tracking-wider text-gray-400">Your CareRing PIN</span>
            <div className="text-3xl font-black text-primary dark:text-blue-400 tracking-widest mt-1">
              {companionPin}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex-1 bg-primary text-white font-bold py-2.5 px-3 rounded-xl text-xs hover:bg-primary/90 transition shadow-sm text-center"
            >
              {copiedLink ? '✓ Link Copied!' : '📋 Copy Caregiver Share Link'}
            </button>
            <button
              onClick={handleRegeneratePin}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-white"
              title="Generate new PIN"
            >
              🔄
            </button>
          </div>

          <button
            onClick={() => setIsPreviewModalOpen(true)}
            className="w-full text-center text-xs font-bold text-primary dark:text-blue-400 hover:underline pt-2 block"
          >
            👁️ Preview what my family sees →
          </button>
        </div>

        {/* Ambient Timeline Feed */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                <span>📡</span>
                <span>Active Journey Milestones</span>
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Real-time ambient pulse visible to your designated CareRing circle.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Beacon Live</span>
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {/* Milestone 1 */}
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                ✓
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-sm text-gray-900 dark:text-white">Hospital Arrival & OPD Check-In</h5>
                  <span className="text-xs text-gray-500">09:15 AM</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                  Checked in at Main Reception & entered consultation queue.
                </p>
              </div>
            </div>

            {/* Milestone 2: Current Status */}
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-400 dark:border-blue-700 flex items-start gap-3 animate-pulse">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                ●
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-sm text-blue-950 dark:text-blue-200">
                    {currentStatusLabel}
                  </h5>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Current Phase</span>
                </div>
                <p className="text-xs text-blue-800 dark:text-blue-300 mt-0.5">
                  {queueEntry?.roomNumber ? `Consultation Suite: ${queueEntry.roomNumber}` : 'Consultation in progress.'}
                </p>
              </div>
            </div>

            {/* Milestone 3: Heartbeat */}
            <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                ❤️
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-sm text-gray-900 dark:text-white">Patient "I'm OK" Ping</h5>
                  <span className="text-xs text-gray-500">{lastHeartbeat}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                  {user.name} sent a reassuring heartbeat: "Feeling good & in good hands."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Caregiver Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-dark-card border border-blue-500/30 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>🛡️</span>
                <h4 className="font-bold text-sm">Caregiver Companion View</h4>
              </div>
              <button onClick={() => setIsPreviewModalOpen(false)} className="text-white/80 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto">
                ❤️
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{user.name}'s Care Status</h3>
                <p className="text-xs text-emerald-600 font-semibold mt-0.5">All Systems Reassuring & On Schedule</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-bg text-left text-xs space-y-1.5 border border-gray-200 dark:border-dark-border">
                <p><strong>Current Step:</strong> {currentStatusLabel}</p>
                <p><strong>Last Heartbeat Sent:</strong> {lastHeartbeat}</p>
                <p className="text-[11px] text-gray-400 pt-1 border-t dark:border-dark-border">
                  🔒 Confidential medical diagnoses and lab results are private to the patient.
                </p>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="w-full bg-primary text-white font-bold py-2 rounded-xl text-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CareRingSection;
