/**
 * Firon Performance — shared DTOs.
 * Mirrors the Mongo models in docs/CONTRACT.md §4 as they appear over the wire (after the
 * `toJSON` transform: `_id` → `id`, no `__v`, no `passwordHash`).
 */

export type UserRole = 'client' | 'trainer' | 'admin';
export type Gender = 'Male' | 'Female' | 'Other';
export type Goal = 'Fat loss' | 'Muscle gain' | 'Strength' | 'General fitness';
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type DayLabel = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type MediaKind = 'image' | 'video';
export type MediaStatus = 'pending' | 'approved' | 'rejected';
export type PlanStatus = 'draft' | 'active' | 'archived';
export type DayStatus = 'done' | 'now' | 'todo';
export type ContentType = 'text' | 'richtext' | 'image' | 'video' | 'number' | 'boolean' | 'color' | 'json';
export type ContentPlatform = 'mobile' | 'cms' | 'both';
export type FPPushPlatform = 'ios' | 'android' | 'web';

export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

/* ---------- users ---------- */

export interface ClientProfile {
  gender?: Gender;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  bodyFatPct?: number | null;
  waistCm?: number | null;
  goal?: Goal;
  targetWeightKg?: number | null;
  sessionsPerWeek?: number;
  level?: Level;
  membershipLabel?: string;
  trainerId?: string | null;
  onboardingCompleted?: boolean;
  startWeightKg?: number | null;
}

export interface TrainerCert {
  name: string;
  verified: boolean;
}

export interface AvailabilityDay {
  day: DayLabel;
  off: boolean;
  from: string; // 'HH:mm'
  to: string; // 'HH:mm'
}

export interface TrainerPrefs {
  newClientRequests: boolean;
  sessionReminders: boolean;
  weeklyAdherenceReport: boolean;
}

export interface TrainerProfile {
  title?: string;
  studio?: string;
  rate?: string;
  since?: string;
  certs?: TrainerCert[];
  availability?: AvailabilityDay[];
  prefs?: TrainerPrefs;
}

export interface User extends Timestamped {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatarUrl?: string | null;
  isVerified: boolean;
  isActive: boolean;
  locale: string;
  initials: string;
  bmi?: number | null;
  lastLoginAt?: string | null;
  clientProfile?: ClientProfile;
  trainerProfile?: TrainerProfile;
  /**
   * Populated for clients: a flattened trainer summary (verified against `GET /auth/me`).
   * Note `title`/`studio`/`firstName` are hoisted to the top level — there is no nested
   * `trainerProfile` here.
   */
  trainer?: {
    id: string;
    name: string;
    firstName: string;
    email: string;
    phone?: string;
    avatarUrl?: string | null;
    title?: string;
    studio?: string;
  };
}

/* ---------- auth ---------- */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  remember?: boolean;
}

/** NOTE: there is deliberately no `role` here. The server decides; the client routes on it. */
export interface LoginResponse extends AuthTokens {
  user: User;
}

/** `GET /auth/me` — the backend bundles the unread badge count with the user. */
export interface MeResponse {
  user: User;
  unreadNotifications: number;
}

export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterResponse {
  userId: string;
  otpSent: boolean;
  destination: string;
}

export type OtpPurpose = 'verify' | 'reset';
export type OtpChannel = 'email' | 'sms';

export interface VerifyOtpRequest {
  userId?: string;
  destination?: string;
  code: string;
  purpose: OtpPurpose;
}

export interface VerifyOtpResponse extends Partial<AuthTokens> {
  user?: User;
  resetToken?: string;
}

/* ---------- CMS content ---------- */

export interface ContentItem extends Timestamped {
  id: string;
  key: string;
  type: ContentType;
  value: unknown;
  locale: string;
  platform: ContentPlatform;
  group: string;
  screen?: string;
  label?: string;
  description?: string;
  mediaId?: string | null;
  media?: MediaAsset | null;
  url?: string | null;
  isPublished: boolean;
  version: number;
  updatedBy?: string | Pick<User, 'id' | 'name'> | null;
}

/** The flat map the mobile app consumes: `GET /content?format=map`. */
export type ContentMap = Record<string, { type: ContentType; value: unknown; url?: string | null }>;

export interface ContentGroupSummary {
  group: string;
  count: number;
  published: number;
  screens?: string[];
}

export interface ContentBulkPatch {
  items: Array<{ key?: string; id?: string; value: unknown }>;
}

/* ---------- media ---------- */

export interface MediaAsset extends Timestamped {
  id: string;
  title: string;
  description?: string;
  kind: MediaKind;
  category?: string;
  filename: string;
  originalName?: string;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
  url: string;
  thumbnailUrl?: string | null;
  status: MediaStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  uploadedBy: string | Pick<User, 'id' | 'name' | 'initials'>;
  tags?: string[];
}

/* ---------- catalogue ---------- */

export interface Category extends Timestamped {
  id: string;
  name: string;
  slug: string;
  order: number;
  icon?: string;
  kind: 'video' | 'exercise';
  isActive: boolean;
}

export interface Video extends Timestamped {
  id: string;
  title: string;
  description?: string;
  categoryId?: string | null;
  category?: string;
  durationSec?: number;
  durationLabel: string;
  videoMediaId?: string | null;
  thumbnailMediaId?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  gradientIndex: number;
  isPublished: boolean;
  publishedAt?: string | null;
  tags?: string[];
  level?: string;
  order?: number;
  /** Merged from the caller's VideoProgress. */
  progress: number;
  favorite: boolean;
  secondsWatched?: number;
}

/** `GET /videos/suggested` adds the reason string the Home rail shows. */
export interface SuggestedVideo extends Video {
  why: string;
}

export interface Exercise extends Timestamped {
  id: string;
  name: string;
  slug: string;
  description?: string;
  muscleGroup?: string;
  equipment?: string;
  type?: string;
  demoMediaId?: string | null;
  demoUrl?: string | null;
  demoDurationLabel?: string;
  cues?: string[];
  isActive: boolean;
}

/* ---------- plans ---------- */

export interface PlanExercise {
  exerciseId?: string | null;
  name: string;
  prescription: string;
  sets?: number;
  reps?: number;
  weightKg?: number;
  notes?: string;
  done: boolean;
  loggedByClient: boolean;
  order: number;
  demoUrl?: string | null;
}

export interface PlanDay {
  dayIndex: number;
  dayLabel: DayLabel;
  title: string;
  durationMin: number;
  status: DayStatus;
  locked: boolean;
  completedAt?: string | null;
  exercises: PlanExercise[];
}

export interface TrainingPlan extends Timestamped {
  id: string;
  clientId: string;
  trainerId: string;
  name: string;
  weekNumber?: number;
  startDate?: string | null;
  endDate?: string | null;
  status: PlanStatus;
  days: PlanDay[];
  notes?: string;
  assignedAt?: string | null;
  adherencePct: number;
  doneDays: number;
  totalDays: number;
  currentDayIndex: number;
}

export interface PlanMeal {
  slot: string;
  food: string;
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  order: number;
  consumed?: boolean;
}

export interface DietPlan extends Timestamped {
  id: string;
  clientId: string;
  trainerId: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  status: PlanStatus;
  meals: PlanMeal[];
  startDate?: string | null;
  assignedAt?: string | null;
  notes?: string;
  totalKcal: number;
  consumedKcal: number;
}

/* ---------- logs ---------- */

export interface MealLog extends Timestamped {
  id: string;
  userId: string;
  dietPlanId?: string | null;
  date: string;
  slot: string;
  food: string;
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  consumed: boolean;
  source: 'plan' | 'manual';
}

export interface WorkoutLog extends Timestamped {
  id: string;
  userId: string;
  trainingPlanId?: string | null;
  dayIndex?: number;
  date: string;
  exerciseName: string;
  sets?: number;
  reps?: number;
  weightKg?: number;
  notes?: string;
  source: 'plan' | 'manual';
  completed: boolean;
  durationMin?: number;
}

export interface MacroTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** The trimmed plan reference `GET /nutrition/today` returns — NOT a full `DietPlan`. */
export interface NutritionPlanRef {
  id: string;
  name: string;
  coachName: string;
  coachFirstName: string;
}

/**
 * A row in `GET /nutrition/today`.
 *
 * `index` is the position inside the diet plan's `meals[]` and is what
 * `api.plans.toggleMeal(planId, index)` expects. For a manually logged meal `index` is `null` and
 * `logId` is set — toggle those with `api.nutrition.toggleLog(logId)` instead.
 * **Never use the array position as the toggle index**, because manual meals are interleaved.
 */
export interface NutritionMealRow {
  index: number | null;
  slot: string;
  food: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  source: 'plan' | 'manual';
  consumed: boolean;
  logId: string | null;
}

/** `GET /nutrition/today` */
/** `GET /workouts/sessions` */
export interface SessionRecord extends Timestamped {
  id: string;
  clientId: string;
  trainerId?: string | null;
  trainingPlanId?: string | null;
  dayIndex?: number;
  title: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  durationMin?: number;
  location?: string;
  status: 'scheduled' | 'completed' | 'missed' | 'cancelled';
}

/** `GET /workouts/summary` */
export interface WorkoutSummary {
  from: string;
  to: string;
  totalExercises: number;
  days: Array<{
    date: string;
    exercises: number;
    completed: number;
    volumeKg: number;
    minutes: number;
  }>;
}

export interface NutritionToday {
  date: string;
  plan: NutritionPlanRef | null;
  targets: MacroTargets;
  consumed: MacroTargets;
  remainingKcal: number;
  progressPct: number;
  meals: NutritionMealRow[];
}

/** `PATCH /plans/diet/:id/meal/:index/toggle` */
export interface MealToggleResult {
  planId: string;
  index: number;
  slot: string;
  consumed: boolean;
  kcalToday: number;
  targetKcal: number;
}

/** `GET /profile/progress` */
export interface ProfileProgress {
  weightKg: number | null;
  startWeightKg: number | null;
  targetWeightKg: number | null;
  weightChangeKg: number | null;
  bmi: number | null;
  bodyFatPct: number | null;
  waistCm: number | null;
  sessionsCompleted: number;
  sessionsThisWeek: number;
  weeklyTarget: number;
  exercisesLogged: number;
  videosCompleted: number;
  kcalToday: number;
  planProgressPct: number;
  recentSessions: Array<{ id: string; title: string; completedAt: string; durationMin: number }>;
}

/* ---------- trainer views ---------- */

export type RosterStatus = 'ok' | 'warn' | 'new';

export interface RosterEntry {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string | null;
  email?: string;
  phone?: string;
  planLabel: string;
  trainingPlanId?: string | null;
  adherencePct: number;
  status: RosterStatus;
  onboardingCompleted?: boolean;
  goal?: Goal;
  membershipLabel?: string;
  dietPlanSummary?: {
    id: string;
    name: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    /** Number of meals in the plan. The server calls this `meals`, not `mealCount`. */
    meals: number;
  } | null;
}

export interface TrainerStats {
  activeClients: number;
  totalClients: number;
  sessionsThisWeek: number;
  newRequests: number;
  avgAdherence: number;
}

export interface ClientDetail {
  client: User;
  /** Verified against `GET /clients/:id` — not the shape CONTRACT §5 originally sketched. */
  stats: {
    adherencePct: number;
    status: RosterStatus;
    weekNumber: number;
    sessionsCompleted: number;
    sessionsThisWeek: number;
    weeklyTarget: number;
    weightChangeKg: number;
    lastActive: string | null;
    daysDone: number;
    daysTotal: number;
  };
  trainingPlan: TrainingPlan | null;
  dietPlan: DietPlan | null;
  recentLogs: Array<WorkoutLog | MealLog>;
}

/** `GET|PUT /trainer/profile` — the backend flattens `trainerProfile` onto the user. */
export interface TrainerProfileResponse extends TrainerProfile {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone?: string;
  avatarUrl?: string | null;
  role: UserRole;
  isVerified: boolean;
  /** Collapsed ranges, e.g. ['Mon–Fri · 07:00 – 19:00', 'Sat · 09:00 – 13:00', 'Sun · Off']. */
  availabilitySummary: string[];
  openDays: number;
}

/** `GET|PUT /trainer/availability` */
export interface AvailabilityResponse {
  availability: AvailabilityDay[];
  summary: string[];
  openDays: number;
}

/* ---------- notifications ---------- */

/**
 * Runtime list of the `Notification.type` enum, mirroring `backend/src/models/Notification.js`.
 * Exported as a value so the CMS can build a type picker without hand-copying the list.
 */
export const FP_NOTIFICATION_TYPES = [
  'plan_assigned',
  'plan_updated',
  'session_reminder',
  'media_approved',
  'media_rejected',
  'client_progress',
  'new_client',
  'content_updated',
  'message',
  'generic',
] as const;

export type NotificationType = (typeof FP_NOTIFICATION_TYPES)[number];

export interface AppNotification extends Timestamped {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, unknown>;
  read: boolean;
  readAt?: string | null;
  deliveredPush: boolean;
  icon?: string;
  deepLink?: string;
}

/* ---------- misc ---------- */

/** `POST /clients/:id/assign-trainer` */
export interface AssignTrainerResult {
  clientId: string;
  trainerId: string;
  trainerName: string;
}

/** `POST /content/seed-defaults` */
export interface SeedDefaultsResult {
  inserted: number;
  skipped: number;
  keys: string[];
}

/** `POST /notifications/test` */
export interface TestNotificationResult {
  notification: AppNotification;
  socketEmitted: boolean;
  /** How many of the target's live sockets received it — 0 means they aren't connected. */
  socketsReached: number;
  target: { id: string; name: string; email: string } | string;
  pushEnabled: boolean;
}

/** `DELETE /notifications/:id` */
export interface DeleteNotificationResult {
  deleted: boolean;
  id: string;
  /** The target's unread total after the delete. */
  unread: number;
}

export interface SearchResults {
  videos: Video[];
  plans: Array<{ id: string; title: string; subtitle: string; kind: 'training' | 'diet' }>;
  exercises: Exercise[];
}

export interface DashboardStats {
  users: { clients: number; trainers: number; admins: number };
  content: { total: number; byGroup: Array<{ group: string; count: number }> };
  media: { pending: number; approved: number; rejected: number };
  videos: { published: number; total: number };
  plans: { activeTraining: number; activeDiet: number };
  sessions?: { thisWeek: number; completed: number; scheduled: number };
  recentActivity: Array<{ id: string; label: string; at: string; actor?: string }>;
  generatedAt: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  db: string;
  uptime: number;
  version: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}
