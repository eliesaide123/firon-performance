'use strict';

/**
 * Seed users (CONTRACT §9). Every account uses the password `password1`
 * (bcrypt-hashed by `User#setPassword` + the pre('save') hook).
 *
 * `ref` is a seed-local handle used to wire relationships (trainerId, plans, …).
 */

const DEMO_PASSWORD = 'password1';

const admin = {
  ref: 'admin',
  name: 'Firon Admin',
  email: 'admin@firon.app',
  phone: '+961 71 000 000',
  password: DEMO_PASSWORD,
  role: 'admin',
  isVerified: true,
  isActive: true,
  locale: 'en',
};

const trainer = {
  ref: 'sara',
  name: 'Sara Khalil',
  email: 'sara@firon.app',
  phone: '+961 71 456 789',
  password: DEMO_PASSWORD,
  role: 'trainer',
  isVerified: true,
  isActive: true,
  locale: 'en',
  trainerProfile: {
    title: 'Head Coach · Strength & Conditioning',
    studio: 'Studio 2 · Beirut',
    rate: '$45 / session',
    since: '2021',
    certs: [
      { name: 'NASM-CPT', verified: true },
      { name: 'Precision Nutrition L1', verified: true },
      { name: 'Kettlebell L2', verified: true },
    ],
    availability: [
      { day: 'Mon', off: false, from: '07:00', to: '19:00' },
      { day: 'Tue', off: false, from: '07:00', to: '19:00' },
      { day: 'Wed', off: false, from: '07:00', to: '19:00' },
      { day: 'Thu', off: false, from: '07:00', to: '19:00' },
      { day: 'Fri', off: false, from: '07:00', to: '19:00' },
      { day: 'Sat', off: false, from: '09:00', to: '13:00' },
      { day: 'Sun', off: true, from: '09:00', to: '13:00' },
    ],
    prefs: {
      newClientRequests: true,
      sessionReminders: true,
      weeklyAdherenceReport: false,
    },
  },
};

/** All clients are verified and coached by Sara. */
const clients = [
  {
    ref: 'elie', // ← the demo login
    name: 'Elie Saide',
    email: 'elie@firon.app',
    phone: '+961 70 123 456',
    password: DEMO_PASSWORD,
    role: 'client',
    isVerified: true,
    clientProfile: {
      gender: 'Male',
      age: 31,
      heightCm: 178,
      weightKg: 81.4,
      bodyFatPct: 18.2,
      waistCm: 84,
      goal: 'Fat loss',
      targetWeightKg: 76,
      sessionsPerWeek: 5,
      level: 'Intermediate',
      membershipLabel: 'Premium plan',
      onboardingCompleted: true,
      startWeightKg: 86.0,
      trainerRef: 'sara',
    },
  },
  {
    ref: 'maya',
    name: 'Maya Khoury',
    email: 'maya@firon.app',
    phone: '+961 70 223 456',
    password: DEMO_PASSWORD,
    role: 'client',
    isVerified: true,
    clientProfile: {
      gender: 'Female',
      age: 28,
      heightCm: 165,
      weightKg: 63.5,
      bodyFatPct: 24.5,
      waistCm: 72,
      goal: 'Fat loss',
      targetWeightKg: 58,
      sessionsPerWeek: 4,
      level: 'Intermediate',
      membershipLabel: 'Premium plan',
      onboardingCompleted: true,
      startWeightKg: 68,
      trainerRef: 'sara',
    },
  },
  {
    ref: 'omar',
    name: 'Omar Haddad',
    email: 'omar@firon.app',
    phone: '+961 70 323 456',
    password: DEMO_PASSWORD,
    role: 'client',
    isVerified: true,
    clientProfile: {
      gender: 'Male',
      age: 24,
      heightCm: 182,
      weightKg: 74.2,
      bodyFatPct: 14.0,
      waistCm: 79,
      goal: 'Muscle gain',
      targetWeightKg: 82,
      sessionsPerWeek: 5,
      level: 'Beginner',
      membershipLabel: 'Premium plan',
      onboardingCompleted: true,
      startWeightKg: 71,
      trainerRef: 'sara',
    },
  },
  {
    ref: 'lina',
    name: 'Lina Aoun',
    email: 'lina@firon.app',
    phone: '+961 70 423 456',
    password: DEMO_PASSWORD,
    role: 'client',
    isVerified: true,
    clientProfile: {
      // brand-new client — still onboarding, so no body stats yet
      goal: 'General fitness',
      sessionsPerWeek: 3,
      membershipLabel: 'Premium plan',
      onboardingCompleted: false,
      trainerRef: 'sara',
    },
  },
  {
    ref: 'karim',
    name: 'Karim Nasr',
    email: 'karim@firon.app',
    phone: '+961 70 523 456',
    password: DEMO_PASSWORD,
    role: 'client',
    isVerified: true,
    clientProfile: {
      gender: 'Male',
      age: 36,
      heightCm: 175,
      weightKg: 88.0,
      bodyFatPct: 21.0,
      waistCm: 92,
      goal: 'Strength',
      targetWeightKg: 85,
      sessionsPerWeek: 4,
      level: 'Advanced',
      membershipLabel: 'Premium plan',
      onboardingCompleted: true,
      startWeightKg: 90,
      trainerRef: 'sara',
    },
  },
];

module.exports = {
  DEMO_PASSWORD,
  admin,
  trainer,
  clients,
  all: [admin, trainer, ...clients],
};
