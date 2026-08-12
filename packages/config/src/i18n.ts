/**
 * Translation framework.
 *
 * Three locales ship today: English, Urdu (اردو) and Roman Urdu. The dictionary
 * is flat and typed, so a missing key is a compile error rather than a blank
 * screen. `t()` falls back English → key so a partially translated locale never
 * renders empty text.
 */
import type { LocaleCode } from '@gymguide/types';

export const LOCALES: Array<{ code: LocaleCode; label: string; nativeLabel: string; dir: 'ltr' | 'rtl' }> = [
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', dir: 'rtl' },
  { code: 'ur_rm', label: 'Roman Urdu', nativeLabel: 'Roman Urdu', dir: 'ltr' },
];

export function localeDir(locale: LocaleCode): 'ltr' | 'rtl' {
  return locale === 'ur' ? 'rtl' : 'ltr';
}

const en = {
  'nav.today': 'Today',
  'nav.train': 'Train',
  'nav.plan': 'Plan',
  'nav.progress': 'Progress',
  'nav.support': 'Support',
  'nav.profile': 'Profile',

  'today.greeting.morning': 'Good morning',
  'today.greeting.afternoon': 'Good afternoon',
  'today.greeting.evening': 'Good evening',
  'today.heading': 'What to do today',
  'today.rest.title': 'Rest and recover',
  'today.rest.subtitle': 'Recovery is when your body adapts. Walk, hydrate, sleep well.',
  'today.start_workout': 'Start workout',
  'today.resume_workout': 'Resume workout',
  'today.view_plan': 'View plan',
  'today.streak': 'day streak',

  'workout.warmup': 'Warm-up',
  'workout.main': 'Main work',
  'workout.cooldown': 'Cool-down',
  'workout.set': 'Set',
  'workout.reps': 'Reps',
  'workout.weight': 'Weight',
  'workout.effort': 'How hard was that?',
  'workout.rest': 'Rest',
  'workout.rest_skip': 'Skip rest',
  'workout.log_set': 'Log set',
  'workout.next_exercise': 'Next exercise',
  'workout.previous_time': 'Last time',
  'workout.how_to': 'How to do it',
  'workout.form_cues': 'Form cues',
  'workout.common_mistakes': 'Common mistakes',
  'workout.safety': 'Safety',
  'workout.swap': 'Swap exercise',
  'workout.swap_reason': 'Why are you swapping?',
  'workout.finish': 'Finish workout',
  'workout.skip_exercise': 'Skip this exercise',
  'workout.report_pain': 'Something hurts',
  'workout.offline_banner': 'You are offline. Your workout is saved on this device and will sync automatically.',
  'workout.synced': 'Workout synced',
  'workout.summary.title': 'Session complete',
  'workout.summary.volume': 'Total volume',
  'workout.summary.sets': 'Sets completed',
  'workout.summary.duration': 'Duration',
  'workout.summary.records': 'New personal records',
  'workout.summary.next': 'Next session',

  'plan.title': 'Your plan',
  'plan.this_week': 'This week',
  'plan.phase': 'Phase',
  'plan.week_of': 'Week {week} of {total}',
  'plan.why_changed': 'Why did my plan change?',

  'progress.title': 'Progress',
  'progress.adherence': 'Adherence',
  'progress.weight': 'Weight',
  'progress.strength': 'Strength',
  'progress.habits': 'Habits',
  'progress.measurements': 'Measurements',
  'progress.photos': 'Photos',
  'progress.weekly_review': 'Weekly review',
  'progress.monthly_report': 'Monthly report',
  'progress.milestones': 'Milestones',
  'progress.no_data': 'Log a few sessions and your trends will appear here.',

  'nutrition.title': 'Nutrition',
  'nutrition.plate_guide': 'Your plate today',
  'nutrition.protein': 'Protein',
  'nutrition.carbs': 'Carbs',
  'nutrition.fat': 'Fat',
  'nutrition.veg': 'Vegetables',
  'nutrition.water': 'Water',
  'nutrition.log_meal': 'Log a meal',
  'nutrition.grocery_list': 'Grocery list',
  'nutrition.ramadan_note': 'Ramadan schedule is on: sehri and iftar guidance shown.',

  'support.title': 'Support',
  'support.ask_coach': 'Ask GymGuide Coach',
  'support.talk_to_staff': 'Talk to gym staff',
  'support.ai_label': 'AI-assisted',
  'support.ai_disclaimer':
    'GymGuide Coach explains your approved plan and exercise technique. It is not a doctor, physiotherapist or dietitian.',
  'support.escalated': 'A member of gym staff has been notified and will contact you.',
  'support.new_case': 'New request',

  'safety.stop_title': 'Please stop and check in with staff',
  'safety.stop_body':
    'What you described needs a person, not an app. We have paused automatic changes to your plan and told the gym team.',
  'safety.progression_paused': 'Automatic progression is paused while staff review this.',
  'safety.emergency':
    'If you feel chest pain, faint, or cannot breathe properly, stop exercising and seek medical help immediately.',

  'checkin.title': 'Weekly check-in',
  'checkin.sleep': 'Sleep quality',
  'checkin.stress': 'Stress',
  'checkin.soreness': 'Soreness',
  'checkin.energy': 'Energy',
  'checkin.nutrition': 'Nutrition',
  'checkin.wins': 'What went well?',
  'checkin.blockers': 'What got in the way?',
  'checkin.submit': 'Submit check-in',

  'billing.title': 'Membership & payments',
  'billing.due': 'Due',
  'billing.paid': 'Paid',
  'billing.overdue': 'Overdue',
  'billing.receipt': 'Receipt',
  'billing.pay_at_desk': 'You can pay at the front desk or by bank transfer.',

  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.next': 'Next',
  'common.back': 'Back',
  'common.done': 'Done',
  'common.skip': 'Skip',
  'common.loading': 'Loading',
  'common.retry': 'Try again',
  'common.optional': 'Optional',
  'common.required': 'Required',
  'common.why_we_ask': 'Why we ask',
  'common.private': 'Private to you',
} as const;

export type TranslationKey = keyof typeof en;

type Dictionary = Partial<Record<TranslationKey, string>>;

const ur: Dictionary = {
  'nav.today': 'آج',
  'nav.train': 'ورزش',
  'nav.plan': 'پلان',
  'nav.progress': 'پیش رفت',
  'nav.support': 'مدد',
  'nav.profile': 'پروفائل',

  'today.greeting.morning': 'صبح بخیر',
  'today.greeting.afternoon': 'السلام علیکم',
  'today.greeting.evening': 'شام بخیر',
  'today.heading': 'آج کیا کرنا ہے',
  'today.rest.title': 'آرام کا دن',
  'today.rest.subtitle': 'آرام کے دوران جسم مضبوط ہوتا ہے۔ چہل قدمی کریں، پانی پئیں، نیند پوری کریں۔',
  'today.start_workout': 'ورزش شروع کریں',
  'today.resume_workout': 'ورزش جاری رکھیں',
  'today.view_plan': 'پلان دیکھیں',

  'workout.warmup': 'وارم اپ',
  'workout.main': 'اصل ورزش',
  'workout.cooldown': 'کول ڈاؤن',
  'workout.set': 'سیٹ',
  'workout.reps': 'ریپس',
  'workout.weight': 'وزن',
  'workout.effort': 'کتنی مشکل تھی؟',
  'workout.rest': 'آرام',
  'workout.log_set': 'سیٹ محفوظ کریں',
  'workout.how_to': 'طریقہ',
  'workout.form_cues': 'اہم نکات',
  'workout.common_mistakes': 'عام غلطیاں',
  'workout.safety': 'احتیاط',
  'workout.swap': 'ورزش تبدیل کریں',
  'workout.finish': 'ورزش مکمل کریں',
  'workout.report_pain': 'تکلیف ہو رہی ہے',
  'workout.offline_banner': 'انٹرنیٹ دستیاب نہیں۔ آپ کی ورزش موبائل میں محفوظ ہے اور بعد میں سنک ہو جائے گی۔',

  'nutrition.title': 'غذا',
  'nutrition.plate_guide': 'آج کی پلیٹ',
  'nutrition.protein': 'پروٹین',
  'nutrition.carbs': 'کاربوہائیڈریٹ',
  'nutrition.fat': 'چکنائی',
  'nutrition.veg': 'سبزیاں',
  'nutrition.water': 'پانی',
  'nutrition.log_meal': 'کھانا درج کریں',

  'support.ask_coach': 'جم گائیڈ کوچ سے پوچھیں',
  'support.talk_to_staff': 'جم اسٹاف سے بات کریں',
  'support.ai_label': 'اے آئی کی مدد سے',
  'support.ai_disclaimer':
    'جم گائیڈ کوچ آپ کے منظور شدہ پلان اور ورزش کا طریقہ سمجھاتا ہے۔ یہ ڈاکٹر، فزیوتھراپسٹ یا ماہرِ غذائیت نہیں ہے۔',

  'safety.stop_title': 'براہِ کرم رک جائیں اور اسٹاف سے رابطہ کریں',
  'safety.stop_body':
    'آپ نے جو بتایا اس کے لیے کسی انسان کی مدد ضروری ہے۔ ہم نے آپ کے پلان میں خودکار تبدیلیاں روک دی ہیں اور جم ٹیم کو اطلاع دے دی ہے۔',
  'safety.emergency':
    'اگر سینے میں درد ہو، غش آئے یا سانس لینے میں دشواری ہو تو ورزش فوراً بند کریں اور طبی مدد حاصل کریں۔',

  'common.save': 'محفوظ کریں',
  'common.cancel': 'منسوخ',
  'common.next': 'آگے',
  'common.back': 'واپس',
  'common.done': 'مکمل',
  'common.skip': 'چھوڑ دیں',
  'common.why_we_ask': 'ہم یہ کیوں پوچھتے ہیں',
  'common.private': 'صرف آپ کے لیے',
};

const urRm: Dictionary = {
  'nav.today': 'Aaj',
  'nav.train': 'Warzish',
  'nav.plan': 'Plan',
  'nav.progress': 'Behtari',
  'nav.support': 'Madad',
  'nav.profile': 'Profile',

  'today.greeting.morning': 'Subah bakhair',
  'today.greeting.afternoon': 'Assalam-o-alaikum',
  'today.greeting.evening': 'Shaam bakhair',
  'today.heading': 'Aaj kya karna hai',
  'today.rest.title': 'Aaram ka din',
  'today.rest.subtitle': 'Aaram mein jism mazboot hota hai. Walk karein, paani pijiye, neend poori karein.',
  'today.start_workout': 'Warzish shuru karein',
  'today.resume_workout': 'Warzish jaari rakhein',

  'workout.warmup': 'Warm-up',
  'workout.main': 'Asal warzish',
  'workout.cooldown': 'Cool-down',
  'workout.set': 'Set',
  'workout.reps': 'Reps',
  'workout.weight': 'Wazan',
  'workout.effort': 'Kitni mushkil thi?',
  'workout.rest': 'Aaram',
  'workout.log_set': 'Set save karein',
  'workout.how_to': 'Tareeqa',
  'workout.form_cues': 'Ahem nuktay',
  'workout.common_mistakes': 'Aam ghaltiyan',
  'workout.safety': 'Ehtiyat',
  'workout.swap': 'Warzish badlein',
  'workout.finish': 'Warzish mukammal karein',
  'workout.report_pain': 'Takleef ho rahi hai',
  'workout.offline_banner': 'Internet nahi hai. Aap ki warzish phone mein save hai, baad mein sync ho jaye gi.',

  'nutrition.title': 'Ghiza',
  'nutrition.plate_guide': 'Aaj ki plate',
  'nutrition.protein': 'Protein',
  'nutrition.water': 'Paani',
  'nutrition.log_meal': 'Khana likhein',

  'support.ask_coach': 'GymGuide Coach se poochein',
  'support.talk_to_staff': 'Gym staff se baat karein',
  'support.ai_label': 'AI ki madad se',
  'support.ai_disclaimer':
    'GymGuide Coach aap ke approved plan aur warzish ka tareeqa samjhata hai. Yeh doctor, physiotherapist ya dietitian nahi hai.',

  'safety.stop_title': 'Baraye meharbani ruk jayein aur staff se raabta karein',
  'safety.stop_body':
    'Aap ne jo bataya us ke liye insaan ki madad zaroori hai. Hum ne plan ki automatic tabdeeliyan rok di hain aur gym team ko bata diya hai.',
  'safety.emergency':
    'Agar seenay mein dard ho, ghash aaye ya saans lene mein dushwari ho to warzish foran band karein aur medical madad lein.',

  'common.save': 'Save karein',
  'common.cancel': 'Cancel',
  'common.next': 'Agay',
  'common.back': 'Wapas',
  'common.done': 'Mukammal',
  'common.skip': 'Chhor dein',
  'common.why_we_ask': 'Hum yeh kyun poochte hain',
  'common.private': 'Sirf aap ke liye',
};

const DICTIONARIES: Record<LocaleCode, Dictionary> = { en, ur, ur_rm: urRm };

/** Translate with `{placeholder}` interpolation. */
export function translate(
  locale: LocaleCode,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const template = DICTIONARIES[locale]?.[key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

export function translator(locale: LocaleCode) {
  return (key: TranslationKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
}

/** Coverage report used by the localisation test and the admin console. */
export function translationCoverage(): Record<LocaleCode, number> {
  const total = Object.keys(en).length;
  return {
    en: 100,
    ur: Math.round((Object.keys(ur).length / total) * 100),
    ur_rm: Math.round((Object.keys(urRm).length / total) * 100),
  };
}
