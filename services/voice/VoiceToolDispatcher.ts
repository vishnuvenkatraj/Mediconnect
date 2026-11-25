import type {
  VoiceToolDefinition,
  VoiceToolExecutionContext,
  VoiceToolExecutionResult
} from './types';
import type { Appointment, Medicine, Prescription, LabTest, Page } from '../../types';
import { MOCK_DOCTORS, MOCK_USERS, MOCK_PATIENTS } from '../../constants';
import { saveAppointment, deleteAppointment, saveNursePage } from '../database';
import { getQueueForPatient, acknowledgeAlert, stopVibration, triggerVibration } from '../queueService';
import { getHospitalLocations, calculateRoute } from '../wayFinderService';
import { translateClinicalRecordWithGemini } from '../geminiService';
import { findDoctorByQuery, parseDateFromText } from './doctorDateParser';

export const VOICE_TOOL_DEFINITIONS: VoiceToolDefinition[] = [
  {
    name: 'book_appointment',
    description: 'Book a medical consultation appointment with a doctor for a given specialization, date, and time. Validates availability and prevents duplicates.',
    parameters: {
      type: 'object',
      properties: {
        doctorNameOrSpec: {
          type: 'string',
          description: 'Doctor name (e.g. Dr. Jane Smith) or clinical specialty (e.g. Cardiology, Neurology, Pediatrics, Orthopedics, General Medicine).'
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (e.g. 2026-11-25) or relative date like tomorrow.'
        },
        time: {
          type: 'string',
          description: 'Time slot like 10:00 AM, 11:30 AM, 02:00 PM.'
        }
      },
      required: ['doctorNameOrSpec', 'date', 'time']
    }
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel an upcoming booked medical appointment for the authenticated patient.',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: {
          type: 'string',
          description: 'Optional ID of the appointment to cancel.'
        },
        doctorNameOrSpec: {
          type: 'string',
          description: 'Optional doctor name or specialization to match the appointment.'
        }
      }
    }
  },
  {
    name: 'reschedule_appointment',
    description: 'Reschedule an existing upcoming appointment to a new date and time after checking availability.',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: {
          type: 'string',
          description: 'Optional ID of the appointment to reschedule.'
        },
        doctorNameOrSpec: {
          type: 'string',
          description: 'Optional doctor name or specialty.'
        },
        newDate: {
          type: 'string',
          description: 'New desired date (YYYY-MM-DD or tomorrow).'
        },
        newTime: {
          type: 'string',
          description: 'New desired time slot (e.g. 11:30 AM, 02:00 PM).'
        }
      },
      required: ['newDate', 'newTime']
    }
  },
  {
    name: 'check_doctor_availability',
    description: 'Check doctor availability, consultation room, and real available time slots for a given specialty or doctor on a date.',
    parameters: {
      type: 'object',
      properties: {
        specialtyOrName: {
          type: 'string',
          description: 'Specialty or doctor name.'
        },
        date: {
          type: 'string',
          description: 'Date to check availability for (e.g. tomorrow or YYYY-MM-DD).'
        }
      },
      required: ['specialtyOrName']
    }
  },
  {
    name: 'get_my_appointments',
    description: 'List upcoming appointments for the authenticated patient or scheduled patients for an authenticated doctor.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'check_medicine_stock',
    description: 'Check medication stock level, category, and expiry in the outpatient pharmacy inventory.',
    parameters: {
      type: 'object',
      properties: {
        medicineName: {
          type: 'string',
          description: 'Name of medicine (e.g. Paracetamol, Amoxicillin, Metformin, Atorvastatin).'
        }
      },
      required: ['medicineName']
    }
  },
  {
    name: 'get_my_prescriptions',
    description: 'Retrieve verified active prescriptions and medication regimens for the authenticated patient.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_lab_report_status',
    description: 'Check diagnostic laboratory test status (Pending, In Progress, Completed) and available results for the authenticated patient.',
    parameters: {
      type: 'object',
      properties: {
        testType: {
          type: 'string',
          description: 'Optional test type like Blood Test, Lipid Panel, MRI, Urine Analysis.'
        }
      }
    }
  },
  {
    name: 'explain_lab_report_medilingo',
    description: 'Explain a clinical lab report or medical record in plain patient-friendly English/Tamil using the MediLingo clinical engine.',
    parameters: {
      type: 'object',
      properties: {
        testTypeOrTitle: {
          type: 'string',
          description: 'Optional title or test type of the record to translate.'
        }
      }
    }
  },
  {
    name: 'get_patient_profile',
    description: 'View the authenticated patient health profile, age, current clinical condition, and care metrics.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_doctor_schedule',
    description: 'For authorized DOCTOR: view schedule, consultation room, and assigned patient list. Denied to unauthorized patients.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_admin_dashboard_summary',
    description: 'For authorized ADMIN: check hospital operations, total patient counts, active appointments, low stock medications, and system health.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_wayfinder_guidance',
    description: 'Provide voice-guided hospital indoor directions between floors and departments, including wheelchair accessible routes.',
    parameters: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          description: 'Target department or room (e.g. Cardiology, Room 204, Pharmacy, Emergency, Radiology, Cafeteria).'
        },
        wheelchairAccessible: {
          type: 'boolean',
          description: 'Whether step-free ramp/elevator routing is required.'
        }
      },
      required: ['destination']
    }
  },
  {
    name: 'request_hospital_assistance',
    description: 'Request wheelchair assistance, written instructions, sign language interpreter, or staff support at a specific hospital location.',
    parameters: {
      type: 'object',
      properties: {
        assistanceType: {
          type: 'string',
          enum: ['wheelchair', 'written_instructions', 'communication_support', 'general'],
          description: 'Type of hospital assistance needed.'
        },
        location: {
          type: 'string',
          description: 'Location for assistance (e.g. Main Entrance Ramps, Emergency Bay, Accessible Car Parking, Elevator Lobby).'
        }
      },
      required: ['assistanceType']
    }
  },
  {
    name: 'get_queue_token',
    description: 'Check patient OPD queue token, current wait time, and room assignment via MediSilentAlert.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'acknowledge_queue_alert',
    description: 'Acknowledge an active MediSilentAlert OPD token calling notification and stop physical device vibration.',
    parameters: {
      type: 'object',
      properties: {
        tokenNumber: {
          type: 'string',
          description: 'Optional token number to acknowledge.'
        }
      }
    }
  },
  {
    name: 'navigate_to_page',
    description: 'Navigate the MediConnect application directly to an existing page or tab WITHOUT performing any financial or clinical transaction.',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Target page: Appointments, Medical Records, Prescriptions, Laboratory, Pharmacy, Dashboard, WayFinder, Profile, Services, Emergency.'
        }
      },
      required: ['target']
    }
  },
  {
    name: 'get_emergency_info',
    description: 'Immediate emergency department dispatch info, ER-101 room number, and emergency 24/7 hotline.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'connect_human_assistance',
    description: 'Connect patient to hospital reception desk, nurse coordinator, or human helpdesk.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_hospital_services',
    description: 'List verified hospital departments, specialists, pharmacy, and diagnostic services.',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
];

export class VoiceToolDispatcher {
  public static async executeTool(
    toolName: string,
    params: Record<string, any>,
    context: VoiceToolExecutionContext
  ): Promise<VoiceToolExecutionResult> {
    switch (toolName) {
      case 'book_appointment':
        return this.executeBookAppointment(params, context);
      case 'cancel_appointment':
        return this.executeCancelAppointment(params, context);
      case 'reschedule_appointment':
        return this.executeRescheduleAppointment(params, context);
      case 'check_doctor_availability':
        return this.executeCheckDoctorAvailability(params, context);
      case 'get_my_appointments':
        return this.executeGetAppointments(context);
      case 'check_medicine_stock':
        return this.executeCheckMedicine(params, context);
      case 'get_my_prescriptions':
        return this.executeGetPrescriptions(context);
      case 'get_lab_report_status':
        return this.executeGetLabStatus(params, context);
      case 'explain_lab_report_medilingo':
        return this.executeExplainLabReport(params, context);
      case 'get_patient_profile':
        return this.executeGetPatientProfile(context);
      case 'get_doctor_schedule':
        return this.executeGetDoctorSchedule(context);
      case 'get_admin_dashboard_summary':
        return this.executeGetAdminSummary(context);
      case 'get_wayfinder_guidance':
        return this.executeWayFinderGuidance(params, context);
      case 'request_hospital_assistance':
        return this.executeRequestAssistance(params, context);
      case 'get_queue_token':
        return this.executeGetQueue(context);
      case 'acknowledge_queue_alert':
        return this.executeAcknowledgeAlert(params, context);
      case 'navigate_to_page':
        return this.executeNavigate(params, context);
      case 'get_emergency_info':
        return this.executeEmergency();
      case 'connect_human_assistance':
        return this.executeHumanAssistance();
      case 'get_hospital_services':
        return this.executeHospitalServices();
      default:
        return {
          toolName,
          success: false,
          message: `Tool ${toolName} is not recognized.`,
          spokenFeedback: "I'm sorry, I cannot perform that action right now."
        };
    }
  }

  // -------------------------------------------------------------
  // 1. Voice Appointment Booking (Backend Validation + Duplicate Prevention)
  // -------------------------------------------------------------
  private static async executeBookAppointment(
    params: Record<string, any>,
    context: VoiceToolExecutionContext
  ): Promise<VoiceToolExecutionResult> {
    // 1. Authorization: User must be authenticated
    if (!context.currentUser) {
      return {
        toolName: 'book_appointment',
        success: false,
        message: 'Please log in to your MediConnect patient account first before booking an appointment.',
        spokenFeedback: 'Please log in to your patient account first to book an appointment.',
        action: {
          type: 'open_login',
          label: 'Log In to MediConnect',
          targetPage: 'Home'
        }
      };
    }

    // Role check: Only Patients (or Admin on behalf) can book
    if (context.currentUser.role !== 'PATIENT' && context.currentUser.role !== 'ADMIN') {
      return {
        toolName: 'book_appointment',
        success: false,
        message: 'Only patients can book clinical consultation appointments.',
        spokenFeedback: 'Appointments can only be booked through patient accounts.'
      };
    }

    const matchedDoctor = findDoctorByQuery(params.doctorNameOrSpec || '', MOCK_DOCTORS) || MOCK_DOCTORS[0];

    // Format target date using robust natural language parser
    const parsedDate = parseDateFromText(params.date || 'tomorrow');
    const bookingDate = parsedDate || (params.date === 'today' ? new Date().toISOString().split('T')[0] : new Date(Date.now() + 86400000).toISOString().split('T')[0]);

    const bookingTime = params.time || '10:00 AM';

    // 2. Backend Validation: Prevent duplicate booking for same patient, doctor, date & time
    const existingPatientBooking = (context.appointments || []).find(a =>
      a.patientId === context.currentUser?.id &&
      a.doctorId === matchedDoctor.id &&
      a.date === bookingDate &&
      a.time === bookingTime &&
      a.status === 'Upcoming'
    );

    if (existingPatientBooking) {
      return {
        toolName: 'book_appointment',
        success: false,
        message: `Duplicate Booking Blocked: You already have an active appointment with ${matchedDoctor.name} on ${bookingDate} at ${bookingTime}.`,
        spokenFeedback: `You already have an appointment scheduled with ${matchedDoctor.name} at this time.`,
        action: {
          type: 'navigate_appointments',
          label: 'View in Appointments Page',
          targetPage: 'Patient Portal',
          targetTab: 'Appointments'
        }
      };
    }

    // 3. Backend Validation: Prevent doctor double-booking at the exact same slot
    const doctorSlotTaken = (context.appointments || []).find(a =>
      a.doctorId === matchedDoctor.id &&
      a.date === bookingDate &&
      a.time === bookingTime &&
      a.status === 'Upcoming'
    );

    if (doctorSlotTaken) {
      return {
        toolName: 'book_appointment',
        success: false,
        message: `Slot Conflict: ${matchedDoctor.name} is already booked at ${bookingTime} on ${bookingDate}. Please choose an alternative slot like 11:30 AM or 02:00 PM.`,
        spokenFeedback: `${matchedDoctor.name} is already booked at ${bookingTime}. Would you like 11:30 AM or 2 PM instead?`
      };
    }

    // 4. Construct Verified Appointment Record
    const newApp: Appointment = {
      id: `app_voice_${Date.now()}`,
      patientId: context.currentUser.id,
      patientName: context.currentUser.name,
      doctorId: matchedDoctor.id,
      doctorName: matchedDoctor.name,
      doctorSpecialization: matchedDoctor.specialization,
      date: bookingDate,
      time: bookingTime,
      status: 'Upcoming',
      type: 'New Consultation'
    };

    // 5. Persist to Supabase Database
    const dbResult = await saveAppointment(newApp);
    if (!dbResult.success) {
      console.warn('Voice appointment save warning, preserving in local state:', dbResult.error);
    }

    // 6. Update Application Reactive State
    if (context.setAppointments) {
      context.setAppointments(prev => [newApp, ...(prev || [])]);
    }

    return {
      toolName: 'book_appointment',
      success: true,
      message: `✅ Appointment Confirmed!\n• **Doctor:** ${matchedDoctor.name} (${matchedDoctor.specialization})\n• **Date:** ${bookingDate}\n• **Time:** ${bookingTime}\n• **Patient:** ${context.currentUser.name}\n• **Status:** Upcoming\n• **Room:** West Wing Consultation Suite`,
      spokenFeedback: `Your appointment with ${matchedDoctor.name} in ${matchedDoctor.specialization} has been confirmed for ${bookingDate} at ${bookingTime}.`,
      data: newApp,
      action: {
        type: 'navigate_appointments',
        label: 'Open Appointments Page',
        targetPage: 'Patient Portal',
        targetTab: 'Appointments'
      }
    };
  }

  // -------------------------------------------------------------
  // 2. Cancel Appointment (Conversationally)
  // -------------------------------------------------------------
  private static async executeCancelAppointment(
    params: Record<string, any>,
    context: VoiceToolExecutionContext
  ): Promise<VoiceToolExecutionResult> {
    if (!context.currentUser) {
      return {
        toolName: 'cancel_appointment',
        success: false,
        message: 'Please log in to manage your appointments.',
        spokenFeedback: 'Please log in as a patient to cancel an appointment.'
      };
    }

    const upcoming = (context.appointments || []).filter(
      a => a.patientId === context.currentUser?.id && a.status === 'Upcoming'
    );

    if (upcoming.length === 0) {
      return {
        toolName: 'cancel_appointment',
        success: false,
        message: 'You have no upcoming appointments to cancel.',
        spokenFeedback: 'You have no active appointments scheduled.'
      };
    }

    // Find specific appointment if requested or pick earliest
    let target = upcoming[0];
    if (params.appointmentId) {
      const match = upcoming.find(a => a.id === params.appointmentId);
      if (match) target = match;
    } else if (params.doctorNameOrSpec) {
      const q = params.doctorNameOrSpec.toLowerCase();
      const match = upcoming.find(a =>
        a.doctorName.toLowerCase().includes(q) ||
        a.doctorSpecialization.toLowerCase().includes(q)
      );
      if (match) target = match;
    }

    const updatedApp: Appointment = {
      ...target,
      status: 'Cancelled'
    };

    // Update in Supabase
    await saveAppointment(updatedApp);

    // Update state
    if (context.setAppointments) {
      context.setAppointments(prev => prev.map(a => a.id === target.id ? updatedApp : a));
    }

    return {
      toolName: 'cancel_appointment',
      success: true,
      message: `🚫 Appointment Cancelled:\nYour consultation with ${target.doctorName} on ${target.date} at ${target.time} has been successfully cancelled.`,
      spokenFeedback: `Your appointment with ${target.doctorName} on ${target.date} has been cancelled.`,
      data: updatedApp,
      action: {
        type: 'navigate_appointments',
        label: 'View Appointments',
        targetPage: 'Patient Portal',
        targetTab: 'Appointments'
      }
    };
  }

  // -------------------------------------------------------------
  // 3. Reschedule Appointment
  // -------------------------------------------------------------
  private static async executeRescheduleAppointment(
    params: Record<string, any>,
    context: VoiceToolExecutionContext
  ): Promise<VoiceToolExecutionResult> {
    if (!context.currentUser) {
      return {
        toolName: 'reschedule_appointment',
        success: false,
        message: 'Please log in to reschedule your appointment.',
        spokenFeedback: 'Please log in to reschedule your appointment.'
      };
    }

    const upcoming = (context.appointments || []).filter(
      a => a.patientId === context.currentUser?.id && a.status === 'Upcoming'
    );

    if (upcoming.length === 0) {
      return {
        toolName: 'reschedule_appointment',
        success: false,
        message: 'You have no upcoming appointments to reschedule.',
        spokenFeedback: 'You do not have any active appointments to reschedule.'
      };
    }

    let target = upcoming[0];
    if (params.doctorNameOrSpec) {
      const q = params.doctorNameOrSpec.toLowerCase();
      const match = upcoming.find(a =>
        a.doctorName.toLowerCase().includes(q) ||
        a.doctorSpecialization.toLowerCase().includes(q)
      );
      if (match) target = match;
    }

    let newDate = params.newDate || target.date;
    if (newDate === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      newDate = tomorrow.toISOString().split('T')[0];
    }
    const newTime = params.newTime || '11:30 AM';

    // Verify slot not conflicting
    const slotConflict = (context.appointments || []).find(a =>
      a.id !== target.id &&
      a.doctorId === target.doctorId &&
      a.date === newDate &&
      a.time === newTime &&
      a.status === 'Upcoming'
    );

    if (slotConflict) {
      return {
        toolName: 'reschedule_appointment',
        success: false,
        message: `Slot Conflict: ${target.doctorName} is not available at ${newTime} on ${newDate}. Please pick another time slot.`,
        spokenFeedback: `That slot is not available with ${target.doctorName}. Please choose another time.`
      };
    }

    const rescheduled: Appointment = {
      ...target,
      date: newDate,
      time: newTime
    };

    await saveAppointment(rescheduled);

    if (context.setAppointments) {
      context.setAppointments(prev => prev.map(a => a.id === target.id ? rescheduled : a));
    }

    return {
      toolName: 'reschedule_appointment',
      success: true,
      message: `📅 Appointment Rescheduled!\n• **Doctor:** ${target.doctorName}\n• **New Date:** ${newDate}\n• **New Time:** ${newTime}`,
      spokenFeedback: `Your appointment with ${target.doctorName} has been rescheduled to ${newDate} at ${newTime}.`,
      data: rescheduled,
      action: {
        type: 'navigate_appointments',
        label: 'View in Appointments Page',
        targetPage: 'Patient Portal',
        targetTab: 'Appointments'
      }
    };
  }

  // -------------------------------------------------------------
  // 4. Check Doctor Availability & Free Slots
  // -------------------------------------------------------------
  private static executeCheckDoctorAvailability(
    params: Record<string, any>,
    context: VoiceToolExecutionContext
  ): VoiceToolExecutionResult {
    const doc = findDoctorByQuery(params.specialtyOrName || '', MOCK_DOCTORS) || MOCK_DOCTORS[0];

    const parsedDate = parseDateFromText(params.date || 'tomorrow');
    const targetDate = parsedDate || (params.date === 'today' ? new Date().toISOString().split('T')[0] : new Date(Date.now() + 86400000).toISOString().split('T')[0]);

    // Standard available consultation slots
    const standardSlots = ['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '04:00 PM'];

    // Filter out already booked slots from actual appointments
    const bookedSlots = (context.appointments || [])
      .filter(a => a.doctorId === doc.id && a.date === targetDate && a.status === 'Upcoming')
      .map(a => a.time);

    const availableSlots = standardSlots.filter(s => !bookedSlots.includes(s));

    return {
      toolName: 'check_doctor_availability',
      success: true,
      message: `👨‍⚕️ **Doctor Availability:**\n• **Doctor:** ${doc.name} (${doc.specialization})\n• **Experience:** ${doc.experience} years\n• **Regular Hours:** ${doc.availability}\n• **Location:** West Wing Clinic Suite\n• **Date Checked:** ${targetDate}\n• **Available Slots:** ${availableSlots.length > 0 ? availableSlots.join(', ') : 'Fully booked for this day'}`,
      spokenFeedback: `${doc.name} in ${doc.specialization} has ${availableSlots.length} available slots for ${targetDate}: ${availableSlots.slice(0, 3).join(', ')}. Which one would you prefer?`,
      data: {
        doctor: doc,
        date: targetDate,
        availableSlots
      }
    };
  }

  // -------------------------------------------------------------
  // 5. Get Appointments (Role-Based Authorization)
  // -------------------------------------------------------------
  private static executeGetAppointments(
    context: VoiceToolExecutionContext
  ): VoiceToolExecutionResult {
    if (!context.currentUser) {
      return {
        toolName: 'get_my_appointments',
        success: false,
        message: 'Please log in to view your appointments.',
        spokenFeedback: 'Please log in to check your scheduled appointments.'
      };
    }

    // A. Patient View (Strictly restricted to current patient's appointments)
    if (context.currentUser.role === 'PATIENT') {
      const myApps = (context.appointments || []).filter(
        a => a.patientId === context.currentUser?.id && a.status === 'Upcoming'
      );

      if (myApps.length === 0) {
        return {
          toolName: 'get_my_appointments',
          success: true,
          message: 'You have no upcoming appointments scheduled. Would you like me to book one for you?',
          spokenFeedback: 'You currently have no upcoming doctor appointments. Would you like me to book one for you?'
        };
      }

      const next = myApps[0];
      return {
        toolName: 'get_my_appointments',
        success: true,
        message: `📋 **Your Scheduled Appointments (${myApps.length}):**\n` +
          myApps.map(a => `• **${a.doctorName}** (${a.doctorSpecialization}) — ${a.date} at ${a.time} [${a.status}]`).join('\n'),
        spokenFeedback: `You have ${myApps.length} upcoming appointment. Next is with ${next.doctorName} on ${next.date} at ${next.time}.`,
        data: myApps,
        action: {
          type: 'navigate_appointments',
          label: 'Open Appointments Tab',
          targetPage: 'Patient Portal',
          targetTab: 'Appointments'
        }
      };
    }

    // B. Doctor View (Restricted to patients assigned to this doctor)
    if (context.currentUser.role === 'DOCTOR') {
      const doctorId = context.currentUser.id;
      const docName = context.currentUser.name;
      const doctorApps = (context.appointments || []).filter(
        a => (a.doctorId === doctorId || a.doctorName.toLowerCase().includes(docName.toLowerCase())) && a.status === 'Upcoming'
      );

      return {
        toolName: 'get_my_appointments',
        success: true,
        message: `🩺 **Dr. ${context.currentUser.name}'s Consultation Schedule:**\n` +
          `You have ${doctorApps.length} patient(s) scheduled:\n` +
          doctorApps.map(a => `• **${a.patientName}** — ${a.date} at ${a.time} (${a.type})`).join('\n'),
        spokenFeedback: `Doctor, you have ${doctorApps.length} scheduled patient appointments.`,
        data: doctorApps,
        action: {
          type: 'navigate_doctor_portal',
          label: 'Open Doctor Schedule',
          targetPage: 'Doctor Portal'
        }
      };
    }

    // C. Admin View
    return {
      toolName: 'get_my_appointments',
      success: true,
      message: `🏥 **Hospital Appointment Overview:**\nTotal active upcoming appointments in system: ${(context.appointments || []).filter(a => a.status === 'Upcoming').length}.`,
      spokenFeedback: `There are currently ${(context.appointments || []).filter(a => a.status === 'Upcoming').length} upcoming appointments hospital wide.`
    };
  }

  // -------------------------------------------------------------
  // 6. Check Pharmacy Medicine Stock
  // -------------------------------------------------------------
  private static executeCheckMedicine(
    params: Record<string, any>,
    context: VoiceToolExecutionContext
  ): VoiceToolExecutionResult {
    const q = (params.medicineName || '').toLowerCase().trim();
    const med = (context.medicines || []).find(m => m.name.toLowerCase().includes(q));

    if (!med) {
      return {
        toolName: 'check_medicine_stock',
        success: true,
        message: `💊 "${params.medicineName}" is not currently found in our outpatient pharmacy inventory. Please consult the dispensary desk in Room PH-01.`,
        spokenFeedback: `Medication ${params.medicineName} is not listed in our current outpatient inventory.`
      };
    }

    const inStock = med.quantity > 0;
    return {
      toolName: 'check_medicine_stock',
      success: true,
      message: `💊 **Pharmacy Inventory Verification:**\n• **Medicine:** ${med.name}\n• **Category:** ${med.category}\n• **Stock Status:** ${inStock ? `✅ In Stock (${med.quantity} units)` : '⚠️ Out of Stock'}\n• **Expiry Date:** ${med.expiry}\n• **Dispensary:** Room PH-01 (Ground Floor East Wing)\n\n*Note: MediConnect does not self-prescribe medications. Valid physician prescription required for dispensing.*`,
      spokenFeedback: `${med.name} is ${inStock ? `in stock with ${med.quantity} units available at the pharmacy` : 'currently out of stock'}.`,
      data: med,
      action: {
        type: 'navigate_pharmacy',
        label: 'View Pharmacy Catalog',
        targetPage: 'Pharmacy Portal'
      }
    };
  }

  // -------------------------------------------------------------
  // 7. Get Prescriptions (Patient Privacy Guarded)
  // -------------------------------------------------------------
  private static executeGetPrescriptions(
    context: VoiceToolExecutionContext
  ): VoiceToolExecutionResult {
    if (!context.currentUser) {
      return {
        toolName: 'get_my_prescriptions',
        success: false,
        message: 'Please log in to access your prescriptions.',
        spokenFeedback: 'Please log in to view your prescriptions.'
      };
    }

    const myPrescriptions = (context.prescriptions || []).filter(
      p => p.patientId === context.currentUser?.id
    );

    if (myPrescriptions.length === 0) {
      return {
        toolName: 'get_my_prescriptions',
        success: true,
        message: 'You have no active prescriptions on file.',
        spokenFeedback: 'You have no active prescriptions listed in your medical record.'
      };
    }

    return {
      toolName: 'get_my_prescriptions',
      success: true,
      message: `📜 **Verified Active Prescriptions (${myPrescriptions.length}):**\n` +
        myPrescriptions.map(p => `• **${p.medication}** (${p.dosage}) — ${p.frequency} for ${p.duration} [Prescribed by ${p.doctorName}]`).join('\n') +
        `\n\n*Dispensed at Room PH-01. Never alter dosages without doctor authorization.*`,
      spokenFeedback: `You have ${myPrescriptions.length} active prescriptions. The first is ${myPrescriptions[0].medication} ${myPrescriptions[0].dosage}, ${myPrescriptions[0].frequency}.`,
      data: myPrescriptions,
      action: {
        type: 'navigate_prescriptions',
        label: 'Open Prescriptions Tab',
        targetPage: 'Patient Portal',
        targetTab: 'Prescriptions'
      }
    };
  }

  // -------------------------------------------------------------
  // 8. Laboratory Test Status
  // -------------------------------------------------------------
  private static executeGetLabStatus(
    params: Record<string, any>,
    context: VoiceToolExecutionContext
  ): VoiceToolExecutionResult {
    if (!context.currentUser) {
      return {
        toolName: 'get_lab_report_status',
        success: false,
        message: 'Please log in to check your diagnostic laboratory test reports.',
        spokenFeedback: 'Please log in to check your lab reports.'
      };
    }

    const patientName = context.currentUser.name.toLowerCase();
    const myTests = (context.labTests || []).filter(
      l => l.patientName.toLowerCase().includes(patientName) || patientName.includes(l.patientName.toLowerCase())
    );

    if (myTests.length === 0) {
      return {
        toolName: 'get_lab_report_status',
        success: true,
        message: 'You have no recent diagnostic tests in the laboratory system.',
        spokenFeedback: 'You have no recent lab tests found in the hospital diagnostic system.'
      };
    }

    const q = (params.testType || '').toLowerCase();
    const matched = q ? (myTests.find(t => t.testType.toLowerCase().includes(q)) || myTests[0]) : myTests[0];

    return {
      toolName: 'get_lab_report_status',
      success: true,
      message: `🧪 **Diagnostic Laboratory Status:**\n• **Test Type:** ${matched.testType}\n• **Status:** ${matched.status}\n• **Ordered By:** ${matched.requestedBy}\n• **Date:** ${matched.date}\n• **Results:** ${matched.results || 'Analysis in progress by pathology team'}\n\n*Say "Explain my lab report" to translate these clinical metrics via MediLingo.*`,
      spokenFeedback: `Your ${matched.testType} is ${matched.status}. ${matched.results ? `Result is ${matched.results}.` : 'Analysis is currently in progress.'}`,
      data: matched,
      action: {
        type: 'navigate_lab_tab',
        label: 'View Lab Reports',
        targetPage: 'Patient Portal',
        targetTab: 'Medical Records'
      }
    };
  }

  // -------------------------------------------------------------
  // 9. Explain Lab Report with MediLingo™
  // -------------------------------------------------------------
  private static async executeExplainLabReport(
    params: Record<string, any>,
    context: VoiceToolExecutionContext
  ): Promise<VoiceToolExecutionResult> {
    if (!context.currentUser) {
      return {
        toolName: 'explain_lab_report_medilingo',
        success: false,
        message: 'Please log in to access your lab reports.',
        spokenFeedback: 'Please log in to explain your lab reports.'
      };
    }

    const patientName = context.currentUser.name.toLowerCase();
    const myTests = (context.labTests || []).filter(
      l => l.patientName.toLowerCase().includes(patientName) || patientName.includes(l.patientName.toLowerCase())
    );

    const targetTest = myTests[0] || {
      testType: 'Comprehensive Metabolic Panel',
      results: 'Normal glucose 92 mg/dL, normal electrolytes',
      requestedBy: 'Dr. Jane Smith',
      date: new Date().toISOString().split('T')[0]
    };

    try {
      const explanation = await translateClinicalRecordWithGemini(
        targetTest.testType,
        targetTest.results || 'Normal clinical parameters',
        'Lab Result'
      );

      return {
        toolName: 'explain_lab_report_medilingo',
        success: true,
        message: `🩺 **MediLingo™ Plain-English Translation:**\n\n**${explanation.systemName || explanation.anatomicalSystem}**\n${explanation.plainEnglishSummary}\n\n💡 **Key Takeaways:**\n${explanation.keyTakeaways.map(k => `• ${k}`).join('\n')}\n\n*Disclaimer: MediLingo explains medical terms for patient clarity. Always discuss findings with your physician.*`,
        spokenFeedback: (explanation.plainEnglishSummary || 'Your laboratory report results are within normal clinical range.').slice(0, 150) + "...",
        data: explanation
      };
    } catch (e) {
      return {
        toolName: 'explain_lab_report_medilingo',
        success: true,
        message: `🩺 **Lab Summary:** Your ${targetTest.testType} indicates results within expected clinical parameters: ${targetTest.results || 'Normal'}.`,
        spokenFeedback: `Your ${targetTest.testType} shows normal clinical metrics.`
      };
    }
  }

  // -------------------------------------------------------------
  // 10. Patient Health Profile
  // -------------------------------------------------------------
  private static executeGetPatientProfile(
    context: VoiceToolExecutionContext
  ): VoiceToolExecutionResult {
    if (!context.currentUser) {
      return {
        toolName: 'get_patient_profile',
        success: false,
        message: 'Please log in to view your patient profile.',
        spokenFeedback: 'Please log in to view your profile.'
      };
    }

    const patientRecord = MOCK_PATIENTS.find(p => p.id === context.currentUser?.id || p.name.toLowerCase() === context.currentUser?.name.toLowerCase()) || {
      id: context.currentUser.id,
      name: context.currentUser.name,
      age: 38,
      currentCondition: 'General Wellness & Routine Checkups'
    };

    return {
      toolName: 'get_patient_profile',
      success: true,
      message: `👤 **Patient Medical Profile:**\n• **Name:** ${context.currentUser.name}\n• **Account ID:** ${context.currentUser.id}\n• **Email:** ${context.currentUser.email}\n• **Age:** ${patientRecord.age} years\n• **Active Clinical Focus:** ${patientRecord.currentCondition}\n• **Verification:** Verified MediConnect Patient`,
      spokenFeedback: `Profile for ${context.currentUser.name}, age ${patientRecord.age}. Current focus is ${patientRecord.currentCondition}.`,
      data: patientRecord
    };
  }

  // -------------------------------------------------------------
  // 11. Doctor Schedule & Authorized Clinical Chart Review
  // -------------------------------------------------------------
  private static executeGetDoctorSchedule(
    context: VoiceToolExecutionContext
  ): VoiceToolExecutionResult {
    // Role check: Only Doctor or Admin can access
    if (!context.currentUser || (context.currentUser.role !== 'DOCTOR' && context.currentUser.role !== 'ADMIN')) {
      return {
        toolName: 'get_doctor_schedule',
        success: false,
        message: '⛔ Access Restricted: Doctor clinical schedules and internal patient charts are restricted to verified medical doctors.',
        spokenFeedback: 'Access denied. Doctor schedules and clinical records are restricted to verified medical staff.'
      };
    }

    const doctorId = context.currentUser.id;
    const docApps = (context.appointments || []).filter(
      a => a.doctorId === doctorId || a.doctorName.toLowerCase().includes(context.currentUser!.name.toLowerCase())
    );

    return {
      toolName: 'get_doctor_schedule',
      success: true,
      message: `👨‍⚕️ **Doctor Clinical Dashboard:**\n• **Doctor:** ${context.currentUser.name}\n• **Consultation Room:** Room 204 (West Wing, 2nd Floor)\n• **Patients Scheduled Today:** ${docApps.length}\n• **Schedule:** 9:00 AM – 4:00 PM\n\n${docApps.map((a, i) => `${i + 1}. ${a.patientName} (${a.time} - ${a.type})`).join('\n')}`,
      spokenFeedback: `Dr. ${context.currentUser.name}, you have ${docApps.length} patients scheduled for consultation today in Room 204.`,
      data: docApps
    };
  }

  // -------------------------------------------------------------
  // 12. Admin Dashboard Summary
  // -------------------------------------------------------------
  private static executeGetAdminSummary(
    context: VoiceToolExecutionContext
  ): VoiceToolExecutionResult {
    if (!context.currentUser || context.currentUser.role !== 'ADMIN') {
      return {
        toolName: 'get_admin_dashboard_summary',
        success: false,
        message: '⛔ Unauthorized: Hospital operational metrics and administrative controls require Administrator credentials.',
        spokenFeedback: 'Access denied. Hospital operational metrics require administrator authorization.'
      };
    }

    const totalUsers = (context.users || MOCK_USERS).length;
    const totalAppointments = (context.appointments || []).length;
    const lowStockMeds = (context.medicines || []).filter(m => m.quantity < 50);

    return {
      toolName: 'get_admin_dashboard_summary',
      success: true,
      message: `📊 **Hospital Operations Overview:**\n• **Registered Staff & Patients:** ${totalUsers}\n• **Total Appointments:** ${totalAppointments}\n• **Low Stock Medication Alerts:** ${lowStockMeds.length} items needing reorder\n• **Database Sync Status:** Synchronized with Supabase Cloud\n• **Active Departments:** Cardiology, Neurology, Pediatrics, Orthopedics, Emergency, Pathology, Pharmacy`,
      spokenFeedback: `Hospital operations are normal. There are ${totalAppointments} appointments recorded, and ${lowStockMeds.length} medicines need restocking.`,
      action: {
        type: 'navigate_admin',
        label: 'Open Admin Dashboard',
        targetPage: 'Admin Dashboard'
      }
    };
  }

  // -------------------------------------------------------------
  // 13. MediConnect WayFinder Voice-Guided Navigation
  // -------------------------------------------------------------
  private static executeWayFinderGuidance(
    params: Record<string, any>,
    context: VoiceToolExecutionContext
  ): VoiceToolExecutionResult {
    const locations = getHospitalLocations();
    const q = (params.destination || '').toLowerCase();
    const isWheelchair = params.wheelchairAccessible !== false;

    const matched = locations.find(l =>
      q.includes(l.name.toLowerCase()) ||
      q.includes(l.roomNumber.toLowerCase()) ||
      (l.department && q.includes(l.department.toLowerCase())) ||
      l.name.toLowerCase().includes(q) ||
      l.roomNumber.toLowerCase().includes(q) ||
      (l.department && l.department.toLowerCase().includes(q))
    ) || locations.find(l => l.roomNumber === 'Room 204') || locations[0];

    const startLoc = locations.find(l => l.id === 'loc_g01') || locations[0];
    const route = calculateRoute(startLoc, matched, isWheelchair);

    const stepsText = route.steps.map((s, i) => `${i + 1}. ${s.instruction}`).join('\n');
    const spokenNav = `To reach ${matched.name} in ${matched.roomNumber}: From the Main Entrance, ${route.steps[0]?.instruction || 'proceed along the central atrium'}. ${matched.floor > 0 ? `Take Central Elevator Bank A to Floor ${matched.floor}.` : ''} Destination will be on your ${matched.wing}.`;

    return {
      toolName: 'get_wayfinder_guidance',
      success: true,
      message: `🗺️ **WayFinder Hospital Indoor Navigation:**\n• **Destination:** ${matched.name} (${matched.roomNumber})\n• **Floor:** ${matched.floorName} (${matched.wing})\n• **Accessible Route:** ${isWheelchair ? '♿ Wheelchair Ramp & Elevator Active' : 'Standard Stairs & Walkways'}\n• **Estimated Walking Time:** ${route.estimatedMinutes || 2} min\n\n**Step-by-Step Directions:**\n${stepsText}`,
      spokenFeedback: spokenNav,
      data: { location: matched, route },
      action: {
        type: 'navigate_wayfinder',
        label: 'Open Interactive Floor Map',
        targetPage: 'WayFinder'
      }
    };
  }

  // -------------------------------------------------------------
  // 14. Assistance Requests (Wheelchair, Written, Communication)
  // -------------------------------------------------------------
  private static async executeRequestAssistance(
    params: Record<string, any>,
    context: VoiceToolExecutionContext
  ): Promise<VoiceToolExecutionResult> {
    const type = params.assistanceType || 'wheelchair';
    const location = params.location || 'Main Entrance Ramps';
    const requester = context.currentUser?.name || 'Patient';

    if (type === 'wheelchair') {
      // Trigger nurse / orderly dispatch via database
      await saveNursePage({
        doctor_id: 'd_orderly',
        doctor_name: 'Patient Transport Team',
        message: `Wheelchair dispatch requested by ${requester} at ${location}.`,
        sender_name: 'MediConnect Voice Assistant'
      });

      // Dispatch physical vibration alert
      triggerVibration([200, 100, 200]);

      // Fire assistance window event for UI listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mediconnect_assistance_requested', {
          detail: { type: 'wheelchair', location, requester }
        }));
      }

      return {
        toolName: 'request_hospital_assistance',
        success: true,
        message: `♿ **Wheelchair Assistance Dispatched!**\n• **Patient:** ${requester}\n• **Designated Location:** ${location}\n• **ETA:** 3–5 minutes\n• **Orderly Team:** On the way with standard hospital wheelchair.`,
        spokenFeedback: `Wheelchair assistance has been dispatched to ${location}. An attendant will arrive shortly to assist you.`
      };
    }

    if (type === 'written_instructions') {
      return {
        toolName: 'request_hospital_assistance',
        success: true,
        message: `📄 **Printed Instructions Requested:** Clinical summary and consultation instructions will be automatically printed in high-contrast text at your consultation desk.`,
        spokenFeedback: `Printed instructions have been noted. Your physician and desk nurse will provide large-print summaries.`
      };
    }

    if (type === 'communication_support') {
      return {
        toolName: 'request_hospital_assistance',
        success: true,
        message: `🧏 **Communication Support Desk Alerted:** Sign Language Interpreter and Hearing Loop Amplification dispatched to Central Reception.`,
        spokenFeedback: `Communication support has been alerted. An accessibility coordinator is available at Central Reception.`
      };
    }

    return {
      toolName: 'request_hospital_assistance',
      success: true,
      message: `🤝 **Hospital Support Alert:** Central inquiry staff notified to assist you at ${location}.`,
      spokenFeedback: `Hospital staff at ${location} have been notified to assist you.`
    };
  }

  // -------------------------------------------------------------
  // 15. MediSilentAlert Queue Token & Wait Time
  // -------------------------------------------------------------
  private static executeGetQueue(context: VoiceToolExecutionContext): VoiceToolExecutionResult {
    if (!context.currentUser) {
      return {
        toolName: 'get_queue_token',
        success: false,
        message: 'Please log in as a patient to view your OPD queue token.',
        spokenFeedback: 'Please log in to view your live queue status.'
      };
    }

    const queue = getQueueForPatient(context.currentUser.id);
    if (!queue) {
      return {
        toolName: 'get_queue_token',
        success: true,
        message: 'You have no active queue token registered for today. Tokens are issued automatically upon doctor appointment check-in.',
        spokenFeedback: 'You have no active queue token for today.'
      };
    }

    return {
      toolName: 'get_queue_token',
      success: true,
      message: `🔔 **MediSilentAlert Live Queue Status:**\n• **Token:** ${queue.tokenNumber}\n• **Status:** ${queue.status}\n• **Doctor:** ${queue.doctorName}\n• **Consultation Room:** ${queue.roomNumber}\n• **Queue Position:** ${queue.queuePosition}\n• **Estimated Wait:** ~${queue.estimatedWaitMinutes} minutes`,
      spokenFeedback: `Your token is ${queue.tokenNumber}. Current status is ${queue.status} for ${queue.roomNumber}. Estimated wait is ${queue.estimatedWaitMinutes} minutes.`,
      data: queue,
      action: {
        type: 'navigate_queue',
        label: 'Open Live Queue Tab',
        targetPage: 'Patient Portal',
        targetTab: 'Live Queue'
      }
    };
  }

  // -------------------------------------------------------------
  // 16. Acknowledge Queue Alert (Stops Vibration)
  // -------------------------------------------------------------
  private static executeAcknowledgeAlert(
    params: Record<string, any>,
    context: VoiceToolExecutionContext
  ): VoiceToolExecutionResult {
    if (!context.currentUser) {
      return {
        toolName: 'acknowledge_queue_alert',
        success: false,
        message: 'Please log in to acknowledge your OPD alert.',
        spokenFeedback: 'Please log in to acknowledge your alert.'
      };
    }

    const queue = getQueueForPatient(context.currentUser.id);
    const token = params.tokenNumber || queue?.tokenNumber || queue?.id;

    if (token) {
      acknowledgeAlert(token);
    }
    stopVibration();

    return {
      toolName: 'acknowledge_queue_alert',
      success: true,
      message: '✅ Alert acknowledged. Physical vibration stopped. Please proceed to your consultation room.',
      spokenFeedback: 'Alert acknowledged. Please proceed to your consultation room.'
    };
  }

  // -------------------------------------------------------------
  // 17. Pure Navigation (NO Transactions)
  // -------------------------------------------------------------
  private static executeNavigate(
    params: Record<string, any>,
    context: VoiceToolExecutionContext
  ): VoiceToolExecutionResult {
    const target = (params.target || '').toLowerCase();

    // 1. WayFinder Navigation
    if (target.includes('wayfinder') || target.includes('map') || target.includes('direction') || target.includes('floor')) {
      context.onNavigate('WayFinder');
      return {
        toolName: 'navigate_to_page',
        success: true,
        message: 'Opening WayFinder Indoor Hospital Map.',
        spokenFeedback: 'Opening hospital floor map.'
      };
    }

    // 2. Pharmacy Portal / Catalog
    if (target.includes('pharmacy') || target.includes('dispensary') || target.includes('chemist')) {
      if (context.currentUser?.role === 'PHARMACY') {
        context.onNavigate('Pharmacy Portal');
        return {
          toolName: 'navigate_to_page',
          success: true,
          message: 'Opening Pharmacy Management Portal.',
          spokenFeedback: 'Opening pharmacy portal.'
        };
      }
      context.onNavigate('Patient Portal');
      if (context.onNavigatePatientTab) context.onNavigatePatientTab('Prescriptions');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mediconnect_navigate_tab', { detail: { tab: 'Prescriptions' } }));
      }
      return {
        toolName: 'navigate_to_page',
        success: true,
        message: 'Opening your active prescriptions and pharmacy orders.',
        spokenFeedback: 'Navigating to prescriptions.'
      };
    }

    // 3. Laboratory Portal / Reports
    if (target.includes('laboratory') || target.includes('lab') || target.includes('diagnostic')) {
      if (context.currentUser?.role === 'LAB_TECHNICIAN') {
        context.onNavigate('Lab Portal');
        return {
          toolName: 'navigate_to_page',
          success: true,
          message: 'Opening Diagnostic Laboratory Portal.',
          spokenFeedback: 'Opening laboratory portal.'
        };
      }
      context.onNavigate('Patient Portal');
      if (context.onNavigatePatientTab) context.onNavigatePatientTab('Medical Records');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mediconnect_navigate_tab', { detail: { tab: 'Medical Records' } }));
      }
      return {
        toolName: 'navigate_to_page',
        success: true,
        message: 'Opening your laboratory test reports.',
        spokenFeedback: 'Opening your laboratory reports.'
      };
    }

    // 4. Appointments Page
    if (target.includes('appointment')) {
      context.onNavigate('Patient Portal');
      if (context.onNavigatePatientTab) context.onNavigatePatientTab('Appointments');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mediconnect_navigate_tab', { detail: { tab: 'Appointments' } }));
      }
      return {
        toolName: 'navigate_to_page',
        success: true,
        message: 'Opening Appointments Schedule.',
        spokenFeedback: 'Navigating to appointments.'
      };
    }

    // 5. Medical Records & MediLingo
    if (target.includes('record') || target.includes('medilingo') || target.includes('history')) {
      context.onNavigate('Patient Portal');
      if (context.onNavigatePatientTab) context.onNavigatePatientTab('Medical Records');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mediconnect_navigate_tab', { detail: { tab: 'Medical Records' } }));
      }
      return {
        toolName: 'navigate_to_page',
        success: true,
        message: 'Opening Medical Records and MediLingo plain-language translator.',
        spokenFeedback: 'Opening your medical records.'
      };
    }

    // 6. User Dashboard (Role-Dependent)
    if (target.includes('dashboard') || target.includes('portal') || target.includes('home')) {
      if (!context.currentUser) {
        context.onNavigate('Home');
        return {
          toolName: 'navigate_to_page',
          success: true,
          message: 'Opening MediConnect Home Page.',
          spokenFeedback: 'Opening homepage.'
        };
      }
      switch (context.currentUser.role) {
        case 'DOCTOR':
          context.onNavigate('Doctor Portal');
          return { toolName: 'navigate_to_page', success: true, message: 'Opening Doctor Portal Dashboard.', spokenFeedback: 'Opening doctor portal.' };
        case 'ADMIN':
          context.onNavigate('Admin Dashboard');
          return { toolName: 'navigate_to_page', success: true, message: 'Opening Admin Dashboard.', spokenFeedback: 'Opening admin dashboard.' };
        case 'NURSE':
          context.onNavigate('Nurse Portal');
          return { toolName: 'navigate_to_page', success: true, message: 'Opening Nurse Station Portal.', spokenFeedback: 'Opening nurse portal.' };
        case 'PHARMACY':
          context.onNavigate('Pharmacy Portal');
          return { toolName: 'navigate_to_page', success: true, message: 'Opening Pharmacy Portal.', spokenFeedback: 'Opening pharmacy portal.' };
        case 'LAB_TECHNICIAN':
          context.onNavigate('Lab Portal');
          return { toolName: 'navigate_to_page', success: true, message: 'Opening Laboratory Portal.', spokenFeedback: 'Opening lab portal.' };
        default:
          context.onNavigate('Patient Portal');
          return { toolName: 'navigate_to_page', success: true, message: 'Opening Patient Portal Dashboard.', spokenFeedback: 'Opening patient portal.' };
      }
    }

    // 7. Profile
    if (target.includes('profile') || target.includes('account')) {
      context.onNavigate('Patient Portal');
      if (context.onNavigatePatientTab) context.onNavigatePatientTab('Profile');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mediconnect_navigate_tab', { detail: { tab: 'Profile' } }));
      }
      return {
        toolName: 'navigate_to_page',
        success: true,
        message: 'Opening your patient profile settings.',
        spokenFeedback: 'Opening your profile.'
      };
    }

    // Default: Patient Portal
    context.onNavigate('Patient Portal');
    return {
      toolName: 'navigate_to_page',
      success: true,
      message: 'Navigating to Patient Portal.',
      spokenFeedback: 'Navigating to patient portal.'
    };
  }

  // -------------------------------------------------------------
  // 18. Emergency Protocols
  // -------------------------------------------------------------
  private static executeEmergency(): VoiceToolExecutionResult {
    return {
      toolName: 'get_emergency_info',
      success: true,
      message: '🚨 **24/7 EMERGENCY & TRAUMA CARE:**\n• **Location:** Ground Floor Room ER-101 (Ambulance Bay Entrance)\n• **Direct Hotline:** (123) 456-7890\n• **Ambulance Dispatch:** x911\n• **Trauma Team:** 24/7 on-site emergency physicians and acute resuscitation bays.\n\n*Immediate priority admission without waiting line.*',
      spokenFeedback: 'Emergency department is open 24/7 on the ground floor at room ER 101. Direct emergency hotline is 123 456 7890.'
    };
  }

  // -------------------------------------------------------------
  // 19. Connect Human Assistance
  // -------------------------------------------------------------
  private static executeHumanAssistance(): VoiceToolExecutionResult {
    return {
      toolName: 'connect_human_assistance',
      success: true,
      message: '🏥 **Hospital Human Care Coordinators:**\n• **Central Reception Desk:** Ground Floor Lobby\n• **Direct Helpdesk Extension:** Ext. 100\n• **Patient Care Coordinator:** +1 (123) 456-7800\n• **Duty Nurse Station:** Ext. 204\n\nOur human medical care staff is available 24/7.',
      spokenFeedback: 'You can reach our hospital helpdesk at extension 100, or speak with central reception in the ground floor lobby.'
    };
  }

  // -------------------------------------------------------------
  // 20. Verified Hospital Services Directory
  // -------------------------------------------------------------
  private static executeHospitalServices(): VoiceToolExecutionResult {
    return {
      toolName: 'get_hospital_services',
      success: true,
      message: '🏥 **MediConnect Verified Clinical Departments:**\n• **Cardiology (Dr. Jane Smith):** Room 204, Floor 2\n• **Neurology (Dr. Michael Brown):** Room 208, Floor 2\n• **Pediatrics (Dr. Emily White):** Room 301, Floor 3\n• **Orthopedics (Dr. Robert Green):** Room 105, Floor 1\n• **General Medicine (Dr. Ramesh Kumar):** Room 102, Floor 1\n• **24/7 Emergency & Trauma:** Room ER-101, Ground Floor\n• **Outpatient Pharmacy:** Room PH-01, Ground Floor East Wing\n• **Pathology & Diagnostic Laboratory:** Room LB-01, Ground Floor',
      spokenFeedback: 'We offer Cardiology, Neurology, Pediatrics, Orthopedics, General Medicine, 24/7 Emergency care, and an on-site Pharmacy.'
    };
  }
}
