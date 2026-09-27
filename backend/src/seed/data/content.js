'use strict';

/**
 * Every CMS-driven string / image / video the mobile app reads (CONTRACT §8).
 * Nothing user-visible may be hardcoded in the app, so EVERY key below must
 * exist in the `Content` collection or the app falls back to a literal.
 *
 * Entry shape: [key, type, value, group, screen, label, description?]
 *   - type 'image'/'video'  -> value `null`; an admin attaches a MediaAsset in the CMS.
 *   - `{coach}` `{dest}` `{first}` `{plan}` `{when}` are runtime interpolations
 *     resolved by the mobile `t()` helper.
 */

const T = 'text';
const IMG = 'image';
const VID = 'video';

// [key, type, value, group, screen, label, description]
const ROWS = [
  /* ------------------------------- common ------------------------------- */
  ['common.app_name', T, 'Firon Performance', 'common', 'global', 'App name'],
  ['common.app_tagline', T, 'Train. Track. Transform.', 'common', 'global', 'App tagline'],
  ['common.logo', IMG, null, 'common', 'global', 'App logo', 'Shown next to the app name on the auth screens'],
  ['common.cta_save', T, 'Save changes', 'common', 'global', 'Button — save'],
  ['common.cta_close', T, 'Close', 'common', 'global', 'Button — close'],
  ['common.toast_saved', T, 'Details updated ✓', 'common', 'global', 'Toast — saved'],
  ['common.empty_generic', T, 'Nothing here yet', 'common', 'global', 'Generic empty state'],

  /* ----------------------------- auth: login ---------------------------- */
  ['auth.login.title', T, 'Welcome back', 'auth', 'login', 'Login — title'],
  ['auth.login.subtitle', T, 'Sign in with email or phone', 'auth', 'login', 'Login — subtitle'],
  ['auth.login.identifier_label', T, 'Email or phone', 'auth', 'login', 'Login — identifier label'],
  ['auth.login.identifier_ph', T, 'you@email.com', 'auth', 'login', 'Login — identifier placeholder'],
  ['auth.login.password_label', T, 'Password', 'auth', 'login', 'Login — password label'],
  ['auth.login.password_ph', T, '••••••••', 'auth', 'login', 'Login — password placeholder'],
  ['auth.login.remember', T, 'Remember me', 'auth', 'login', 'Login — remember me'],
  ['auth.login.forgot', T, 'Forgot password?', 'auth', 'login', 'Login — forgot password link'],
  ['auth.login.submit', T, 'Sign in', 'auth', 'login', 'Login — submit button'],
  ['auth.login.new_here', T, 'New here?', 'auth', 'login', 'Login — sign-up prompt'],
  ['auth.login.create_account', T, 'Create account', 'auth', 'login', 'Login — sign-up link'],
  ['auth.login.hero', IMG, null, 'auth', 'login', 'Login — hero image', 'Optional background/hero artwork on the login screen'],
  ['auth.login.err_identifier', T, 'Enter a valid email or phone number', 'auth', 'login', 'Login — identifier error'],
  ['auth.login.err_password', T, 'Password must be at least 6 characters', 'auth', 'login', 'Login — password error'],

  /* ---------------------------- auth: register -------------------------- */
  ['auth.register.title', T, 'Create account', 'auth', 'register', 'Register — title'],
  ['auth.register.subtitle', T, 'Join Firon Performance in under a minute', 'auth', 'register', 'Register — subtitle'],
  ['auth.register.name_label', T, 'Full name', 'auth', 'register', 'Register — name label'],
  ['auth.register.email_label', T, 'Email', 'auth', 'register', 'Register — email label'],
  ['auth.register.phone_label', T, 'Phone', 'auth', 'register', 'Register — phone label'],
  ['auth.register.password_label', T, 'Password', 'auth', 'register', 'Register — password label'],
  ['auth.register.submit', T, 'Create account & verify', 'auth', 'register', 'Register — submit button'],
  ['auth.register.otp_hint', T, "We'll send a one-time code to verify you", 'auth', 'register', 'Register — OTP hint'],

  /* ----------------------------- auth: forgot --------------------------- */
  ['auth.forgot.title', T, 'Reset password', 'auth', 'forgot', 'Forgot — title'],
  [
    'auth.forgot.subtitle',
    T,
    "Enter your email or phone and we'll send a one-time verification code.",
    'auth',
    'forgot',
    'Forgot — subtitle',
  ],
  ['auth.forgot.via_email', T, 'Send via Email', 'auth', 'forgot', 'Forgot — email channel'],
  ['auth.forgot.via_sms', T, 'Send via SMS', 'auth', 'forgot', 'Forgot — SMS channel'],
  ['auth.forgot.submit', T, 'Send code', 'auth', 'forgot', 'Forgot — submit button'],
  ['auth.forgot.confirm_label', T, 'Confirm new password', 'auth', 'forgot', 'Forgot — confirm password label'],
  ['auth.forgot.err_confirm', T, 'Passwords do not match', 'auth', 'forgot', 'Forgot — passwords mismatch error'],

  /* ------------------------------ auth: otp ----------------------------- */
  ['auth.otp.title', T, 'Verify code', 'auth', 'otp', 'OTP — title'],
  ['auth.otp.subtitle', T, 'We sent a 4-digit code to {dest}.', 'auth', 'otp', 'OTP — subtitle', 'Supports {dest}'],
  ['auth.otp.resend_q', T, "Didn't get it?", 'auth', 'otp', 'OTP — resend prompt'],
  ['auth.otp.resend', T, 'Resend code', 'auth', 'otp', 'OTP — resend link'],
  ['auth.otp.submit', T, 'Verify', 'auth', 'otp', 'OTP — submit button'],
  ['auth.otp.demo_hint', T, 'Demo code: 1 2 3 4', 'auth', 'otp', 'OTP — demo hint', 'Dev builds only'],

  /* ------------------------------ onboarding ---------------------------- */
  ['onboard.title_signup', T, 'A bit about you', 'onboard', 'onboard', 'Onboarding — title (sign-up)'],
  ['onboard.title_edit', T, 'My details', 'onboard', 'onboard', 'Onboarding — title (edit)'],
  [
    'onboard.subtitle_signup',
    T,
    'Coach {coach} uses this to build your training & diet plan',
    'onboard',
    'onboard',
    'Onboarding — subtitle (sign-up)',
    'Supports {coach}',
  ],
  [
    'onboard.subtitle_edit',
    T,
    'Keep these current so coach {coach} can adjust your plans',
    'onboard',
    'onboard',
    'Onboarding — subtitle (edit)',
    'Supports {coach}',
  ],
  ['onboard.gender', T, 'Gender', 'onboard', 'onboard', 'Onboarding — gender label'],
  ['onboard.age', T, 'Age', 'onboard', 'onboard', 'Onboarding — age label'],
  ['onboard.height', T, 'Height (cm)', 'onboard', 'onboard', 'Onboarding — height label'],
  ['onboard.weight', T, 'Weight (kg)', 'onboard', 'onboard', 'Onboarding — weight label'],
  ['onboard.bodyfat', T, 'Body fat %', 'onboard', 'onboard', 'Onboarding — body fat label'],
  ['onboard.waist', T, 'Waist (cm)', 'onboard', 'onboard', 'Onboarding — waist label'],
  ['onboard.goal', T, 'Primary goal', 'onboard', 'onboard', 'Onboarding — goal label'],
  ['onboard.target', T, 'Target weight (kg)', 'onboard', 'onboard', 'Onboarding — target weight label'],
  ['onboard.sessions', T, 'Sessions per week', 'onboard', 'onboard', 'Onboarding — sessions label'],
  ['onboard.level', T, 'Training experience', 'onboard', 'onboard', 'Onboarding — level label'],
  ['onboard.cta_signup', T, 'Finish setup', 'onboard', 'onboard', 'Onboarding — CTA (sign-up)'],
  ['onboard.cta_edit', T, 'Save changes', 'onboard', 'onboard', 'Onboarding — CTA (edit)'],
  [
    'onboard.err_body',
    T,
    'Enter a realistic height (100–250 cm) and weight (30–300 kg)',
    'onboard',
    'onboard',
    'Onboarding — body stats error',
  ],
  [
    'onboard.footnote',
    T,
    'You can change all of this later in your profile',
    'onboard',
    'onboard',
    'Onboarding — footnote',
  ],

  /* --------------------------------- tabs ------------------------------- */
  ['tabs.client.home', T, 'Home', 'tabs', 'tabbar', 'Client tab — Home'],
  ['tabs.client.train', T, 'Train', 'tabs', 'tabbar', 'Client tab — Train'],
  ['tabs.client.videos', T, 'Videos', 'tabs', 'tabbar', 'Client tab — Videos'],
  ['tabs.client.profile', T, 'Profile', 'tabs', 'tabbar', 'Client tab — Profile'],
  ['tabs.pt.clients', T, 'Clients', 'tabs', 'tabbar', 'PT tab — Clients'],
  ['tabs.pt.plans', T, 'Plans', 'tabs', 'tabbar', 'PT tab — Plans'],
  ['tabs.pt.uploads', T, 'Uploads', 'tabs', 'tabbar', 'PT tab — Uploads'],
  ['tabs.pt.profile', T, 'Profile', 'tabs', 'tabbar', 'PT tab — Profile'],

  /* --------------------------------- home ------------------------------- */
  ['home.greeting_morning', T, 'Good morning', 'home', 'home', 'Home — morning greeting'],
  ['home.greeting_afternoon', T, 'Good afternoon', 'home', 'home', 'Home — afternoon greeting'],
  ['home.greeting_evening', T, 'Good evening', 'home', 'home', 'Home — evening greeting'],
  ['home.stat_sessions_label', T, 'Sessions this wk', 'home', 'home', 'Home — sessions stat label'],
  ['home.stat_progress_label', T, 'Plan progress', 'home', 'home', 'Home — progress stat label'],
  ['home.stat_kcal_label', T, 'kcal today', 'home', 'home', 'Home — kcal stat label'],
  ["home.today_badge", T, "TODAY'S SESSION", 'home', 'home', 'Home — today badge'],
  ['home.today_cta', T, 'Start workout', 'home', 'home', "Home — today's session CTA"],
  ['home.today_banner', IMG, null, 'home', 'home', "Home — today's session banner", 'Hero image on the today card'],
  ['home.suggested_title', T, 'Suggested for you', 'home', 'home', 'Home — suggested section title'],
  [
    'home.suggested_sub',
    T,
    "Based on your plan & coach {coach}'s library",
    'home',
    'home',
    'Home — suggested section subtitle',
    'Supports {coach}',
  ],
  ['home.continue_title', T, 'Continue watching', 'home', 'home', 'Home — continue watching title'],
  ['home.nutrition_title', T, 'Your nutrition', 'home', 'home', 'Home — nutrition card title'],
  ['home.view_all', T, 'View all', 'home', 'home', 'Home — view all link'],
  ['home.promo_video', VID, null, 'home', 'home', 'Home — promo video', 'Optional promo clip on the home feed'],

  /* --------------------------------- train ------------------------------ */
  ['train.title', T, 'Train', 'train', 'workouts', 'Train — title'],
  [
    'train.subtitle',
    T,
    'Assigned by coach {coach} · updated {when}',
    'train',
    'workouts',
    'Train — subtitle',
    'Supports {coach} and {when}',
  ],
  ['train.filter_week', T, 'This week', 'train', 'workouts', 'Train — filter: this week'],
  ['train.filter_program', T, 'Program', 'train', 'workouts', 'Train — filter: program'],
  ['train.filter_history', T, 'History', 'train', 'workouts', 'Train — filter: history'],
  ['train.session_progress', T, 'Session progress', 'train', 'workouts', 'Train — session progress label'],
  ['train.cta_check_off', T, 'Check off session ✓', 'train', 'workouts', 'Train — finish session CTA'],
  ['train.cta_log_exercise', T, '+ Log an exercise', 'train', 'workouts', 'Train — log exercise CTA'],
  ['train.up_next', T, 'Up next', 'train', 'workouts', 'Train — up next title'],
  ['train.locked_badge', T, 'Locked', 'train', 'workouts', 'Train — locked badge'],
  ['train.complete_title', T, 'Session complete!', 'train', 'workouts', 'Train — session complete title'],
  [
    'train.demo_cue_default',
    T,
    'Keep your chest up, brace your core, and control the descent.',
    'train',
    'workouts',
    'Train — default demo cue',
    'Used when an exercise has no cues of its own',
  ],

  /* -------------------------------- videos ------------------------------ */
  ['videos.title', T, 'Videos', 'videos', 'videos', 'Videos — title'],
  ['videos.empty_category', T, 'No videos in this category', 'videos', 'videos', 'Videos — empty category'],
  ['videos.favorites_chip', T, '♥ Favorites', 'videos', 'videos', 'Videos — favorites chip'],
  [
    'videos.sheet_blurb',
    T,
    'Coach-approved session from your library. Follow along at your own pace — it counts toward your weekly target.',
    'videos',
    'videos',
    'Videos — sheet blurb',
  ],
  ['videos.cta_start', T, 'Start video', 'videos', 'videos', 'Videos — start CTA'],
  ['videos.cta_resume', T, 'Resume video', 'videos', 'videos', 'Videos — resume CTA'],
  ['videos.cta_fav_add', T, '♡ Save to favorites', 'videos', 'videos', 'Videos — add favourite CTA'],
  ['videos.cta_fav_remove', T, '♥ Remove from favorites', 'videos', 'videos', 'Videos — remove favourite CTA'],

  /* -------------------------------- search ------------------------------ */
  ['search.title', T, 'Search', 'search', 'search', 'Search — title'],
  ['search.subtitle', T, 'Across videos, plans & content', 'search', 'search', 'Search — subtitle'],
  ['search.placeholder', T, "Try 'core', 'yoga', 'plan'…", 'search', 'search', 'Search — input placeholder'],
  ['search.empty', T, 'Start typing to search your library', 'search', 'search', 'Search — idle state'],
  ['search.no_results', T, 'No results found', 'search', 'search', 'Search — no results'],

  /* ------------------------------- nutrition ---------------------------- */
  ['nutrition.title', T, 'Nutrition', 'nutrition', 'nutrition', 'Nutrition — title'],
  [
    'nutrition.subtitle',
    T,
    '{plan} · assigned by coach {coach}',
    'nutrition',
    'nutrition',
    'Nutrition — subtitle',
    'Supports {plan} and {coach}',
  ],
  ['nutrition.protein', T, 'Protein', 'nutrition', 'nutrition', 'Nutrition — protein label'],
  ['nutrition.carbs', T, 'Carbs', 'nutrition', 'nutrition', 'Nutrition — carbs label'],
  ['nutrition.fat', T, 'Fat', 'nutrition', 'nutrition', 'Nutrition — fat label'],
  ['nutrition.todays_meals', T, "Today's meals", 'nutrition', 'nutrition', 'Nutrition — meals section title'],
  ['nutrition.cta_log_meal', T, '+ Log a meal', 'nutrition', 'nutrition', 'Nutrition — log meal CTA'],

  /* -------------------------------- profile ----------------------------- */
  ['profile.title', T, 'Profile', 'profile', 'profile', 'Profile — title'],
  ['profile.body_measurements', T, 'Body measurements', 'profile', 'profile', 'Profile — measurements section'],
  ['profile.my_goals', T, 'My goals', 'profile', 'profile', 'Profile — goals section'],
  ['profile.cta_edit', T, 'Edit', 'profile', 'profile', 'Profile — edit link'],
  ['profile.cta_logout', T, 'Log out', 'profile', 'profile', 'Profile — logout button'],
  ['profile.badge_client', T, 'Client · Premium plan', 'profile', 'profile', 'Profile — client badge'],

  /* ------------------------------- pt: roster --------------------------- */
  ['pt.roster.portal_label', T, 'Trainer portal', 'pt', 'pt-roster', 'PT roster — portal label'],
  ['pt.roster.stat_clients', T, 'Active clients', 'pt', 'pt-roster', 'PT roster — clients stat'],
  ['pt.roster.stat_sessions', T, 'Sessions this wk', 'pt', 'pt-roster', 'PT roster — sessions stat'],
  ['pt.roster.stat_requests', T, 'New request', 'pt', 'pt-roster', 'PT roster — requests stat'],
  ['pt.roster.roster_title', T, 'Client roster', 'pt', 'pt-roster', 'PT roster — section title'],
  ['pt.roster.badge_new', T, 'New', 'pt', 'pt-roster', 'PT roster — new client badge'],

  /* ------------------------------ pt: builder --------------------------- */
  ['pt.builder.title', T, 'Plans', 'pt', 'pt-builder', 'PT builder — title'],
  [
    'pt.builder.subtitle',
    T,
    'Build a training or diet plan for your client',
    'pt',
    'pt-builder',
    'PT builder — subtitle',
  ],
  ['pt.builder.tab_train', T, 'Training plan', 'pt', 'pt-builder', 'PT builder — training tab'],
  ['pt.builder.tab_diet', T, 'Diet plan', 'pt', 'pt-builder', 'PT builder — diet tab'],
  ['pt.builder.start_from', T, 'Start from', 'pt', 'pt-builder', 'PT builder — start-from label'],
  ['pt.builder.library_title', T, 'Exercise library', 'pt', 'pt-builder', 'PT builder — library title'],
  ['pt.builder.search_ph', T, 'Search exercises…', 'pt', 'pt-builder', 'PT builder — library search placeholder'],
  [
    'pt.builder.cta_assign_train',
    T,
    'Assign training plan to {first}',
    'pt',
    'pt-builder',
    'PT builder — assign training CTA',
    'Supports {first}',
  ],
  [
    'pt.builder.cta_assign_diet',
    T,
    'Assign diet plan to {first}',
    'pt',
    'pt-builder',
    'PT builder — assign diet CTA',
    'Supports {first}',
  ],
  ['pt.builder.daily_targets', T, 'Daily targets', 'pt', 'pt-builder', 'PT builder — daily targets title'],
  ['pt.builder.meals', T, 'Meals', 'pt', 'pt-builder', 'PT builder — meals title'],
  ['pt.builder.add_meal', T, '+ Add meal', 'pt', 'pt-builder', 'PT builder — add meal CTA'],
  [
    'pt.builder.no_meals',
    T,
    'No meals yet — add the first one below',
    'pt',
    'pt-builder',
    'PT builder — empty meals state',
  ],

  /* ------------------------------ pt: uploads --------------------------- */
  ['pt.uploads.title', T, 'Media uploads', 'pt', 'pt-uploads', 'PT uploads — title'],
  [
    'pt.uploads.subtitle',
    T,
    'Exercise demos · reviewed by admin before publishing',
    'pt',
    'pt-uploads',
    'PT uploads — subtitle',
  ],
  ['pt.uploads.dropzone_title', T, 'Upload demo video or image', 'pt', 'pt-uploads', 'PT uploads — dropzone title'],
  [
    'pt.uploads.dropzone_sub',
    T,
    'MP4 or JPG · routed through admin approval',
    'pt',
    'pt-uploads',
    'PT uploads — dropzone subtitle',
  ],
  ['pt.uploads.mine_title', T, 'Your uploads', 'pt', 'pt-uploads', 'PT uploads — my uploads title'],
  ['pt.uploads.badge_pending', T, 'Pending review', 'pt', 'pt-uploads', 'PT uploads — pending badge'],
  ['pt.uploads.badge_approved', T, 'Approved', 'pt', 'pt-uploads', 'PT uploads — approved badge'],
  ['pt.uploads.cta_submit', T, 'Submit for approval', 'pt', 'pt-uploads', 'PT uploads — submit CTA'],

  /* ------------------------------ pt: profile --------------------------- */
  ['pt.profile.coaching_details', T, 'Coaching details', 'pt', 'pt-profile', 'PT profile — coaching details title'],
  ['pt.profile.certifications', T, 'Certifications', 'pt', 'pt-profile', 'PT profile — certifications title'],
  ['pt.profile.notifications', T, 'Notifications', 'pt', 'pt-profile', 'PT profile — notification prefs title'],
  ['pt.profile.availability', T, 'Availability', 'pt', 'pt-profile', 'PT profile — availability title'],
  [
    'pt.profile.availability_hint',
    T,
    'Clients can only book sessions inside these hours',
    'pt',
    'pt-profile',
    'PT profile — availability hint',
  ],
  ['pt.profile.cta_copy_weekdays', T, 'Copy Mon to weekdays', 'pt', 'pt-profile', 'PT profile — copy weekdays CTA'],
  ['pt.profile.cta_weekend_off', T, 'Weekend off', 'pt', 'pt-profile', 'PT profile — weekend off CTA'],
  [
    'pt.profile.cta_save_availability',
    T,
    'Save availability',
    'pt',
    'pt-profile',
    'PT profile — save availability CTA',
  ],

  /* ----------------------------- notifications -------------------------- */
  ['notifications.title', T, 'Notifications', 'notifications', 'notifications', 'Notifications — title'],
  ['notifications.empty', T, "You're all caught up", 'notifications', 'notifications', 'Notifications — empty state'],
  /* ------------------------------- guest preview ------------------------------- */
  /* Shown on a fresh install before anyone signs in (CONTRACT §13). The app renders a
     populated, logged-in-looking client Home; any tap opens the login screen. */
  ['guest.banner_title', T, 'Preview mode', 'guest', 'global', 'Guest — banner title'],
  ['guest.banner_body', T, 'Sign in to start training with your coach', 'guest', 'global', 'Guest — banner body'],
  ['guest.banner_cta', T, 'Sign in', 'guest', 'global', 'Guest — banner button'],
  ['guest.gate_title', T, 'Sign in to continue', 'guest', 'global', 'Guest — gate alert title', 'Shown when a guest taps something that needs an account'],
  ['guest.gate_body', T, 'Create an account or sign in to use this.', 'guest', 'global', 'Guest — gate alert body'],
  ['guest.greeting', T, 'Welcome', 'guest', 'home', 'Guest — home greeting', 'Replaces the time-of-day greeting for a guest'],
  ['guest.display_name', T, 'Athlete', 'guest', 'home', 'Guest — display name', 'Stand-in for the signed-in client name'],
  ['guest.coach_name', T, 'Sara', 'guest', 'home', 'Guest — coach first name', 'Used in {coach} interpolations while previewing'],
  ['guest.profile_badge', T, 'Preview · Not signed in', 'guest', 'profile', 'Guest — profile badge'],
  ['guest.profile_cta', T, 'Sign in to see your real plan', 'guest', 'profile', 'Guest — profile CTA'],

];

// The §8 "extra" keys — badges, toasts, empty states and the trainer portal's copy — live in a
// generated sibling module so this file stays hand-maintained. Both are seeded together, which is
// what makes "every user-visible string is CMS-editable" literally true.
const EXTRA_ROWS = require('./content.extra');

const contentDefaults = [...ROWS, ...EXTRA_ROWS].map(([key, type, value, group, screen, label, description]) => ({
  key,
  type,
  value: value === undefined ? null : value,
  locale: 'en',
  platform: 'mobile',
  group,
  screen,
  label,
  description: description || '',
  isPublished: true,
  version: 1,
}));

// Fail loud at require-time if a key was duplicated while editing this file.
const seen = new Set();
for (const row of contentDefaults) {
  if (seen.has(row.key)) throw new Error(`seed/data/content.js: duplicate key "${row.key}"`);
  seen.add(row.key);
}

module.exports = contentDefaults;
module.exports.count = contentDefaults.length;
