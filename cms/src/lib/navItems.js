import {
  Activity, Bell, Dumbbell, Image, LayoutDashboard, ListOrdered,
  Salad, Settings, Type, Users, UserSquare2, Video,
} from 'lucide-react';

/**
 * Nav definition. `roles` gates visibility:
 *  - admin   -> everything
 *  - trainer -> own uploads, own clients, plan builders, exercise library
 *               (never the content editor and never user management)
 */
export const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'], end: true },
      { to: '/clients', label: 'Clients', icon: UserSquare2, roles: ['admin', 'trainer'], trainerLabel: 'My clients' },
    ],
  },
  {
    title: 'App content',
    items: [
      { to: '/content', label: 'Content editor', icon: Type, roles: ['admin'] },
      { to: '/media', label: 'Media library', icon: Image, roles: ['admin', 'trainer'], trainerLabel: 'My uploads' },
      { to: '/videos', label: 'Videos', icon: Video, roles: ['admin'] },
      { to: '/categories', label: 'Categories', icon: ListOrdered, roles: ['admin'] },
      { to: '/exercises', label: 'Exercises', icon: Dumbbell, roles: ['admin', 'trainer'] },
    ],
  },
  {
    title: 'Coaching',
    items: [
      { to: '/plans/training', label: 'Training builder', icon: Activity, roles: ['admin', 'trainer'] },
      { to: '/plans/diet', label: 'Diet builder', icon: Salad, roles: ['admin', 'trainer'] },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/users', label: 'Users', icon: Users, roles: ['admin'] },
      { to: '/notifications', label: 'Notifications', icon: Bell, roles: ['admin', 'trainer'] },
      { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'trainer'] },
    ],
  },
];

export function navForRole(role) {
  return NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items
        .filter((i) => i.roles.includes(role))
        .map((i) => (role === 'trainer' && i.trainerLabel ? { ...i, label: i.trainerLabel } : i)),
    }))
    .filter((s) => s.items.length);
}

/** Landing route per role — a trainer has no dashboard. */
export const HOME_FOR_ROLE = { admin: '/', trainer: '/clients' };

/** Used by the topbar to title the current page. */
export const PAGE_TITLES = {
  '/': 'Dashboard',
  '/content': 'Content editor',
  '/media': 'Media library',
  '/videos': 'Videos',
  '/categories': 'Categories',
  '/exercises': 'Exercises',
  '/users': 'Users',
  '/clients': 'Clients',
  '/plans/training': 'Training plan builder',
  '/plans/diet': 'Diet plan builder',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
};
