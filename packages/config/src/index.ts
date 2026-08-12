export * from './format';
export * from './i18n';
export * from './countries';

/** Feature flag keys, mirrored from db/migrations/0010_rbac_reference.sql. */
export const FEATURE_FLAGS = [
  'ai_coach',
  'nutrition_module',
  'class_booking',
  'white_label',
  'advanced_analytics',
  'whatsapp_messaging',
  'door_access',
  'family_accounts',
  'offline_workouts',
  'ramadan_mode',
  'member_web_portal',
  'pt_packages',
] as const;
export type FeatureFlagKey = (typeof FEATURE_FLAGS)[number];

export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  ai_coach: true,
  nutrition_module: true,
  class_booking: true,
  white_label: false,
  advanced_analytics: false,
  whatsapp_messaging: false,
  door_access: false,
  family_accounts: true,
  offline_workouts: true,
  ramadan_mode: true,
  member_web_portal: true,
  pt_packages: true,
};

export const APP_ROUTES = {
  landing: '/',
  pricing: '/pricing',
  demo: '/book-a-demo',
  signIn: '/sign-in',
  memberApp: '/app',
  staff: '/dashboard',
  platform: '/platform',
} as const;

/** Quiet hours and messaging etiquette defaults (overridable per organization). */
export const MESSAGING_DEFAULTS = {
  quietHoursStart: '21:30',
  quietHoursEnd: '07:30',
  maxAutomatedPerMemberPerWeek: 3,
  marketingRequiresOptIn: true,
} as const;
