/*
 * Live phone preview for the content editor.
 *
 * Renders the selected mobile screen from the CURRENT values — unsaved edits
 * included — so an editor sees exactly what the app will show. Layouts mirror
 * docs/prototype.html; every string comes from a Content key and a missing key
 * is flagged in red rather than silently falling back.
 */
import { fpGradientCss, resolveMediaUrl, type ContentItem } from '@firon/shared';
import type { ReactNode } from 'react';
import FP_Badge from './FP_Badge';
import FP_Avatar from './FP_Avatar';
import FP_ProgressBar from './FP_ProgressBar';

/** A content row plus whatever the editor has typed but not yet saved. */
export type FP_PreviewItem = Partial<ContentItem> & {
  mediaTitle?: string | null;
  url?: string | null;
};
export type FP_PreviewMap = Record<string, FP_PreviewItem>;

export interface FP_PreviewScreen {
  value: string;
  label: string;
  /** Which bottom tab is highlighted, or null for a screen with no tab bar. */
  tab: string | null;
}

export const FP_PREVIEW_SCREENS: FP_PreviewScreen[] = [
  { value: 'login', label: 'Login', tab: null },
  { value: 'register', label: 'Register', tab: null },
  { value: 'forgot', label: 'Forgot password', tab: null },
  { value: 'otp', label: 'Verify OTP', tab: null },
  { value: 'onboard', label: 'Onboarding', tab: null },
  { value: 'guest', label: 'Guest preview', tab: 'home' },
  { value: 'home', label: 'Home', tab: 'home' },
  { value: 'workouts', label: 'Train', tab: 'train' },
  { value: 'videos', label: 'Videos', tab: 'videos' },
  { value: 'nutrition', label: 'Nutrition', tab: 'home' },
  { value: 'profile', label: 'Profile', tab: 'profile' },
  { value: 'notifications', label: 'Notifications', tab: null },
  { value: 'pt-roster', label: 'PT · Clients', tab: 'pt-clients' },
  { value: 'pt-builder', label: 'PT · Plans', tab: 'pt-plans' },
  { value: 'pt-uploads', label: 'PT · Uploads', tab: 'pt-uploads' },
  { value: 'pt-profile', label: 'PT · Profile', tab: 'pt-profile' },
];

/** Runtime interpolations the mobile `t()` helper performs (CONTRACT §8). */
const VARS: Record<string, string> = {
  coach: 'Sara', first: 'Maya', dest: 'elie@firon.app',
  plan: 'Cutting Plan', when: '2h ago',
};

const interpolate = (s: string) => s.replace(/\{(\w+)\}/g, (m, k) => VARS[k] ?? m);

function Missing({ k }: { k: string }) {
  return <span className="p-missing" title={`${k} is not in the CMS`}>⚠ {k}</span>;
}

/** Builds the `t(key)` renderer over the current (possibly dirty) values. */
function makeT(byKey: FP_PreviewMap) {
  return function t(key: string): ReactNode {
    const item = byKey[key];
    if (!item) return <Missing k={key} />;
    const raw = item.value;
    if (raw === '' || raw == null) return <span className="muted">(empty)</span>;
    if (item.type === 'boolean') return String(Boolean(raw));
    if (item.type === 'json') {
      return <span className="mono tiny">{typeof raw === 'string' ? raw : JSON.stringify(raw)}</span>;
    }
    if (item.type === 'color') {
      return (
        <span className="row" style={{ gap: 6, display: 'inline-flex' }}>
          <span className="p-swatch" style={{ background: String(raw) }} />
          <span className="mono tiny">{String(raw)}</span>
        </span>
      );
    }
    return interpolate(String(raw));
  };
}

function Media({ byKey, k, height = 92, index = 0 }: { byKey: FP_PreviewMap; k: string; height?: number; index?: number }) {
  const item = byKey[k];
  if (!item) {
    return <div className="p-media" style={{ background: fpGradientCss(index), height }}><Missing k={k} /></div>;
  }
  const raw = typeof item.value === 'string' && /^(https?:|\/)/.test(item.value) ? item.value : null;
  const url = resolveMediaUrl(item.url ?? raw);
  if (url && item.type === 'image') {
    return <img className="p-media-img" src={url} alt={item.label ?? k} style={{ height }} />;
  }
  return (
    <div className="p-media" style={{ background: fpGradientCss(index), height }}>
      {item.type === 'video' ? '▶ video' : 'image'} · {item.mediaTitle ?? (url ? 'linked' : 'not set')}
    </div>
  );
}

const TAB_SETS: Record<string, Array<{ key: string; id: string }>> = {
  client: [
    { key: 'tabs.client.home', id: 'home' },
    { key: 'tabs.client.train', id: 'train' },
    { key: 'tabs.client.videos', id: 'videos' },
    { key: 'tabs.client.profile', id: 'profile' },
  ],
  pt: [
    { key: 'tabs.pt.clients', id: 'pt-clients' },
    { key: 'tabs.pt.plans', id: 'pt-plans' },
    { key: 'tabs.pt.uploads', id: 'pt-uploads' },
    { key: 'tabs.pt.profile', id: 'pt-profile' },
  ],
};

function Field({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="mt2">
      <div className="p-label">{label}</div>
      <div className="p-field">{value}</div>
    </div>
  );
}

function Screen({ screen, byKey }: { screen: string; byKey: FP_PreviewMap }) {
  const t = makeT(byKey);

  switch (screen) {
    case 'login':
      return (
        <>
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <FP_Avatar name="◈" size={36} />
            <div>
              <div className="p-title-sm">{t('common.app_name')}</div>
              <div className="p-sub">{t('common.app_tagline')}</div>
            </div>
          </div>
          <div className="mt4">
            <h2>{t('auth.login.title')}</h2>
            <div className="p-sub mt2">{t('auth.login.subtitle')}</div>
          </div>
          <Field label={t('auth.login.identifier_label')} value={t('auth.login.identifier_ph')} />
          <Field label={t('auth.login.password_label')} value={t('auth.login.password_ph')} />
          <div className="row between mt3 tiny">
            <span className="muted">☐ {t('auth.login.remember')}</span>
            <span className="accent">{t('auth.login.forgot')}</span>
          </div>
          <div className="p-btn mt3">{t('auth.login.submit')}</div>
          <div className="mt3 tiny muted p-center">
            {t('auth.login.new_here')} <span className="accent strong">{t('auth.login.create_account')}</span>
          </div>
          <div className="mt3"><Media byKey={byKey} k="auth.login.hero" index={0} /></div>
        </>
      );

    case 'register':
      return (
        <>
          <h2 className="mt2">{t('auth.register.title')}</h2>
          <div className="p-sub mt2">{t('auth.register.subtitle')}</div>
          {['name', 'email', 'phone', 'password'].map((f) => (
            <Field key={f} label={t(`auth.register.${f}_label`)} value="—" />
          ))}
          <div className="p-btn mt3">{t('auth.register.submit')}</div>
          <div className="tiny muted mt2 p-center">{t('auth.register.otp_hint')}</div>
        </>
      );

    case 'forgot':
      return (
        <>
          <h2 className="mt2">{t('auth.forgot.title')}</h2>
          <div className="p-sub mt2">{t('auth.forgot.subtitle')}</div>
          <Field label={t('auth.login.identifier_label')} value={t('auth.login.identifier_ph')} />
          <div className="seg seg--block mt3">
            <button type="button" className="is-active">{t('auth.forgot.via_email')}</button>
            <button type="button">{t('auth.forgot.via_sms')}</button>
          </div>
          <div className="p-btn mt3">{t('auth.forgot.submit')}</div>
        </>
      );

    case 'otp':
      return (
        <>
          <h2 className="mt2">{t('auth.otp.title')}</h2>
          <div className="p-sub mt2">{t('auth.otp.subtitle')}</div>
          <div className="otp-inputs mt3">
            {[0, 1, 2, 3].map((i) => <input key={i} readOnly value="" aria-label={`Preview digit ${i + 1}`} />)}
          </div>
          <div className="row between mt3 tiny">
            <span className="muted">{t('auth.otp.resend_q')}</span>
            <span className="accent">{t('auth.otp.resend')}</span>
          </div>
          <div className="p-btn mt3">{t('auth.otp.submit')}</div>
          <div className="tiny muted mt2 p-center">{t('auth.otp.demo_hint')}</div>
        </>
      );

    case 'onboard':
      return (
        <>
          <h2 className="mt2">{t('onboard.title_signup')}</h2>
          <div className="p-sub mt2">{t('onboard.subtitle_signup')}</div>
          {['gender', 'age', 'height', 'weight', 'bodyfat', 'waist', 'goal', 'target', 'sessions', 'level'].map((f) => (
            <div key={f} className="p-kv">
              <span className="muted">{t(`onboard.${f}`)}</span>
              <span>—</span>
            </div>
          ))}
          <div className="p-btn mt3">{t('onboard.cta_signup')}</div>
          <div className="tiny muted mt2 p-center">{t('onboard.footnote')}</div>
        </>
      );

    case 'guest':
      return (
        <>
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <FP_Avatar name={String(byKey['guest.display_name']?.value ?? 'Guest')} size={34} />
            <div className="grow">
              <div className="p-sub">{t('guest.greeting')}</div>
              <div className="p-title-sm">{t('guest.display_name')}</div>
            </div>
            <FP_Badge tone="pt">{t('guest.profile_badge')}</FP_Badge>
          </div>
          <div className="p-card mt3">
            <div className="strong">{t('guest.banner_title')}</div>
            <div className="p-sub mt2">{t('guest.banner_body')}</div>
            <div className="p-btn mt3">{t('guest.banner_cta')}</div>
          </div>
          <div className="p-card mt3">
            <div className="strong">{t('guest.gate_title')}</div>
            <div className="p-sub mt2">{t('guest.gate_body')}</div>
          </div>
          <div className="p-kv mt3"><span className="muted">Coach</span><span>{t('guest.coach_name')}</span></div>
          <div className="p-btn mt3">{t('guest.profile_cta')}</div>
        </>
      );

    case 'home':
      return (
        <>
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <FP_Avatar name="Elie Saide" size={34} />
            <div className="grow">
              <div className="p-sub">{t('home.greeting_morning')}</div>
              <div className="p-title-sm">Elie 👋</div>
            </div>
          </div>
          <div className="row mt3" style={{ gap: 8 }}>
            <div className="p-stat"><div className="accent strong">3/5</div><div className="tiny muted">{t('home.stat_sessions_label')}</div></div>
            <div className="p-stat"><div className="strong">62%</div><div className="tiny muted">{t('home.stat_progress_label')}</div></div>
            <div className="p-stat"><div className="strong">1,480</div><div className="tiny muted">{t('home.stat_kcal_label')}</div></div>
          </div>
          <div className="p-card p-card--accent mt3">
            <FP_Badge tone="pt">{t('home.today_badge')}</FP_Badge>
            <div className="p-title-sm mt2">Lower Body Strength</div>
            <div className="p-btn mt3">{t('home.today_cta')}</div>
          </div>
          <div className="mt3"><Media byKey={byKey} k="home.today_banner" index={4} /></div>
          <div className="row between mt3">
            <span className="strong p-section">{t('home.suggested_title')}</span>
            <span className="accent tiny">{t('home.view_all')}</span>
          </div>
          <div className="p-sub tiny">{t('home.suggested_sub')}</div>
          <div className="strong p-section mt3">{t('home.continue_title')}</div>
          <div className="strong p-section mt3">{t('home.nutrition_title')}</div>
          <div className="mt2"><Media byKey={byKey} k="home.promo_video" index={2} /></div>
        </>
      );

    case 'workouts':
      return (
        <>
          <h2 className="mt2">{t('train.title')}</h2>
          <div className="p-sub mt2">{t('train.subtitle')}</div>
          <div className="seg seg--block mt3">
            <button type="button" className="is-active">{t('train.filter_week')}</button>
            <button type="button">{t('train.filter_program')}</button>
            <button type="button">{t('train.filter_history')}</button>
          </div>
          <div className="p-card mt3">
            <div className="row between tiny"><span className="muted">{t('train.session_progress')}</span><span className="accent">2/5</span></div>
            <div className="mt2"><FP_ProgressBar value={40} /></div>
            <div className="p-btn mt3">{t('train.cta_check_off')}</div>
            <div className="accent tiny mt2 p-center">{t('train.cta_log_exercise')}</div>
          </div>
          <div className="row between mt3">
            <span className="strong p-section">{t('train.up_next')}</span>
            <FP_Badge tone="muted">{t('train.locked_badge')}</FP_Badge>
          </div>
          <div className="p-card mt2 tiny muted">{t('train.demo_cue_default')}</div>
          <div className="p-card mt2 strong p-center">{t('train.complete_title')}</div>
        </>
      );

    case 'videos':
      return (
        <>
          <h2 className="mt2">{t('videos.title')}</h2>
          <div className="row mt3" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="chip chip--active chip--static">{t('videos.favorites_chip')}</span>
          </div>
          <div className="p-card mt3">
            <div className="p-sub tiny">{t('videos.sheet_blurb')}</div>
            <div className="p-btn mt3">{t('videos.cta_start')}</div>
            <div className="row mt2" style={{ gap: 6 }}>
              <span className="chip chip--static tiny">{t('videos.cta_resume')}</span>
              <span className="chip chip--static tiny">{t('videos.cta_fav_add')}</span>
            </div>
          </div>
          <div className="p-sub tiny mt3">{t('videos.empty_category')}</div>
          <div className="divider" />
          <div className="strong p-section">{t('search.title')}</div>
          <div className="p-field mt2">{t('search.placeholder')}</div>
          <div className="p-sub tiny mt2">{t('search.no_results')}</div>
        </>
      );

    case 'nutrition':
      return (
        <>
          <h2 className="mt2">{t('nutrition.title')}</h2>
          <div className="p-sub mt2">{t('nutrition.subtitle')}</div>
          <div className="row mt3" style={{ gap: 8 }}>
            <div className="p-stat"><div className="strong">120g</div><div className="tiny muted">{t('nutrition.protein')}</div></div>
            <div className="p-stat"><div className="strong">140g</div><div className="tiny muted">{t('nutrition.carbs')}</div></div>
            <div className="p-stat"><div className="strong">48g</div><div className="tiny muted">{t('nutrition.fat')}</div></div>
          </div>
          <div className="strong p-section mt3">{t('nutrition.todays_meals')}</div>
          <div className="p-btn mt3">{t('nutrition.cta_log_meal')}</div>
        </>
      );

    case 'profile':
      return (
        <>
          <h2 className="mt2">{t('profile.title')}</h2>
          <div className="row mt3" style={{ gap: 10 }}>
            <FP_Avatar name="Elie Saide" size={42} />
            <div className="grow">
              <div className="strong">Elie Saide</div>
              <FP_Badge tone="pt">{t('profile.badge_client')}</FP_Badge>
            </div>
          </div>
          <div className="strong p-section mt3">{t('profile.body_measurements')}</div>
          <div className="strong p-section mt3">{t('profile.my_goals')}</div>
          <div className="p-btn mt3">{t('profile.cta_edit')}</div>
          <div className="p-card mt2 danger p-center tiny">{t('profile.cta_logout')}</div>
        </>
      );

    case 'notifications':
      return (
        <>
          <h2 className="mt2">{t('notifications.title')}</h2>
          <div className="p-card mt3 p-sub p-center">{t('notifications.empty')}</div>
        </>
      );

    case 'pt-roster':
      return (
        <>
          <div className="mt2"><FP_Badge tone="pt">{t('pt.roster.portal_label')}</FP_Badge></div>
          <div className="row mt3" style={{ gap: 8 }}>
            <div className="p-stat"><div className="accent strong">5</div><div className="tiny muted">{t('pt.roster.stat_clients')}</div></div>
            <div className="p-stat"><div className="strong">12</div><div className="tiny muted">{t('pt.roster.stat_sessions')}</div></div>
            <div className="p-stat"><div className="strong">1</div><div className="tiny muted">{t('pt.roster.stat_requests')}</div></div>
          </div>
          <div className="row between mt3">
            <span className="strong p-section">{t('pt.roster.roster_title')}</span>
            <FP_Badge tone="pt">{t('pt.roster.badge_new')}</FP_Badge>
          </div>
        </>
      );

    case 'pt-builder':
      return (
        <>
          <h2 className="mt2">{t('pt.builder.title')}</h2>
          <div className="p-sub mt2">{t('pt.builder.subtitle')}</div>
          <div className="seg seg--block mt3">
            <button type="button" className="is-active">{t('pt.builder.tab_train')}</button>
            <button type="button">{t('pt.builder.tab_diet')}</button>
          </div>
          <div className="p-label mt3">{t('pt.builder.start_from')}</div>
          <div className="strong p-section mt3">{t('pt.builder.library_title')}</div>
          <div className="p-field mt2">{t('pt.builder.search_ph')}</div>
          <div className="p-label mt3">{t('pt.builder.daily_targets')}</div>
          <div className="row between mt2 tiny">
            <span>{t('pt.builder.meals')}</span><span className="accent">{t('pt.builder.add_meal')}</span>
          </div>
          <div className="p-sub tiny mt2">{t('pt.builder.no_meals')}</div>
          <div className="p-btn mt3">{t('pt.builder.cta_assign_train')}</div>
          <div className="p-btn mt2">{t('pt.builder.cta_assign_diet')}</div>
        </>
      );

    case 'pt-uploads':
      return (
        <>
          <h2 className="mt2">{t('pt.uploads.title')}</h2>
          <div className="p-sub mt2">{t('pt.uploads.subtitle')}</div>
          <div className="p-dropzone mt3">
            <div className="strong tiny">{t('pt.uploads.dropzone_title')}</div>
            <div className="tiny muted">{t('pt.uploads.dropzone_sub')}</div>
          </div>
          <div className="strong p-section mt3">{t('pt.uploads.mine_title')}</div>
          <div className="row mt2" style={{ gap: 6 }}>
            <FP_Badge tone="warn">{t('pt.uploads.badge_pending')}</FP_Badge>
            <FP_Badge tone="ok">{t('pt.uploads.badge_approved')}</FP_Badge>
          </div>
          <div className="p-btn mt3">{t('pt.uploads.cta_submit')}</div>
        </>
      );

    case 'pt-profile':
      return (
        <>
          <div className="strong p-section mt2">{t('pt.profile.coaching_details')}</div>
          <div className="strong p-section mt3">{t('pt.profile.certifications')}</div>
          <div className="strong p-section mt3">{t('pt.profile.notifications')}</div>
          <div className="strong p-section mt3">{t('pt.profile.availability')}</div>
          <div className="p-sub tiny mt2">{t('pt.profile.availability_hint')}</div>
          <div className="row mt3" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="chip chip--static tiny">{t('pt.profile.cta_copy_weekdays')}</span>
            <span className="chip chip--static tiny">{t('pt.profile.cta_weekend_off')}</span>
          </div>
          <div className="p-btn mt3">{t('pt.profile.cta_save_availability')}</div>
        </>
      );

    default:
      return <div className="p-sub mt4">Pick a screen to preview.</div>;
  }
}

export interface FP_PhonePreviewProps {
  screen: string;
  byKey: FP_PreviewMap;
  /** Shows an "N unsaved" flag on the device so the editor knows it is a draft. */
  dirtyCount?: number;
}

export default function FP_PhonePreview({ screen, byKey, dirtyCount = 0 }: FP_PhonePreviewProps) {
  const t = makeT(byKey);
  const meta = FP_PREVIEW_SCREENS.find((s) => s.value === screen);
  const tabs = meta?.tab?.startsWith('pt-') ? TAB_SETS.pt! : TAB_SETS.client!;

  return (
    <div className="phone">
      <div className="phone__frame">
        <div className="phone__screen">
          <div className="phone__island" />
          {dirtyCount > 0 ? (
            <div className="phone__unsaved"><FP_Badge tone="warn">{dirtyCount} unsaved</FP_Badge></div>
          ) : null}
          <div className="phone__status">
            <span>9:41</span>
            <span className="tiny muted">preview</span>
          </div>
          <div className="phone__body">
            <Screen screen={screen} byKey={byKey} />
          </div>
          {meta?.tab ? (
            <div className="phone__tabs">
              {tabs.map((tab) => (
                <div key={tab.key} className={`phone__tab ${tab.id === meta.tab ? 'is-active' : ''}`}>
                  {t(tab.key)}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="tiny muted mt2 p-center">
        Rendered from live CMS values{dirtyCount ? ' including unsaved edits' : ''}
      </div>
    </div>
  );
}
