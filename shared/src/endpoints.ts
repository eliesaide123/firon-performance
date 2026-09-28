/**
 * Firon Performance — the single API surface.
 *
 * Every endpoint in docs/CONTRACT.md §5 is declared here and every one of them runs through
 * `clientProxy`, so there is exactly one place where auth headers are attached, the envelope is
 * unwrapped, tokens are refreshed, errors are normalised and the alert popup is raised.
 *
 * Screens import `api` and nothing else:
 *
 *     import { api } from '@firon/shared';
 *     const { user, accessToken } = await api.auth.login({ identifier, password });
 *
 * Never call `fetch` or `axios` from a screen or a component.
 */

import { clientProxy, http, type ClientProxyResult, type FormDataLike, type QueryValue } from './sharedService';
import type {
  AppNotification,
  AuthTokens,
  Category,
  AssignTrainerResult,
  ClientDetail,
  ContentBulkPatch,
  ContentGroupSummary,
  ContentItem,
  ContentMap,
  DashboardStats,
  DeleteNotificationResult,
  DietPlan,
  Exercise,
  HealthStatus,
  LoginRequest,
  LoginResponse,
  MeResponse,
  MealLog,
  MealToggleResult,
  MediaAsset,
  MediaStatus,
  NotificationType,
  NutritionToday,
  ProfileProgress,
  OtpChannel,
  OtpPurpose,
  RegisterRequest,
  RegisterResponse,
  RosterEntry,
  SearchResults,
  SeedDefaultsResult,
  SuggestedVideo,
  TrainerPrefs,
  TrainerProfile,
  TrainerStats,
  TestNotificationResult,
  TrainingPlan,
  User,
  AvailabilityDay,
  AvailabilityResponse,
  TrainerProfileResponse,
  ClientProfile,
  FPPushPlatform,
  Video,
  VerifyOtpRequest,
  VerifyOtpResponse,
  WorkoutLog,
  WorkoutSummary,
  SessionRecord,
} from './types';

type Query = Record<string, QueryValue>;

/** Options a caller may pass to any endpoint to tune the shared proxy's behaviour. */
export interface CallOptions {
  /** Suppress the FP_Alert popup — use when the screen renders the error inline. */
  showAlert?: boolean;
  /** Override the popup title. */
  alertTitle?: string;
  /** Codes that should not pop an alert (e.g. ['NOT_VERIFIED'] on the login screen). */
  suppressAlertForCodes?: string[];
  /** Pop a success alert with this message. */
  successMessage?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export const api = {
  /* ================= auth ================= */
  auth: {
    /**
     * The ONLY login call. Note the request carries no role — the server resolves the user and
     * returns `user.role`, which is what the app routes on (CONTRACT §3.1–3.2).
     */
    login(body: LoginRequest, o?: CallOptions): Promise<LoginResponse> {
      return http.post<LoginResponse, LoginRequest>('/auth/login', body, {
        auth: false,
        // The login screen shows identifier/password errors inline and needs to intercept
        // NOT_VERIFIED to jump to the OTP screen, so those two never pop a dialog.
        suppressAlertForCodes: ['NOT_VERIFIED', 'VALIDATION_ERROR', 'INVALID_CREDENTIALS', 'ACCOUNT_DISABLED'],
        ...o,
      });
    },
    register(body: RegisterRequest, o?: CallOptions): Promise<RegisterResponse> {
      return http.post<RegisterResponse, RegisterRequest>('/auth/register', body, { auth: false, ...o });
    },
    verifyOtp(body: VerifyOtpRequest, o?: CallOptions): Promise<VerifyOtpResponse> {
      return http.post<VerifyOtpResponse, VerifyOtpRequest>('/auth/verify-otp', body, { auth: false, ...o });
    },
    resendOtp(body: { userId: string; purpose: OtpPurpose; channel: OtpChannel }, o?: CallOptions): Promise<{ otpSent: boolean; destination: string }> {
      return http.post('/auth/resend-otp', body, { auth: false, ...o });
    },
    forgotPassword(body: { identifier: string; channel: OtpChannel }, o?: CallOptions): Promise<{ userId: string; otpSent: boolean; destination: string }> {
      return http.post('/auth/forgot-password', body, { auth: false, ...o });
    },
    resetPassword(body: { resetToken: string; password: string }, o?: CallOptions): Promise<{ ok: true }> {
      return http.post('/auth/reset-password', body, { auth: false, ...o });
    },
    refresh(body: { refreshToken: string }): Promise<AuthTokens> {
      // Bypasses the interceptor so a failed refresh cannot recurse.
      return clientProxy<AuthTokens>({ path: '/auth/refresh', method: 'POST', body, auth: false, skipRefresh: true, showAlert: false });
    },
    /** Returns `{ user, unreadNotifications }` — destructure it: `const { user } = await api.auth.me()`. */
    me(o?: CallOptions): Promise<MeResponse> {
      return http.get<MeResponse>('/auth/me', o);
    },
    logout(o?: CallOptions): Promise<{ ok: true }> {
      return http.post('/auth/logout', undefined, { showAlert: false, ...o });
    },
    registerFcmToken(body: { token: string; platform: FPPushPlatform }, o?: CallOptions): Promise<{ ok: true }> {
      return http.post('/auth/fcm-token', body, { showAlert: false, ...o });
    },
    removeFcmToken(body: { token: string }, o?: CallOptions): Promise<{ ok: true }> {
      return http.del('/auth/fcm-token', body, { showAlert: false, ...o });
    },
  },

  /* ================= CMS content ================= */
  content: {
    /** The flat map the mobile app renders every label, image and video from. */
    map(query?: { platform?: string; locale?: string; group?: string; screen?: string }, o?: CallOptions): Promise<ContentMap> {
      return http.get<ContentMap>('/content', { query: { format: 'map', ...query } as Query, ...o });
    },
    list(query?: { platform?: string; locale?: string; group?: string; screen?: string; type?: string; q?: string; page?: number; limit?: number }, o?: CallOptions): Promise<ClientProxyResult<ContentItem[]>> {
      return http.getWithMeta<ContentItem[]>('/content', { query: { format: 'list', ...query } as Query, ...o });
    },
    groups(o?: CallOptions): Promise<ContentGroupSummary[]> {
      return http.get<ContentGroupSummary[]>('/content/groups', o);
    },
    byKey(key: string, query?: { locale?: string }, o?: CallOptions): Promise<ContentItem> {
      return http.get<ContentItem>(`/content/${encodeURIComponent(key)}`, { query: query as Query, ...o });
    },
    create(body: Partial<ContentItem>, o?: CallOptions): Promise<ContentItem> {
      return http.post<ContentItem>('/content', body, { successMessage: 'Content created', ...o });
    },
    update(id: string, body: Partial<ContentItem>, o?: CallOptions): Promise<ContentItem> {
      return http.put<ContentItem>(`/content/${id}`, body, o);
    },
    bulk(body: ContentBulkPatch, o?: CallOptions): Promise<{ updated: number; items: ContentItem[] }> {
      return http.patch('/content/bulk', body, o);
    },
    remove(id: string, o?: CallOptions): Promise<{ ok: true }> {
      return http.del(`/content/${id}`, undefined, o);
    },
    seedDefaults(body?: { force?: boolean }, o?: CallOptions): Promise<SeedDefaultsResult> {
      return http.post<SeedDefaultsResult>('/content/seed-defaults', body ?? {}, { timeoutMs: 60000, ...o });
    },
  },

  /* ================= media ================= */
  media: {
    list(query?: { status?: MediaStatus; kind?: string; category?: string; q?: string; page?: number; limit?: number }, o?: CallOptions): Promise<ClientProxyResult<MediaAsset[]>> {
      return http.getWithMeta<MediaAsset[]>('/media', { query: query as Query, ...o });
    },
    mine(query?: { page?: number; limit?: number }, o?: CallOptions): Promise<ClientProxyResult<MediaAsset[]>> {
      return http.getWithMeta<MediaAsset[]>('/media/mine', { query: query as Query, ...o });
    },
    byId(id: string, o?: CallOptions): Promise<MediaAsset> {
      return http.get<MediaAsset>(`/media/${id}`, o);
    },
    /** `formData` must carry the file under the field name `file`. */
    upload(formData: FormDataLike, onUploadProgress?: (pct: number) => void, o?: CallOptions): Promise<MediaAsset> {
      return clientProxy<MediaAsset>({
        path: '/media/upload',
        method: 'POST',
        formData,
        onUploadProgress,
        timeoutMs: 300000,
        ...o,
      });
    },
    approve(id: string, o?: CallOptions): Promise<MediaAsset> {
      return http.patch<MediaAsset>(`/media/${id}/approve`, undefined, { successMessage: 'Media approved', ...o });
    },
    reject(id: string, body: { reason: string }, o?: CallOptions): Promise<MediaAsset> {
      return http.patch<MediaAsset>(`/media/${id}/reject`, body, { successMessage: 'Media rejected', ...o });
    },
    remove(id: string, o?: CallOptions): Promise<{ ok: true }> {
      return http.del(`/media/${id}`, undefined, o);
    },
  },

  /* ================= videos ================= */
  videos: {
    list(query?: { category?: string; favorite?: boolean; q?: string; page?: number; limit?: number }, o?: CallOptions): Promise<ClientProxyResult<Video[]>> {
      return http.getWithMeta<Video[]>('/videos', { query: query as Query, ...o });
    },
    suggested(o?: CallOptions): Promise<SuggestedVideo[]> {
      return http.get<SuggestedVideo[]>('/videos/suggested', o);
    },
    continueWatching(o?: CallOptions): Promise<Video[]> {
      return http.get<Video[]>('/videos/continue-watching', o);
    },
    byId(id: string, o?: CallOptions): Promise<Video> {
      return http.get<Video>(`/videos/${id}`, o);
    },
    setProgress(id: string, body: { progress: number; secondsWatched?: number }, o?: CallOptions): Promise<{ progress: number }> {
      // Fired often while scrubbing — never interrupt playback with a dialog.
      return http.post(`/videos/${id}/progress`, body, { showAlert: false, ...o });
    },
    toggleFavorite(id: string, o?: CallOptions): Promise<{ favorite: boolean }> {
      return http.post(`/videos/${id}/favorite`, undefined, o);
    },
    create(body: Partial<Video>, o?: CallOptions): Promise<Video> {
      return http.post<Video>('/videos', body, { successMessage: 'Video created', ...o });
    },
    update(id: string, body: Partial<Video>, o?: CallOptions): Promise<Video> {
      return http.put<Video>(`/videos/${id}`, body, o);
    },
    remove(id: string, o?: CallOptions): Promise<{ ok: true }> {
      return http.del(`/videos/${id}`, undefined, o);
    },
  },

  /* ================= categories ================= */
  categories: {
    /** `includeInactive` is the flag the backend honours (staff only); there is no `activeOnly`. */
    list(query?: { kind?: string; includeInactive?: boolean }, o?: CallOptions): Promise<Category[]> {
      return http.get<Category[]>('/categories', { query: query as Query, ...o });
    },
    create(body: Partial<Category>, o?: CallOptions): Promise<Category> {
      return http.post<Category>('/categories', body, { successMessage: 'Category created', ...o });
    },
    update(id: string, body: Partial<Category>, o?: CallOptions): Promise<Category> {
      return http.put<Category>(`/categories/${id}`, body, o);
    },
    remove(id: string, o?: CallOptions): Promise<{ ok: true }> {
      return http.del(`/categories/${id}`, undefined, o);
    },
  },

  /* ================= exercises ================= */
  exercises: {
    list(
      query?: { q?: string; muscleGroup?: string; equipment?: string; includeInactive?: boolean; page?: number; limit?: number },
      o?: CallOptions,
    ): Promise<ClientProxyResult<Exercise[]>> {
      return http.getWithMeta<Exercise[]>('/exercises', { query: query as Query, ...o });
    },
    byId(id: string, o?: CallOptions): Promise<Exercise> {
      return http.get<Exercise>(`/exercises/${id}`, o);
    },
    create(body: Partial<Exercise>, o?: CallOptions): Promise<Exercise> {
      return http.post<Exercise>('/exercises', body, { successMessage: 'Exercise created', ...o });
    },
    update(id: string, body: Partial<Exercise>, o?: CallOptions): Promise<Exercise> {
      return http.put<Exercise>(`/exercises/${id}`, body, o);
    },
    remove(id: string, o?: CallOptions): Promise<{ ok: true }> {
      return http.del(`/exercises/${id}`, undefined, o);
    },
  },

  /* ================= trainer: clients ================= */
  clients: {
    roster(query?: { q?: string; status?: string }, o?: CallOptions): Promise<RosterEntry[]> {
      return http.get<RosterEntry[]>('/clients', { query: query as Query, ...o });
    },
    stats(o?: CallOptions): Promise<TrainerStats> {
      return http.get<TrainerStats>('/clients/stats', o);
    },
    byId(id: string, o?: CallOptions): Promise<ClientDetail> {
      return http.get<ClientDetail>(`/clients/${id}`, o);
    },
    assignTrainer(id: string, body: { trainerId: string }, o?: CallOptions): Promise<AssignTrainerResult> {
      return http.post<AssignTrainerResult>(`/clients/${id}/assign-trainer`, body, { successMessage: 'Trainer assigned', ...o });
    },
  },

  /* ================= client profile ================= */
  profile: {
    get(o?: CallOptions): Promise<User> {
      return http.get<User>('/profile', o);
    },
    update(body: { name?: string; email?: string; phone?: string; avatarUrl?: string }, o?: CallOptions): Promise<User> {
      return http.put<User>('/profile', body, o);
    },
    /** The onboarding / "My details" payload. Height 100–250cm, weight 30–300kg. */
    saveClientDetails(body: ClientProfile, o?: CallOptions): Promise<User> {
      return http.put<User>('/profile/client-details', body, o);
    },
    changePassword(body: { currentPassword: string; password: string }, o?: CallOptions): Promise<{ ok: true }> {
      return http.put('/profile/password', body, { successMessage: 'Password changed', ...o });
    },
    progress(o?: CallOptions): Promise<ProfileProgress> {
      return http.get<ProfileProgress>('/profile/progress', o);
    },
  },

  /* ================= trainer profile ================= */
  trainer: {
    getProfile(o?: CallOptions): Promise<TrainerProfileResponse> {
      return http.get<TrainerProfileResponse>('/trainer/profile', o);
    },
    updateProfile(body: Partial<TrainerProfile> & { name?: string; email?: string; phone?: string }, o?: CallOptions): Promise<TrainerProfileResponse> {
      return http.put<TrainerProfileResponse>('/trainer/profile', body, o);
    },
    getAvailability(o?: CallOptions): Promise<AvailabilityResponse> {
      return http.get<AvailabilityResponse>('/trainer/availability', o);
    },
    updateAvailability(body: { availability: AvailabilityDay[] }, o?: CallOptions): Promise<AvailabilityResponse> {
      return http.put<AvailabilityResponse>('/trainer/availability', body, o);
    },
    updatePrefs(body: Partial<TrainerPrefs>, o?: CallOptions): Promise<TrainerPrefs> {
      return http.put<TrainerPrefs>('/trainer/prefs', body, { showAlert: false, ...o });
    },
    dashboard(o?: CallOptions): Promise<TrainerStats & { upcoming: Array<{ id: string; title: string; at: string; clientName: string }> }> {
      return http.get('/trainer/dashboard', o);
    },
  },

  /* ================= plans ================= */
  plans: {
    /* --- training --- */
    myTraining(o?: CallOptions): Promise<TrainingPlan | null> {
      return http.get<TrainingPlan | null>('/plans/training/me', o);
    },
    listTraining(query: { clientId?: string; status?: string }, o?: CallOptions): Promise<TrainingPlan[]> {
      return http.get<TrainingPlan[]>('/plans/training', { query: query as Query, ...o });
    },
    createTraining(body: Partial<TrainingPlan>, o?: CallOptions): Promise<TrainingPlan> {
      return http.post<TrainingPlan>('/plans/training', body, o);
    },
    updateTraining(id: string, body: Partial<TrainingPlan>, o?: CallOptions): Promise<TrainingPlan> {
      return http.put<TrainingPlan>(`/plans/training/${id}`, body, o);
    },
    assignTraining(id: string, o?: CallOptions): Promise<TrainingPlan> {
      return http.post<TrainingPlan>(`/plans/training/${id}/assign`, undefined, o);
    },
    getTraining(id: string, o?: CallOptions): Promise<TrainingPlan> {
      return http.get<TrainingPlan>(`/plans/training/${id}`, o);
    },
    removeTraining(id: string, o?: CallOptions): Promise<{ ok: true }> {
      return http.del(`/plans/training/${id}`, undefined, o);
    },
    toggleExercise(planId: string, dayIndex: number, exIndex: number, o?: CallOptions): Promise<TrainingPlan> {
      // Optimistic in the UI; a failure is surfaced by the shared proxy's popup.
      return http.patch<TrainingPlan>(`/plans/training/${planId}/day/${dayIndex}/exercise/${exIndex}/toggle`, undefined, o);
    },
    completeDay(planId: string, dayIndex: number, body?: { durationMin?: number }, o?: CallOptions): Promise<TrainingPlan> {
      return http.post<TrainingPlan>(`/plans/training/${planId}/day/${dayIndex}/complete`, body ?? {}, o);
    },
    logExercise(
      planId: string,
      dayIndex: number,
      body: { name: string; sets?: number; reps?: number; weightKg?: number; notes?: string },
      o?: CallOptions,
    ): Promise<TrainingPlan> {
      return http.post<TrainingPlan>(`/plans/training/${planId}/day/${dayIndex}/log-exercise`, body, o);
    },

    /* --- diet --- */
    myDiet(o?: CallOptions): Promise<DietPlan | null> {
      return http.get<DietPlan | null>('/plans/diet/me', o);
    },
    listDiet(query: { clientId?: string; status?: string }, o?: CallOptions): Promise<DietPlan[]> {
      return http.get<DietPlan[]>('/plans/diet', { query: query as Query, ...o });
    },
    createDiet(body: Partial<DietPlan>, o?: CallOptions): Promise<DietPlan> {
      return http.post<DietPlan>('/plans/diet', body, o);
    },
    updateDiet(id: string, body: Partial<DietPlan>, o?: CallOptions): Promise<DietPlan> {
      return http.put<DietPlan>(`/plans/diet/${id}`, body, o);
    },
    assignDiet(id: string, o?: CallOptions): Promise<DietPlan> {
      return http.post<DietPlan>(`/plans/diet/${id}/assign`, undefined, o);
    },
    getDiet(id: string, o?: CallOptions): Promise<DietPlan> {
      return http.get<DietPlan>(`/plans/diet/${id}`, o);
    },
    removeDiet(id: string, o?: CallOptions): Promise<{ ok: true }> {
      return http.del(`/plans/diet/${id}`, undefined, o);
    },
    /**
     * `index` is the meal's position in the plan (`NutritionMealRow.index`), not its position in
     * the rendered list. For a manually logged meal use `api.nutrition.toggleLog(logId)`.
     */
    toggleMeal(planId: string, index: number, o?: CallOptions): Promise<MealToggleResult> {
      return http.patch<MealToggleResult>(`/plans/diet/${planId}/meal/${index}/toggle`, undefined, { showAlert: false, ...o });
    },
    logMeal(body: { slot: string; food: string; kcal: number; protein?: number; carbs?: number; fat?: number }, o?: CallOptions): Promise<MealLog> {
      return http.post<MealLog>('/plans/diet/log-meal', body, o);
    },
  },

  /* ================= nutrition ================= */
  nutrition: {
    today(o?: CallOptions): Promise<NutritionToday> {
      return http.get<NutritionToday>('/nutrition/today', o);
    },
    log(body: { slot: string; food: string; kcal: number; protein?: number; carbs?: number; fat?: number }, o?: CallOptions): Promise<MealLog> {
      return http.post<MealLog>('/nutrition/log', body, o);
    },
    toggleLog(id: string, o?: CallOptions): Promise<MealLog> {
      return http.patch<MealLog>(`/nutrition/log/${id}/toggle`, undefined, { showAlert: false, ...o });
    },
    history(query: { from?: string; to?: string }, o?: CallOptions): Promise<MealLog[]> {
      return http.get<MealLog[]>('/nutrition/history', { query: query as Query, ...o });
    },
  },

  /* ================= workouts ================= */
  workouts: {
    /**
     * Workout history. A trainer may pass `clientId` for a client on their own roster (403
     * otherwise); a client always reads their own. Defaults to the last 30 days.
     */
    logs(
      query?: { from?: string; to?: string; clientId?: string; page?: number; limit?: number },
      o?: CallOptions,
    ): Promise<ClientProxyResult<WorkoutLog[]>> {
      return http.getWithMeta<WorkoutLog[]>('/workouts/logs', { query: query as Query, ...o });
    },
    /** Completed sessions, newest first. */
    sessions(
      query?: { from?: string; to?: string; clientId?: string; page?: number; limit?: number },
      o?: CallOptions,
    ): Promise<ClientProxyResult<SessionRecord[]>> {
      return http.getWithMeta<SessionRecord[]>('/workouts/sessions', { query: query as Query, ...o });
    },
    /** Per-day totals for the last 8 weeks — drives the Train screen's History view. */
    summary(query?: { clientId?: string }, o?: CallOptions): Promise<WorkoutSummary> {
      return http.get<WorkoutSummary>('/workouts/summary', { query: query as Query, ...o });
    },
  },

  /* ================= notifications ================= */
  notifications: {
    list(query?: { unread?: boolean; page?: number; limit?: number }, o?: CallOptions): Promise<ClientProxyResult<AppNotification[]>> {
      return http.getWithMeta<AppNotification[]>('/notifications', { query: query as Query, ...o });
    },
    unreadCount(o?: CallOptions): Promise<{ unread: number }> {
      return http.get('/notifications/unread-count', { showAlert: false, ...o });
    },
    markRead(id: string, o?: CallOptions): Promise<{ unread: number }> {
      return http.patch(`/notifications/${id}/read`, undefined, { showAlert: false, ...o });
    },
    markAllRead(o?: CallOptions): Promise<{ unread: number }> {
      return http.patch('/notifications/read-all', undefined, o);
    },
    remove(id: string, o?: CallOptions): Promise<DeleteNotificationResult> {
      return http.del<DeleteNotificationResult>(`/notifications/${id}`, undefined, o);
    },
    /**
     * Fires a real notification through both channels. `socketsReached` tells you whether the
     * target actually had a live socket — 0 means it was persisted and pushed but not delivered
     * in-app, which is the usual reason a test "doesn't work".
     */
    sendTest(
      body: { userId?: string; title?: string; body?: string; type?: NotificationType; deepLink?: string; data?: Record<string, unknown> },
      o?: CallOptions,
    ): Promise<TestNotificationResult> {
      return http.post<TestNotificationResult>('/notifications/test', body, { successMessage: 'Test notification sent', ...o });
    },
  },

  /* ================= misc ================= */
  search(q: string, o?: CallOptions): Promise<SearchResults> {
    return http.get<SearchResults>('/search', { query: { q }, showAlert: false, ...o });
  },

  dashboard(o?: CallOptions): Promise<DashboardStats> {
    return http.get<DashboardStats>('/dashboard', o);
  },

  health(o?: CallOptions): Promise<HealthStatus> {
    return http.get<HealthStatus>('/health', { auth: false, showAlert: false, retries: 0, timeoutMs: 5000, ...o });
  },

  /* ================= users (CMS admin) ================= */
  users: {
    list(query?: { role?: string; q?: string; isActive?: boolean; page?: number; limit?: number }, o?: CallOptions): Promise<ClientProxyResult<User[]>> {
      return http.getWithMeta<User[]>('/users', { query: query as Query, ...o });
    },
    byId(id: string, o?: CallOptions): Promise<User> {
      return http.get<User>(`/users/${id}`, o);
    },
    create(body: { name: string; email: string; phone?: string; password: string; role: string }, o?: CallOptions): Promise<User> {
      return http.post<User>('/users', body, { successMessage: 'User created', ...o });
    },
    update(id: string, body: Partial<User>, o?: CallOptions): Promise<User> {
      return http.put<User>(`/users/${id}`, body, o);
    },
    setActive(id: string, body: { isActive: boolean }, o?: CallOptions): Promise<User> {
      return http.patch<User>(`/users/${id}/active`, body, o);
    },
    resetPassword(id: string, body: { password: string }, o?: CallOptions): Promise<{ ok: true }> {
      return http.post(`/users/${id}/reset-password`, body, { successMessage: 'Password reset', ...o });
    },
    remove(id: string, o?: CallOptions): Promise<{ ok: true }> {
      return http.del(`/users/${id}`, undefined, o);
    },
  },
} as const;

export type Api = typeof api;
