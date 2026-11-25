import React, { useState } from 'react';
import type { User, RecoveryJourney } from '../../types';

interface RecoveryPathwaysSectionProps {
  user: User;
  onNavigateTab?: (tab: string) => void;
}

const SAMPLE_JOURNEYS: RecoveryJourney[] = [
  {
    id: 'journey_cardio',
    category: 'Cardiovascular',
    title: 'Post-Cardiology & Heart Rhythm Rehabilitation',
    totalDays: 30,
    currentDay: 5,
    completionPercentage: 45,
    overview: 'A gentle, progressive recovery plan focused on safe cardiovascular mobilization and medication stability.',
    milestones: [
      {
        dayNumber: 1,
        dayLabel: 'Day 1–2',
        title: 'Immediate Post-Procedure Rest',
        description: 'Prioritize physical rest, elevate extremities if indicated, and log baseline blood pressure.',
        targetActivity: 'Bedside rest and gentle ankle rotations.',
        completed: true,
        normalSymptoms: ['Mild fatigue', 'Slight soreness near entry site', 'Drowsiness'],
        redFlagSymptoms: ['Chest tightness or burning', 'Dizziness when standing', 'Irregular racing pulse']
      },
      {
        dayNumber: 3,
        dayLabel: 'Day 3–4',
        title: 'Gentle Mobilization & Hydration',
        description: 'Initiate slow indoor pacing. Drink 2 liters of water daily to maintain renal clearance.',
        targetActivity: '5–10 minutes of slow hallway walking twice daily.',
        completed: true,
        normalSymptoms: ['Occasional light muscle stiffness', 'Slow appetite return'],
        redFlagSymptoms: ['Shortness of breath with minimal exertion', 'Swelling in both ankles']
      },
      {
        dayNumber: 5,
        dayLabel: 'Day 5–7',
        title: 'Active Mobility & Medication Routine (Today)',
        description: 'Solidify your morning and evening medication schedule. Avoid heavy lifting (>5 kg).',
        targetActivity: '15 minutes of uninterrupted gentle walking on level surface.',
        completed: false,
        normalSymptoms: ['Normal energy variations between morning and evening'],
        redFlagSymptoms: ['Persistent headache with blood pressure > 150/95', 'Sudden visual blurriness']
      },
      {
        dayNumber: 14,
        dayLabel: 'Day 14',
        title: 'Mid-Recovery Vitality Checkpoint',
        description: 'Review adherence logs and prepare questions for your 2-week clinical follow-up.',
        targetActivity: '20–25 minutes of steady walking and gentle stretching.',
        completed: false,
        normalSymptoms: ['Steadily improving stamina'],
        redFlagSymptoms: ['Any return of original pre-procedure chest symptoms']
      },
      {
        dayNumber: 30,
        dayLabel: 'Day 30',
        title: 'Full Functional Milestone',
        description: 'Gradual return to normal daily activities under your cardiologist’s verified clearance.',
        targetActivity: '30 minutes of aerobic movement 4–5 days per week.',
        completed: false,
        normalSymptoms: ['Restored baseline vitality'],
        redFlagSymptoms: ['Unexplained palpitations or sudden fatigue']
      }
    ]
  },
  {
    id: 'journey_ortho',
    category: 'Orthopedic',
    title: 'Sprain, Fracture & Joint Recovery Pathway',
    totalDays: 21,
    currentDay: 4,
    completionPercentage: 35,
    overview: 'Structured mobilization, edema reduction, and progressive range-of-motion restoration.',
    milestones: [
      {
        dayNumber: 1,
        dayLabel: 'Day 1–3',
        title: 'PRICE Protocol & Swelling Control',
        description: 'Protect, Rest, Ice, Compress, and Elevate the affected joint above heart level.',
        targetActivity: 'Cold therapy 15 minutes every 3–4 hours; non-weight-bearing.',
        completed: true,
        normalSymptoms: ['Localized swelling', 'Bruising turning purple-yellow', 'Aching pain'],
        redFlagSymptoms: ['Severe numbness or tingling in toes/fingers', 'Skin turning pale or cold']
      },
      {
        dayNumber: 7,
        dayLabel: 'Day 7',
        title: 'Assisted Partial Weight Bearing',
        description: 'Begin passive range-of-motion movements as guided by physical therapy.',
        targetActivity: 'Gentle joint flexions within pain-free boundaries.',
        completed: false,
        normalSymptoms: ['Mild tightness at edge of motion'],
        redFlagSymptoms: ['Inability to bear any touch', 'Sudden hot, red localized swelling']
      },
      {
        dayNumber: 21,
        dayLabel: 'Day 21',
        title: 'Full Range & Strength Reconditioning',
        description: 'Resistance-band exercises and progression to independent gait.',
        targetActivity: 'Full unassisted walking and daily functional stability.',
        completed: false,
        normalSymptoms: ['Occasional stiffness with cold weather'],
        redFlagSymptoms: ['Joint instability or sensation of giving way']
      }
    ]
  },
  {
    id: 'journey_respiratory',
    category: 'Respiratory',
    title: 'Acute Respiratory & Viral Recovery Pathway',
    totalDays: 14,
    currentDay: 6,
    completionPercentage: 60,
    overview: 'Airway clearance, oxygen conservation, and pulmonary endurance rebuilding.',
    milestones: [
      {
        dayNumber: 1,
        dayLabel: 'Day 1–3',
        title: 'Fever Resolution & Hydration',
        description: 'Rest, warm fluids, and antipyretics to break fever cycle.',
        targetActivity: 'Strict rest and steam inhalation.',
        completed: true,
        normalSymptoms: ['Dry cough', 'Mild throat tickle', 'General fatigue'],
        redFlagSymptoms: ['Oxygen saturation < 93%', 'Stridor or whistling when breathing in']
      },
      {
        dayNumber: 7,
        dayLabel: 'Day 7',
        title: 'Diaphragmatic Expansion & Light Activity',
        description: 'Deep breathing practice to re-expand lower lung lobes.',
        targetActivity: 'Box breathing and light indoor movement.',
        completed: true,
        normalSymptoms: ['Occasional productive morning cough clearing mucus'],
        redFlagSymptoms: ['Chest pain that worsens with deep breathing', 'Fever spike after Day 5']
      },
      {
        dayNumber: 14,
        dayLabel: 'Day 14',
        title: 'Complete Respiratory Resilience',
        description: 'Normal pulmonary capacity restored.',
        targetActivity: 'Return to full cardiovascular walking.',
        completed: false,
        normalSymptoms: ['Mild vocal fatigue with extended talking'],
        redFlagSymptoms: ['Lingering shortness of breath during normal conversation']
      }
    ]
  }
];

export const RecoveryPathwaysSection: React.FC<RecoveryPathwaysSectionProps> = ({ user, onNavigateTab }) => {
  const [journeys, setJourneys] = useState<RecoveryJourney[]>(SAMPLE_JOURNEYS);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>(SAMPLE_JOURNEYS[0].id);
  const [activeMilestoneIndex, setActiveMilestoneIndex] = useState<number>(2); // Default to "Today" milestone

  const activeJourney = journeys.find(j => j.id === selectedJourneyId) || journeys[0];
  const activeMilestone = activeJourney.milestones[activeMilestoneIndex] || activeJourney.milestones[0];

  const handleToggleMilestone = (mIndex: number) => {
    setJourneys(prev =>
      prev.map(j => {
        if (j.id !== selectedJourneyId) return j;
        const updatedMilestones = [...j.milestones];
        updatedMilestones[mIndex] = {
          ...updatedMilestones[mIndex],
          completed: !updatedMilestones[mIndex].completed
        };

        const completedCount = updatedMilestones.filter(m => m.completed).length;
        const newPct = Math.round((completedCount / updatedMilestones.length) * 100);

        return {
          ...j,
          milestones: updatedMilestones,
          completionPercentage: newPct
        };
      })
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-800 via-indigo-800 to-primary text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
              Recovery Pathways™
            </span>
            <span className="text-xs text-purple-200 font-medium">Post-Care Healing Roadmap</span>
          </div>
          <h3 className="text-2xl font-black mt-1">Guided Healing Milestones</h3>
          <p className="text-xs text-purple-100 mt-1 max-w-xl leading-relaxed">
            Recovery happens day by day at home. Follow your personalized post-care roadmap, check off daily targets, and know what symptoms are normal versus red flags.
          </p>
        </div>

        {/* Progress Ring Card */}
        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 flex items-center gap-3 self-start md:self-auto">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-purple-200">Recovery Progress</p>
            <p className="text-2xl font-black text-white">{activeJourney.completionPercentage}%</p>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin-slow flex items-center justify-center font-black text-xs">
            🏁
          </div>
        </div>
      </div>

      {/* Pathway Switcher Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {journeys.map(j => (
          <button
            key={j.id}
            onClick={() => {
              setSelectedJourneyId(j.id);
              setActiveMilestoneIndex(0);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
              j.id === selectedJourneyId
                ? 'bg-primary text-white shadow-md'
                : 'bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border hover:bg-gray-50'
            }`}
          >
            <span>{j.category === 'Cardiovascular' ? '🫀' : j.category === 'Orthopedic' ? '🦴' : '🦠'}</span>
            <span>{j.title}</span>
          </button>
        ))}
      </div>

      {/* Journey Overview & Interactive Timeline */}
      <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-sm space-y-6">
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-bold text-base text-gray-900 dark:text-white">{activeJourney.title}</h4>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {activeJourney.totalDays}-Day Journey • Day {activeJourney.currentDay} Current
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{activeJourney.overview}</p>
        </div>

        {/* Milestone Steps Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {activeJourney.milestones.map((m, idx) => {
            const isSelected = idx === activeMilestoneIndex;

            return (
              <button
                key={idx}
                onClick={() => setActiveMilestoneIndex(idx)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/30 bg-primary/5 dark:bg-primary/20 shadow-sm'
                    : m.completed
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-extrabold text-gray-500 uppercase">{m.dayLabel}</span>
                  {m.completed && <span className="text-emerald-600 font-bold">✓ Done</span>}
                </div>
                <p className="font-bold text-xs text-gray-900 dark:text-white line-clamp-1">{m.title}</p>
              </button>
            );
          })}
        </div>

        {/* Selected Milestone Detail Card */}
        <div className="p-5 rounded-2xl bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {activeMilestone.dayLabel} Focus
              </span>
              <h5 className="font-bold text-lg text-gray-900 dark:text-white mt-0.5">
                {activeMilestone.title}
              </h5>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                {activeMilestone.description}
              </p>
            </div>

            <button
              onClick={() => handleToggleMilestone(activeMilestoneIndex)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm self-start sm:self-auto flex items-center gap-1.5 ${
                activeMilestone.completed
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-primary text-white hover:bg-primary/90'
              }`}
            >
              <span>{activeMilestone.completed ? '✓ Milestone Completed' : '⚪ Mark as Done'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <div>
              <strong>Target Activity: </strong>
              <span>{activeMilestone.targetActivity}</span>
            </div>
          </div>

          {/* Normal vs. Red Flag Diagnostic Reassurance Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Normal Symptoms */}
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
              <h6 className="font-bold text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 uppercase">
                <span>🟢</span>
                <span>Normal & Expected Sensations</span>
              </h6>
              <ul className="space-y-1.5">
                {activeMilestone.normalSymptoms.map((symp, sIdx) => (
                  <li key={sIdx} className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>{symp}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-gray-400 italic pt-1">
                These are typical biological healing responses.
              </p>
            </div>

            {/* Red Flag Warning Signs */}
            <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 space-y-2">
              <h6 className="font-bold text-xs text-rose-900 dark:text-rose-300 flex items-center gap-1.5 uppercase">
                <span>🚨</span>
                <span>Red Flags (Contact Clinical Team)</span>
              </h6>
              <ul className="space-y-1.5">
                {activeMilestone.redFlagSymptoms.map((flag, fIdx) => (
                  <li key={fIdx} className="text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                    <span className="text-rose-500 font-bold">⚠️</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2 flex items-center gap-2">
                <a
                  href="tel:1234567890"
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-sm"
                >
                  📞 Call Emergency ER Hotline
                </a>
                {onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('Appointments')}
                    className="text-[11px] text-rose-700 dark:text-rose-300 hover:underline font-semibold"
                  >
                    Book Doctor Review →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecoveryPathwaysSection;
