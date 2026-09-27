/*
 * Central React Query key factory.
 * The SocketProvider invalidates by the ROOT of each key (see src/context/SocketContext.jsx
 * and the table in README.md), so every key below must start with its domain root.
 */
export const qk = {
  me: ['me'],
  health: ['health'],
  dashboard: ['dashboard'],

  content: ['content'],
  contentList: (filters) => ['content', 'list', filters],
  contentGroups: ['content', 'groups'],

  media: ['media'],
  mediaList: (filters) => ['media', 'list', filters],
  mediaMine: (filters) => ['media', 'mine', filters],

  videos: ['videos'],
  videoList: (filters) => ['videos', 'list', filters],

  categories: ['categories'],
  categoryList: (filters) => ['categories', 'list', filters],

  exercises: ['exercises'],
  exerciseList: (filters) => ['exercises', 'list', filters],

  users: ['users'],
  userList: (filters) => ['users', 'list', filters],
  user: (id) => ['users', 'detail', id],

  clients: ['clients'],
  clientList: (filters) => ['clients', 'list', filters],
  client: (id) => ['clients', 'detail', id],
  clientStats: ['clients', 'stats'],

  plans: ['plans'],
  trainingPlans: (clientId) => ['plans', 'training', clientId ?? null],
  dietPlans: (clientId) => ['plans', 'diet', clientId ?? null],

  notifications: ['notifications'],
  notificationList: (filters) => ['notifications', 'list', filters],
  notificationCount: ['notifications', 'unread-count'],
};

export default qk;
