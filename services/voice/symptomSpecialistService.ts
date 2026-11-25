import { MOCK_DOCTORS } from '../../constants';
import type { Doctor } from '../../types';

export interface SymptomMatchResult {
  department: string;
  doctorId: string;
  doctorName: string;
  doctorExperience: number;
  doctorAvailability: string;
  roomNumber: string;
  floor: string;
  primaryCondition: string;
  isEmergency: boolean;
  emergencyWarning?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  explanations: {
    en: string;
    ta: string;
    hi: string;
    mixed: string;
  };
  suggestedResponses: {
    en: string;
    ta: string;
    hi: string;
    mixed: string;
  };
}

export interface DoctorMappingRecord {
  department: string;
  doctorId: string;
  doctorName: string;
  roomNumber: string;
  floor: string;
  keywordsEn: string[];
  keywordsTa: string[];
  keywordsTanglish: string[];
  keywordsHi: string[];
  keywordsHinglish: string[];
}

export const DOCTOR_SPECIALTY_DIRECTORY: DoctorMappingRecord[] = [
  // 1. Dentistry – Dr. Priya Sharma (d008)
  {
    department: 'Dentistry',
    doctorId: 'd008',
    doctorName: 'Dr. Priya Sharma',
    roomNumber: 'Room 108',
    floor: 'Floor 1',
    keywordsEn: [
      'tooth pain', 'toothache', 'tooth ache', 'teeth hurt', 'tooth hurt', 'tooth hurting',
      'gum pain', 'bleeding gums', 'tooth decay', 'cavity', 'cavities', 'wisdom tooth',
      'dental pain', 'tooth infection', 'swollen gums', 'sensitive teeth', 'broken tooth',
      'dentist', 'dental', 'teeth problem', 'gum swelling', 'molar pain'
    ],
    keywordsTa: [
      'பல் வலி', 'பல் சொத்தை', 'ஈறு வலி', 'ஈறுகளில் ரத்தம்', 'பல் கூச்சம்', 'பல்', 'பற்கள் வலி',
      'பல் வீக்கம்', 'ஈறு வீக்கம்', 'பல் உடைந்தது', 'பல் பிரச்சனை'
    ],
    keywordsTanglish: [
      'pal vali', 'pallu vali', 'pal sothe', 'eeru vali', 'tooth vali', 'pallu valikuthu',
      'pal valikuthu', 'pal valikkuthu', 'dant vali', 'teeth vali', 'pal problem', 'pallu sothe'
    ],
    keywordsHi: [
      'दांत में दर्द', 'दांत दर्द', 'दांतों में दर्द', 'मसूड़ों में दर्द', 'मसूड़ों से खून', 'दांत खराब',
      'दांत में कीड़ा', 'दांत टूट गया', 'दांत की समस्या'
    ],
    keywordsHinglish: [
      'daant mein dard', 'dant dard', 'daant dard', 'masudo mein dard', 'dant kharab',
      'daant me keeda', 'daant toot gaya', 'danto me dard'
    ]
  },

  // 2. Orthodontics – Dr. Karan Patel (d009)
  {
    department: 'Orthodontics',
    doctorId: 'd009',
    doctorName: 'Dr. Karan Patel',
    roomNumber: 'Room 109',
    floor: 'Floor 1',
    keywordsEn: [
      'braces', 'teeth alignment', 'crooked teeth', 'misaligned teeth', 'straighten teeth',
      'overbite', 'underbite', 'bite correction', 'gap in teeth', 'teeth gap', 'dental clips',
      'wire teeth', 'aligners', 'invisalign', 'orthodontic', 'jaw alignment'
    ],
    keywordsTa: [
      'பல் சீரமைப்பு', 'பல் கிளிப்', 'கோணலான பற்கள்', 'பல் இடைவெளி', 'பற்கள் நேராக்க',
      'பல் கிளிப்புகள்', 'பல் கம்பிகள்'
    ],
    keywordsTanglish: [
      'teeth alignment', 'pal clip', 'braces podanum', 'pal seeraamaippu', 'teeth gap',
      'crooked teeth', 'pal kambi', 'pal straight pannanum', 'braces'
    ],
    keywordsHi: [
      'दांत सीधे करना', 'दांतों का अलाइनमेंट', 'ब्रेसेस', 'टेढ़े मेढ़े दांत', 'दांतों के बीच गैप',
      'तार लगवाना', 'ऑर्थोडॉन्टिक्स'
    ],
    keywordsHinglish: [
      'braces lagwana', 'tedhe daant', 'daant seedhe karne', 'danto me gap', 'tedhe daant theek karna',
      'teeth alignment karana', 'dental clip lagana'
    ]
  },

  // 3. Cosmetic Dentistry – Dr. Sneha Rao (d010)
  {
    department: 'Cosmetic Dentistry',
    doctorId: 'd010',
    doctorName: 'Dr. Sneha Rao',
    roomNumber: 'Room 110',
    floor: 'Floor 1',
    keywordsEn: [
      'cosmetic dentistry', 'teeth whitening', 'smile makeover', 'smile design', 'aesthetic dental',
      'veneers', 'yellow teeth', 'stained teeth', 'cosmetic smile', 'smile improvement',
      'aesthetic smile', 'teeth bleaching', 'smile correction'
    ],
    keywordsTa: [
      'அழகான புன்னகை', 'பல் வெண்மையாக்குதல்', 'பற்கள் வெண்மை', 'புன்னகை சீரமைப்பு',
      'மஞ்சள் பற்கள்', 'பல் அழகு'
    ],
    keywordsTanglish: [
      'smile makeover', 'teeth whitening', 'azhagana smile', 'cosmetic teeth', 'yellow pallu',
      'smile design', 'teeth polish'
    ],
    keywordsHi: [
      'स्माइल मेकओवर', 'दांत सफेद करना', 'कॉस्मेटिक डेंटिस्ट्री', 'दांतों का पीलापन',
      'मुस्कान सुधार', 'दांत चमकाना'
    ],
    keywordsHinglish: [
      'teeth whitening karana', 'daant safed karna', 'smile makeover chahiye', 'daanto ka peelapan',
      'cosmetic smile', 'aesthetic dental'
    ]
  },

  // 4. Orthopedics – Dr. Robert Green (d004)
  {
    department: 'Orthopedics',
    doctorId: 'd004',
    doctorName: 'Dr. Robert Green',
    roomNumber: 'Room 103',
    floor: 'Floor 1',
    keywordsEn: [
      'joint pain', 'knee pain', 'back pain', 'knee hurts', 'joints hurt', 'bone fracture',
      'broken bone', 'arthritis', 'shoulder pain', 'hip pain', 'ankle sprain', 'neck pain',
      'spine pain', 'ligament tear', 'swollen joint', 'bone pain', 'osteoarthritis',
      'joints are hurting', 'knee and joints', 'difficulty walking', 'leg pain', 'wrist pain',
      'orthopedic'
    ],
    keywordsTa: [
      'மூட்டு வலி', 'முழங்கால் வலி', 'முதுகு வலி', 'எலும்பு முறிவு', 'மூட்டு வீக்கம்',
      'தோள்பட்டை வலி', 'இடுப்பு வலி', 'கழுத்து வலி', 'எலும்பு வலி', 'கை கால் வலி', 'மூட்டுகள் வலிக்கின்றன'
    ],
    keywordsTanglish: [
      'kaal mutti valikuthu', 'mutti vali', 'joint pain', 'mutti valikkuthu', 'muthugu vali',
      'kaal vali', 'elumbu murivu', 'knee pain', 'joint vali', 'kai kaal vali', 'hip vali',
      'nadakka mudiyala', 'knee swelling'
    ],
    keywordsHi: [
      'घुटने में दर्द', 'जोड़ों में दर्द', 'कमर दर्द', 'पीठ दर्द', 'हड्डी टूटना', 'हड्डी में दर्द',
      'घुटने का दर्द', 'जोड़ों की सूजन', 'चलने में तकलीफ', 'गठिया'
    ],
    keywordsHinglish: [
      'ghutne mein dard', 'jodon mein dard', 'kamar dard', 'peeth dard', 'haddi tutna',
      'ghutna dard', 'joint me dard', 'chalne me dikkat', 'ghutna sooj gaya', 'haddi me dard'
    ]
  },

  // 5. Cardiology – Dr. Jane Smith (d001)
  {
    department: 'Cardiology',
    doctorId: 'd001',
    doctorName: 'Dr. Jane Smith',
    roomNumber: 'Room 102',
    floor: 'Floor 1',
    keywordsEn: [
      'chest pain', 'heart pain', 'heart palpitations', 'irregular heartbeat', 'high blood pressure',
      'angina', 'heart murmur', 'cardiac concern', 'heart racing', 'chest tightness', 'heart problem',
      'heart disease', 'hypertension', 'cardio'
    ],
    keywordsTa: [
      'நெஞ்சு வலி', 'இதய துடிப்பு', 'இதய வலி', 'உயர் ரத்த அழுத்தம்', 'மாரடைப்பு பயம்',
      'மார்பில் பாரம்', 'இதய பிரச்சனை'
    ],
    keywordsTanglish: [
      'nenju vali', 'heart vali', 'heart beat adigama irukku', 'chest heavy', 'chest pain',
      'heart problem', 'nenjula barama irukku', 'blood pressure high'
    ],
    keywordsHi: [
      'सीने में दर्द', 'दिल में दर्द', 'दिल की धड़कन', 'हाई ब्लड प्रेशर', 'छाती में दर्द',
      'दिल की बीमारी', 'घबराहट'
    ],
    keywordsHinglish: [
      'seene mein dard', 'dil mein dard', 'dil ki dhadkan', 'chhati mein dard', 'heart problem',
      'seene me jalan', 'bp badh gaya', 'dil tezi se dhadak raha'
    ]
  },

  // 6. Neurology – Dr. Michael Brown (d002)
  {
    department: 'Neurology',
    doctorId: 'd002',
    doctorName: 'Dr. Michael Brown',
    roomNumber: 'Room 202',
    floor: 'Floor 2',
    keywordsEn: [
      'headache', 'headaches', 'migraine', 'migraines', 'nerve pain', 'neuropathy', 'dizziness',
      'vertigo', 'seizure', 'tremors', 'memory loss', 'numbness in fingers', 'tingling sensation',
      'throbbing head', 'chronic headache', 'nervous system', 'loss of balance', 'shaking hands'
    ],
    keywordsTa: [
      'தலைவலி', 'ஒற்றைத் தலைவலி', 'நரம்பு வலி', 'மயக்கம்', 'தலை சுற்றல்', 'நடுக்கம்',
      'மறதி', 'கைகள் மரத்துப்போதல்', 'வலிப்பு'
    ],
    keywordsTanglish: [
      'thalai vali', 'migraine irukku', 'narambu vali', 'thalasuthu', 'mayakkam',
      'severe head pain', 'head weight', 'kai maruthu pochchu'
    ],
    keywordsHi: [
      'सिरदर्द', 'माइग्रेन', 'नसों में दर्द', 'चक्कर आना', 'दौरे', 'सिर में तेज दर्द',
      'हाथ पैर सुन्न होना', 'भूलने की बीमारी'
    ],
    keywordsHinglish: [
      'sar dard', 'sir dard', 'migraine hai', 'naso mein dard', 'chakkar aana',
      'sir ghoom raha', 'haath pair sunn hona', 'aadha sar dard'
    ]
  },

  // 7. Pediatrics – Dr. Emily White (d003)
  {
    department: 'Pediatrics',
    doctorId: 'd003',
    doctorName: 'Dr. Emily White',
    roomNumber: 'Room 104',
    floor: 'Floor 1',
    keywordsEn: [
      'child', 'children', 'baby', 'toddler', 'infant', 'kid', 'pediatric', 'pediatrics',
      'childhood', 'child fever', 'baby fever', 'childhood illness', 'toddler sick', 'kid vomiting',
      'infant cough', 'child vaccination', 'baby rash', 'newborn care',
      'child health', 'my kid is sick', 'my daughter is sick', 'my son has fever'
    ],
    keywordsTa: [
      'குழந்தை காய்ச்சல்', 'குழந்தை உடல்நலம்', 'குழந்தைக்கு இருமல்', 'பச்சிளங்குழந்தை',
      'குழந்தை வாந்தி', 'குழந்தைக்கு தடுப்பூசி'
    ],
    keywordsTanglish: [
      'kuzhandhaiukku kachil', 'kuzhandhai udambu sariyilla', 'baby fever', 'kid fever',
      'paapa ku fever', 'kuzhandhaikku salli', 'chinna pappa udambu sari illa'
    ],
    keywordsHi: [
      'बच्चे को बुखार', 'बच्चे की तबीयत खराब', 'शिशु रोग', 'बच्चे को उल्टी', 'नवजात शिशु',
      'बाल रोग', 'बच्चे को खांसी'
    ],
    keywordsHinglish: [
      'bachhe ko bukhar', 'baby ko fever', 'bachhe ki bimari', 'bacha bimar hai',
      'baby ko ulti', 'kid fever'
    ]
  },

  // 8. General Physician – Dr. Ramesh Kumar (d005)
  {
    department: 'General Physician',
    doctorId: 'd005',
    doctorName: 'Dr. Ramesh Kumar',
    roomNumber: 'Room 101',
    floor: 'Floor 1',
    keywordsEn: [
      'general fever', 'common cold', 'flu', 'fever and chills', 'body aches', 'viral infection',
      'sore throat', 'seasonal allergy', 'mild weakness', 'general illness', 'cough and cold',
      'runny nose', 'sneezing', 'general sickness'
    ],
    keywordsTa: [
      'பொது காய்ச்சல்', 'சளி மற்றும் இருமல்', 'உடல் வலி', 'வைரஸ் காய்ச்சல்', 'தொண்டை வலி',
      'தும்மல்', 'சாதாரண காய்ச்சல்'
    ],
    keywordsTanglish: [
      'general fever', 'udal vali', 'kaachal', 'sali irukku', 'body pain', 'general cold',
      'sali pidichurukku', 'mild fever'
    ],
    keywordsHi: [
      'सामान्य बुखार', 'सर्दी जुकाम', 'बदन दर्द', 'वायरल बुखार', 'गले में खराश', 'छींक आना',
      'कमजोरी', 'हल्का बुखार'
    ],
    keywordsHinglish: [
      'samanya bukhar', 'bukhar aur sardi', 'badan dard', 'gale me kharash', 'sardi jukham',
      'viral bukhar', 'halka bukhar'
    ]
  },

  // 9. Family Medicine – Dr. Meena Raj (d006)
  {
    department: 'Family Medicine',
    doctorId: 'd006',
    doctorName: 'Dr. Meena Raj',
    roomNumber: 'Room 105',
    floor: 'Floor 1',
    keywordsEn: [
      'family health', 'family wellness', 'routine family checkup', 'preventive family care',
      'annual physical', 'general health check', 'family doctor', 'family consultation'
    ],
    keywordsTa: [
      'குடும்ப மருத்துவம்', 'குடும்ப நல பரிசோதனை', 'வழக்கமான பரிசோதனை', 'குடும்ப நலன்'
    ],
    keywordsTanglish: [
      'family health checkup', 'family doctor consult', 'kudumba maruthuvar', 'routine family checkup'
    ],
    keywordsHi: [
      'पारिवारिक स्वास्थ्य', 'परिवार का स्वास्थ्य परीक्षण', 'रूटीन चेकअप', 'फैमिली डॉक्टर'
    ],
    keywordsHinglish: [
      'parivar ka checkup', 'family doctor', 'routine checkup pure parivar ka'
    ]
  },

  // 10. Internal Medicine – Dr. Arjun Das (d007)
  {
    department: 'Internal Medicine',
    doctorId: 'd007',
    doctorName: 'Dr. Arjun Das',
    roomNumber: 'Room 106',
    floor: 'Floor 1',
    keywordsEn: [
      'internal medicine', 'adult illnesses', 'chronic fatigue in adults', 'metabolic syndrome',
      'unexplained weight loss', 'adult complex health', 'systemic condition', 'chronic adult illness'
    ],
    keywordsTa: [
      'உள் மருத்துவம்', 'பெரியவர்களுக்கான உடல்நலம்', 'நீண்டகால சோர்வு', 'உடல் எடை குறைவு'
    ],
    keywordsTanglish: [
      'internal medicine consult', 'chronic adult fatigue', 'adult complex health', 'chronic illness'
    ],
    keywordsHi: [
      'इंटरनल मेडिसिन', 'वयस्कों की बीमारियाँ', 'पुरानी थकान', 'अस्पष्ट वजन कम होना'
    ],
    keywordsHinglish: [
      'internal medicine doctor', 'adult bimari', 'purani thakan', 'badi bimari checkup'
    ]
  }
];

/**
 * Checks for life-threatening acute emergency indicators.
 */
export function checkEmergencySymptoms(text: string): { isEmergency: boolean; warning?: string } {
  const q = text.toLowerCase();
  const emergencyKeywords = [
    'crushing chest pain', 'cannot breathe', 'difficulty breathing', 'heavy bleeding',
    'coughing blood', 'unconscious', 'fainted', 'stroke', 'face drooping', 'arm numbness',
    'suicide', 'மாரடைப்பு', 'மூச்சு திணறல்', 'ரத்தம் கொட்டுகிறது', 'மயக்கம் போட்டு விழுந்தார்',
    'saans lene me takleef', 'seene me tez dard', 'behosh'
  ];

  const matched = emergencyKeywords.some(kw => q.includes(kw));
  if (matched) {
    return {
      isEmergency: true,
      warning: '🚨 Acute emergency detected. Please seek immediate emergency medical care at Room ER-101 (Ground Floor) or call our 24/7 hotline (123) 456-7890 / 108.'
    };
  }
  return { isEmergency: false };
}

/**
 * Matches symptom description to the most appropriate hospital specialist.
 * Uses strict priority order: Specialized departments ALWAYS take precedence over General Medicine.
 */
export function matchSymptomToSpecialist(symptomText: string): SymptomMatchResult | null {
  if (!symptomText || symptomText.trim().length < 3) return null;

  const raw = symptomText.toLowerCase();
  const emergency = checkEmergencySymptoms(raw);

  // Score each doctor mapping record based on matching keyword lengths and precision
  let bestMatch: DoctorMappingRecord | null = null;
  let highestScore = 0;
  let matchedKeyword = '';

  for (const record of DOCTOR_SPECIALTY_DIRECTORY) {
    let score = 0;
    const allKeywords = [
      ...record.keywordsEn,
      ...record.keywordsTa,
      ...record.keywordsTanglish,
      ...record.keywordsHi,
      ...record.keywordsHinglish
    ];

    for (const kw of allKeywords) {
      const lowerKw = kw.toLowerCase();
      if (raw.includes(lowerKw)) {
        // Longer keyword matches indicate higher specificity
        const weight = lowerKw.length > 10 ? 30 : lowerKw.length > 5 ? 20 : 10;
        if (weight > score) {
          score = weight;
          matchedKeyword = kw;
        }
      }
    }

    // Special Priority rule: Specialized clinics (Dentistry, Orthodontics, Cosmetic Dentistry, Orthopedics, Cardiology, Neurology, Pediatrics)
    // receive a priority bonus so they never get overshadowed by generic words
    if (
      score > 0 &&
      record.department !== 'General Physician' &&
      record.department !== 'Family Medicine'
    ) {
      score += 15;
    }

    // If the patient is a child / infant / baby, Pediatrics ALWAYS has absolute priority
    const isPediatricQuery =
      raw.includes('child') || raw.includes('baby') || raw.includes('kid') ||
      raw.includes('toddler') || raw.includes('infant') || raw.includes('kuzhandhai') ||
      raw.includes('bachhe') || raw.includes('bacha');

    if (isPediatricQuery && record.department === 'Pediatrics') {
      score += 35;
      if (!matchedKeyword) matchedKeyword = 'child health concern';
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = record;
    }
  }

  if (!bestMatch || highestScore === 0) {
    // If ambiguous or no match found
    return null;
  }

  const doc = MOCK_DOCTORS.find(d => d.id === bestMatch!.doctorId) || {
    id: bestMatch.doctorId,
    name: bestMatch.doctorName,
    specialization: bestMatch.department,
    experience: 10,
    availability: 'Mon - Fri (9 AM - 5 PM)'
  } as Doctor;

  const department = bestMatch.department;
  const doctorName = bestMatch.doctorName;

  // Language responses customized for each department
  let enMsg = `Based on your symptoms, ${department} is the relevant department. ${doctorName} is available at our hospital. Would you like to check available appointments?`;
  let taMsg = `உங்கள் அறிகுறிகளின் அடிப்படையில், ${department} துறை பொருத்தமானது. எங்கள் மருத்துவமனையில் மருத்துவர் ${doctorName} கிடைக்கிறார். அவருடன் appointment பதிவு செய்ய விரும்புகிறீர்களா?`;
  let hiMsg = `आपके लक्षणों के अनुसार, ${department} उपयुक्त विभाग है। हमारे अस्पताल में ${doctorName} उपलब्ध हैं। क्या आप अपॉइंटमेंट की उपलब्धता देखना चाहते हैं?`;
  let mixedMsg = `${department} department unga symptoms-ku suitable. ${doctorName} namma hospital-la relevant specialist. Appointment book pannava?`;

  // Specific wording for individual departments matching prompt specifications
  if (department === 'Dentistry') {
    enMsg = `Based on your symptoms, Dentistry is the relevant department. ${doctorName} is available at our hospital. Would you like to check her appointment availability?`;
    mixedMsg = `Dentistry department suitable-ah irukkum. ${doctorName} unga dental symptoms-ku specialist. Appointment book pannava?`;
  } else if (department === 'Orthopedics') {
    enMsg = `Orthopedics is the relevant specialty for joint and knee problems. ${doctorName} is our orthopedic specialist. Would you like to check his available appointments?`;
    mixedMsg = `Orthopedics department suitable-ah irukkum. ${doctorName} unga symptoms-ku relevant specialist. Appointment book pannava?`;
  } else if (department === 'Orthodontics') {
    enMsg = `Orthodontics is the relevant department. ${doctorName} specializes in braces and teeth alignment. Would you like to schedule a consultation?`;
    mixedMsg = `Teeth alignment and braces-ku Orthodontics department suitable. ${doctorName} namma specialist. Appointment book pannava?`;
  } else if (department === 'Cosmetic Dentistry') {
    enMsg = `Cosmetic Dentistry is the relevant department for aesthetic smile improvements. ${doctorName} specializes in cosmetic procedures. Would you like to schedule an appointment?`;
    mixedMsg = `Cosmetic Dentistry department unga smile improvement-ku suitable. ${doctorName} namma specialist. Appointment book pannava?`;
  } else if (department === 'Cardiology') {
    enMsg = `Based on your symptoms, Cardiology is the recommended department. ${doctorName} is our cardiology specialist. Would you like to schedule a visit?`;
    mixedMsg = `Cardiology department unga heart symptoms-ku correct. ${doctorName} kitta appointment book pannava?`;
  } else if (department === 'Neurology') {
    enMsg = `Neurology is the relevant department for headaches and nerve-related concerns. ${doctorName} is our neurologist. Would you like to check appointment availability?`;
    mixedMsg = `Neurology department headache and nerve concerns-ku suitable. ${doctorName} kitta appointment book pannava?`;
  } else if (department === 'Pediatrics') {
    enMsg = `Pediatrics is the designated department for child health and childhood illnesses. ${doctorName} is our pediatrician. Would you like to schedule an appointment?`;
    mixedMsg = `Kuzhandhai health-ku Pediatrics department dhaan correct. ${doctorName} kitta appointment book pannava?`;
  }

  return {
    department: bestMatch.department,
    doctorId: bestMatch.doctorId,
    doctorName: bestMatch.doctorName,
    doctorExperience: doc.experience,
    doctorAvailability: doc.availability,
    roomNumber: bestMatch.roomNumber,
    floor: bestMatch.floor,
    primaryCondition: matchedKeyword || 'Described symptoms',
    isEmergency: emergency.isEmergency,
    emergencyWarning: emergency.warning,
    confidence: highestScore >= 30 ? 'high' : 'medium',
    reason: `Matched symptom pattern "${matchedKeyword}" to ${department} (${doctorName})`,
    explanations: {
      en: `Symptoms indicate clinical relevance for ${department}. Primary attending specialist: ${doctorName} (${bestMatch.roomNumber}, ${bestMatch.floor}).`,
      ta: `இந்த அறிகுறிகளுக்கு ${department} துறை மருத்துவ ஆலோசனை தேவைப்படுகிறது. சிறப்பு மருத்துவர்: ${doctorName} (${bestMatch.roomNumber}).`,
      hi: `इन लक्षणों के लिए ${department} विभाग में परामर्श की सलाह दी जाती है। विशेषज्ञ: ${doctorName} (${bestMatch.roomNumber}).`,
      mixed: `Unga symptoms-ku ${department} department recommended. Specialist: ${doctorName} (${bestMatch.roomNumber}).`
    },
    suggestedResponses: {
      en: enMsg,
      ta: taMsg,
      hi: hiMsg,
      mixed: mixedMsg
    }
  };
}
