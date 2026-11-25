import type { Doctor } from '../../types';
import { MOCK_DOCTORS } from '../../constants';

export interface MonthPreference {
  year: number;
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  monthName: string;
}

/**
 * Normalizes text for doctor name and department matching.
 */
function cleanQuery(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/^dr\.\s*/i, '')
    .replace(/^doctor\s*/i, '')
    .replace(/^(மருத்துவர்|டாக்டர்)\s*/i, '')
    .trim();
}

/**
 * Matches a doctor from natural language text across all 10 registered doctors.
 * Supports:
 * - Full name (e.g. "Dr. Jane Smith", "Emily White")
 * - Last name or first name (e.g. "Dr. White", "Smith", "Arjun", "Sneha", "Karan")
 * - Department / Specialty (e.g. "Cardiology", "Dentist", "Orthodontics", "Family Medicine")
 * - Multilingual doctor references (Tamil, Hindi, English)
 */
export function findDoctorByQuery(query: string, doctors: Doctor[] = MOCK_DOCTORS): Doctor | undefined {
  if (!query || !query.trim()) return undefined;
  const raw = query.toLowerCase().trim();
  const cleanQ = cleanQuery(query);

  // 0. Exact match by Doctor ID (e.g. "d001", "d002", "d010")
  let doc = doctors.find(d => d.id.toLowerCase() === raw || d.id === query);
  if (doc) return doc;

  // 1. Exact or Substring match on full name
  doc = doctors.find(d => {
    const dLower = d.name.toLowerCase();
    const dClean = cleanQuery(d.name);
    return (
      dLower === raw ||
      dClean === cleanQ ||
      raw.includes(dLower) ||
      raw.includes(dClean) ||
      dClean.includes(cleanQ)
    );
  });
  if (doc) return doc;

  // 2. Individual name part match (e.g. "Dr. White" -> "white", "Dr. Smith" -> "smith", "Arjun", "Meena")
  doc = doctors.find(d => {
    const nameParts = cleanQuery(d.name).split(/\s+/);
    return nameParts.some(part => part.length >= 3 && (cleanQ.includes(part) || raw.includes(part)));
  });
  if (doc) return doc;

  // 3. Specialty / Department matching across all 10 specialties
  // Note: Match specific terms (e.g. Orthodontics, Cosmetic Dentistry) before broader terms (Dentistry, Orthopedics)
  if (raw.includes('orthodont') || raw.includes('brace') || raw.includes('aligner')) {
    return doctors.find(d => d.specialization === 'Orthodontics');
  }
  if (raw.includes('cosmetic') && (raw.includes('dent') || raw.includes('teeth') || raw.includes('smile'))) {
    return doctors.find(d => d.specialization === 'Cosmetic Dentistry');
  }
  if (raw.includes('cardio') || raw.includes('heart') || raw.includes('இதய') || raw.includes('दिल')) {
    return doctors.find(d => d.specialization === 'Cardiology');
  }
  if (raw.includes('neuro') || raw.includes('brain') || raw.includes('மூளை') || raw.includes('நரம்பு') || raw.includes('दिमाग')) {
    return doctors.find(d => d.specialization === 'Neurology');
  }
  if (raw.includes('pediatric') || raw.includes('child') || raw.includes('குழந்தை') || raw.includes('bacche') || raw.includes('குழந்தைகள்')) {
    return doctors.find(d => d.specialization === 'Pediatrics');
  }
  if (raw.includes('ortho') || raw.includes('bone') || raw.includes('எலும்பு') || raw.includes('haddi') || raw.includes('மூட்டு')) {
    return doctors.find(d => d.specialization === 'Orthopedics');
  }
  if (raw.includes('family medicine') || raw.includes('family doctor') || raw.includes('குடும்ப')) {
    return doctors.find(d => d.specialization === 'Family Medicine');
  }
  if (raw.includes('internal medicine') || raw.includes('internist') || raw.includes('உள் மருத்துவம்')) {
    return doctors.find(d => d.specialization === 'Internal Medicine');
  }
  if (raw.includes('dent') || raw.includes('tooth') || raw.includes('teeth') || raw.includes('பல்') || raw.includes('daant') || raw.includes('பற்கள்')) {
    return doctors.find(d => d.specialization === 'Dentistry');
  }
  if (
    raw.includes('general') ||
    raw.includes('physician') ||
    raw.includes('fever') ||
    raw.includes('cough') ||
    raw.includes('காய்ச்சல்') ||
    raw.includes('bukhar') ||
    raw.includes('பொது மருத்துவம்')
  ) {
    return doctors.find(d => d.specialization === 'General Physician');
  }

  // 4. Substring search in specialization
  doc = doctors.find(d => {
    const sLower = d.specialization.toLowerCase();
    return raw.includes(sLower) || sLower.includes(raw);
  });

  return doc;
}

/**
 * Extracts normalized department specialty from natural language text.
 * Covers all 10 departments in MediConnect.
 */
export function extractSpecialty(text: string): string | undefined {
  const q = text.toLowerCase();
  if (q.includes('orthodont') || q.includes('brace') || q.includes('aligner')) return 'Orthodontics';
  if (q.includes('cosmetic') && (q.includes('dent') || q.includes('teeth') || q.includes('smile'))) return 'Cosmetic Dentistry';
  if (q.includes('cardio') || q.includes('heart') || q.includes('இதயம்') || q.includes('இதய') || q.includes('दिल')) return 'Cardiology';
  if (q.includes('neuro') || q.includes('brain') || q.includes('மூளை') || q.includes('நரம்பு') || q.includes('दिमाग')) return 'Neurology';
  if (q.includes('pediatric') || q.includes('child') || q.includes('குழந்தை') || q.includes('bacche') || q.includes('குழந்தைகள்')) return 'Pediatrics';
  if (q.includes('ortho') || q.includes('bone') || q.includes('எலும்பு') || q.includes('haddi') || q.includes('மூட்டு')) return 'Orthopedics';
  if (q.includes('family medicine') || q.includes('family doctor') || q.includes('family physician') || q.includes('குடும்ப')) return 'Family Medicine';
  if (q.includes('internal medicine') || q.includes('internist') || q.includes('உள் மருத்துவம்')) return 'Internal Medicine';
  if (q.includes('dent') || q.includes('tooth') || q.includes('teeth') || q.includes('பல்') || q.includes('daant') || q.includes('பற்கள்')) return 'Dentistry';
  if (q.includes('general') || q.includes('physician') || q.includes('fever') || q.includes('cough') || q.includes('காய்ச்சல்') || q.includes('bukhar') || q.includes('பொது மருத்துவம்')) return 'General Physician';
  return undefined;
}

/**
 * Returns all distinct departments from available doctors.
 */
export function getAllDepartments(doctors: Doctor[] = MOCK_DOCTORS): string[] {
  return Array.from(new Set(doctors.map(d => d.specialization)));
}

/**
 * Month definition table for multi-language month resolution.
 */
const MONTH_NAMES = [
  { name: 'January', aliases: ['january', 'jan', 'ஜனவரி', 'जनवरी'], index: 0 },
  { name: 'February', aliases: ['february', 'feb', 'பிப்ரவரி', 'फ़रवरी'], index: 1 },
  { name: 'March', aliases: ['march', 'mar', 'மார்ச்', 'मार्च'], index: 2 },
  { name: 'April', aliases: ['april', 'apr', 'ஏப்ரல்', 'अप्रैल'], index: 3 },
  { name: 'May', aliases: ['may', 'மே', 'मई'], index: 4 },
  { name: 'June', aliases: ['june', 'jun', 'ஜூன்', 'जून'], index: 5 },
  { name: 'July', aliases: ['july', 'jul', 'ஜூலை', 'जुलाई'], index: 6 },
  { name: 'August', aliases: ['august', 'aug', 'ஆகஸ்ட்', 'अगस्त'], index: 7 },
  { name: 'September', aliases: ['september', 'sep', 'sept', 'செப்டம்பர்', 'सितंबर'], index: 8 },
  { name: 'October', aliases: ['october', 'oct', 'அக்டோபர்', 'अक्टूबर'], index: 9 },
  { name: 'November', aliases: ['november', 'nov', 'நவம்பர்', 'नवंबर'], index: 10 },
  { name: 'December', aliases: ['december', 'dec', 'டிசம்பர்', 'दिसंबर'], index: 11 }
];

function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Detects if the user provided ONLY a month (e.g. "next month", "in December", "December 2026")
 * without a specific day number.
 * Used to trigger date-selection guidance instead of assuming a date.
 */
export function detectMonthOnly(text: string, baseDate: Date = new Date()): MonthPreference | undefined {
  const q = text.toLowerCase().trim();

  // If text contains a day number, it is not month-only!
  // e.g. "december 15", "15th december", "december 15th", "2026-12-15"
  if (/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/.test(q)) return undefined;
  if (/\b\d{1,2}(?:st|nd|rd|th)?\b/.test(q)) {
    // Check if the number is NOT just a 4-digit year like 2026 or 2027
    const matches = q.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/g);
    if (matches && matches.some(m => {
      const num = parseInt(m.replace(/\D/g, ''), 10);
      return num >= 1 && num <= 31;
    })) {
      // It has a day of month, check if followed/preceded by month
      const hasMonthWord = MONTH_NAMES.some(m => m.aliases.some(a => q.includes(a)));
      if (hasMonthWord) {
        return undefined; // Handled as specific date!
      }
    }
  }

  // 1. "Next month" / "அடுத்த மாதம்" / "अगले महीने"
  if (
    q.includes('next month') ||
    q.includes('coming month') ||
    q.includes('adutha maasam') ||
    q.includes('அடுத்த மாதம்') ||
    q.includes('அடுத்த மாசம்') ||
    q.includes('agla mahina') ||
    q.includes('agle mahine')
  ) {
    const nextMonthDate = new Date(baseDate);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const mIdx = nextMonthDate.getMonth();
    return {
      year: nextMonthDate.getFullYear(),
      month: mIdx,
      monthName: MONTH_NAMES[mIdx].name
    };
  }

  // 2. Specific named month (e.g. "in December", "December 2026", "January")
  for (const m of MONTH_NAMES) {
    for (const alias of m.aliases) {
      const regex = new RegExp(`\\b${alias}\\b`, 'i');
      if (regex.test(q)) {
        // Extract optional year if mentioned
        const yearMatch = q.match(/\b(202[5-9]|203[0-9])\b/);
        let year = yearMatch ? parseInt(yearMatch[1], 10) : baseDate.getFullYear();
        // If no year specified and target month is earlier than current month, assume next year
        if (!yearMatch && m.index < baseDate.getMonth()) {
          year += 1;
        }
        return {
          year,
          month: m.index,
          monthName: m.name
        };
      }
    }
  }

  return undefined;
}

/**
 * Calculates date for a weekday (e.g. Friday, next Monday, this Friday).
 */
function getUpcomingWeekday(targetDayIndex: number, isNextWeek: boolean, baseDate: Date): Date {
  const currentDayIndex = baseDate.getDay();
  let daysToAdd = (targetDayIndex - currentDayIndex + 7) % 7;

  if (daysToAdd === 0) {
    daysToAdd = isNextWeek ? 7 : 7; // avoid same-day past slots by jumping to next occurrence
  } else if (isNextWeek && daysToAdd <= 3) {
    daysToAdd += 7;
  }

  const result = new Date(baseDate);
  result.setDate(result.getDate() + daysToAdd);
  return result;
}

/**
 * Comprehensive Natural Language Date Parser.
 * Supports:
 * - "today", "tomorrow", "day after tomorrow"
 * - ISO dates (e.g. "2026-11-30")
 * - Specific dates: "December 15", "December 15th", "15th December", "15 Dec", "January 10", "Jan 10"
 * - Weekdays: "next Monday", "Friday", "this Friday", "next Friday"
 * - Offsets: "next week", "in 3 days", "two months from now"
 * - Multilingual dates in Tamil, Hindi, Tanglish, and English
 * - Standalone day numbers when a month-preference was previously established (e.g. "15" -> Dec 15)
 */
export function parseDateFromText(
  text: string,
  baseDate: Date = new Date(),
  pendingMonth?: MonthPreference
): string | undefined {
  const q = text.toLowerCase().trim();

  // 1. ISO YYYY-MM-DD
  const isoMatch = q.match(/\b(202[5-9]|203[0-9])-\d{2}-\d{2}\b/);
  if (isoMatch) return isoMatch[0];

  // 2. Relative keywords: Today
  if (
    q.includes('today') ||
    q.includes('iniku') ||
    q.includes('inraiku') ||
    q.includes('இன்று') ||
    q.includes('இன்னிக்கு') ||
    q.includes('aaj')
  ) {
    return formatIsoDate(baseDate);
  }

  // 3. Relative keywords: Day after tomorrow
  if (
    q.includes('day after tomorrow') ||
    q.includes('day after') ||
    q.includes('naalaikku marunaal') ||
    q.includes('marunaal') ||
    q.includes('நாளை மறுநாள்') ||
    q.includes('parso') ||
    q.includes('परसों')
  ) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 2);
    return formatIsoDate(d);
  }

  // 4. Relative keywords: Tomorrow
  if (
    q.includes('tomorrow') ||
    q.includes('naalai') ||
    q.includes('naalaikku') ||
    q.includes('நாளை') ||
    q.includes('நாளைக்கு') ||
    q.includes('kal')
  ) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 1);
    return formatIsoDate(d);
  }

  // 5. Offsets: "two months from now" / "2 months from now"
  const monthsOffsetMatch = q.match(/(\d+|one|two|three)\s+months?\s+(?:from now|later|after)/i);
  if (monthsOffsetMatch) {
    const numWords: Record<string, number> = { one: 1, two: 2, three: 3 };
    const count = parseInt(monthsOffsetMatch[1], 10) || numWords[monthsOffsetMatch[1].toLowerCase()] || 2;
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + count);
    return formatIsoDate(d);
  }

  // 6. Offsets: "next week" / "in N days" / "in N weeks"
  if (q.includes('next week') || q.includes('adutha vaaram') || q.includes('அடுத்த வாரம்') || q.includes('agle hafte')) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 7);
    return formatIsoDate(d);
  }

  const daysOffsetMatch = q.match(/in\s+(\d+)\s+days?/i);
  if (daysOffsetMatch) {
    const count = parseInt(daysOffsetMatch[1], 10);
    const d = new Date(baseDate);
    d.setDate(d.getDate() + count);
    return formatIsoDate(d);
  }

  // 7. Weekdays (e.g. "next Friday", "Friday", "this Monday", "coming Friday")
  const weekdayNames = [
    { name: 'sunday', idx: 0, aliases: ['sunday', 'sun', 'ஞாயிறு', 'रविवार'] },
    { name: 'monday', idx: 1, aliases: ['monday', 'mon', 'திங்கள்', 'thingal', 'सोमवार'] },
    { name: 'tuesday', idx: 2, aliases: ['tuesday', 'tue', 'செவ்வாய்', 'sevvai', 'मंगलवार'] },
    { name: 'wednesday', idx: 3, aliases: ['wednesday', 'wed', 'புதன்', 'budhan', 'बुधवार'] },
    { name: 'thursday', idx: 4, aliases: ['thursday', 'thu', 'வியாழன்', 'vyazhan', 'गुरुवार'] },
    { name: 'friday', idx: 5, aliases: ['friday', 'fri', 'வெள்ளி', 'velli', 'शुक्रवार'] },
    { name: 'saturday', idx: 6, aliases: ['saturday', 'sat', 'சனி', 'sani', 'शनिवार'] }
  ];

  for (const w of weekdayNames) {
    for (const alias of w.aliases) {
      const reg = new RegExp(`\\b${alias}\\b`, 'i');
      if (reg.test(q)) {
        const isNext = q.includes('next') || q.includes('அடுத்த') || q.includes('अगले');
        const d = getUpcomingWeekday(w.idx, isNext, baseDate);
        return formatIsoDate(d);
      }
    }
  }

  // 8. Named Month + Day Number (e.g. "December 15", "December 15th", "15th December", "15 Dec")
  for (const m of MONTH_NAMES) {
    for (const alias of m.aliases) {
      // Format A: "December 15" or "December 15th" or "December 15, 2026"
      const regA = new RegExp(`\\b${alias}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b`, 'i');
      const matchA = q.match(regA);
      if (matchA) {
        const day = parseInt(matchA[1], 10);
        let year = matchA[2] ? parseInt(matchA[2], 10) : baseDate.getFullYear();
        if (!matchA[2] && m.index < baseDate.getMonth()) {
          year += 1;
        }
        const d = new Date(year, m.index, day);
        return formatIsoDate(d);
      }

      // Format B: "15th of December" or "15th December" or "15 Dec"
      const regB = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${alias}(?:\\s*,?\\s*(\\d{4}))?\\b`, 'i');
      const matchB = q.match(regB);
      if (matchB) {
        const day = parseInt(matchB[1], 10);
        let year = matchB[2] ? parseInt(matchB[2], 10) : baseDate.getFullYear();
        if (!matchB[2] && m.index < baseDate.getMonth()) {
          year += 1;
        }
        const d = new Date(year, m.index, day);
        return formatIsoDate(d);
      }
    }
  }

  // 9. Day number only when a Month Preference was already established in conversation
  // e.g. previous turn: patient asked for "next month" (December 2026), current turn says "15" or "18th"
  if (pendingMonth) {
    const dayMatch = q.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
    if (dayMatch) {
      const day = parseInt(dayMatch[1], 10);
      if (day >= 1 && day <= 31) {
        const d = new Date(pendingMonth.year, pendingMonth.month, day);
        return formatIsoDate(d);
      }
    }
  }

  return undefined;
}

/**
 * Natural Language Time Slot Parser.
 */
export function parseTimeFromText(text: string, availableSlots?: string[]): string {
  const q = text.toLowerCase();
  if (availableSlots && availableSlots.length > 0) {
    if (q.includes('first') || q.includes('earlier') || q.includes('modhal') || q.includes('முதல்') || q.includes('pehla')) {
      return availableSlots[0];
    }
    if (q.includes('second') || q.includes('later') || q.includes('aduthu') || q.includes('இரண்டாவது') || q.includes('doosra')) {
      return availableSlots[1] || availableSlots[0];
    }
    const matchSlot = availableSlots.find(s => q.includes(s.toLowerCase().replace(':00', '').trim()));
    if (matchSlot) return matchSlot;
  }

  if (q.includes('9') || q.includes('09')) return '09:00 AM';
  if (q.includes('10') || q.includes('பத்து') || q.includes('das')) return '10:00 AM';
  if (q.includes('11:30') || q.includes('11 30')) return '11:30 AM';
  if (q.includes('11') || q.includes('பதினொன்று') || q.includes('gyarah')) return '11:30 AM';
  if (q.includes('12') || q.includes('பன்னிரண்டு') || q.includes('barah')) return '12:00 PM';
  if (q.includes('1') || q.includes('01')) return '01:00 PM';
  if (q.includes('2') || q.includes('02')) return '02:00 PM';
  if (q.includes('3') || q.includes('03')) return '03:00 PM';
  if (q.includes('4') || q.includes('04')) return '04:00 PM';
  return '10:00 AM';
}
