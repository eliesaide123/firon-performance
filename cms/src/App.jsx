/*
 * CMS route tree.
 *
 * Provider order matters:
 *   QueryClientProvider  -> data layer
 *     FP_ToastProvider   -> useToast(), used by SocketContext for event toasts
 *       FP_AlertProvider -> mounted ONCE; renders every clientProxy failure
 *         FP_AuthProvider    -> session, hydrated from GET /auth/me
 *           FP_SocketProvider-> one socket; invalidates query keys per event
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isFPError } from '@firon/shared';
import FP_AuthProvider, { useAuth } from './context/AuthContext.jsx';
import FP_SocketProvider from './context/SocketContext.jsx';
import {
  FP_AlertProvider, FP_AppShell, FP_ErrorBoundary, FP_ToastProvider,
} from './components/index.ts';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import { HOME_FOR_ROLE } from './lib/navItems.js';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Content from './pages/Content.jsx';
import Media from './pages/Media.jsx';
import Videos from './pages/Videos.jsx';
import Categories from './pages/Categories.jsx';
import Exercises from './pages/Exercises.jsx';
import Users from './pages/Users.jsx';
import Clients from './pages/Clients.jsx';
import PlansTraining from './pages/PlansTraining.jsx';
import PlansDiet from './pages/PlansDiet.jsx';
import Notifications from './pages/Notifications.jsx';
import Settings from './pages/Settings.jsx';
import NotFound from './pages/NotFound.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      // The shared proxy already retries transport failures and 5xx; retrying
      // again here would multiply the alert popups.
      retry: (count, error) => (isFPError(error) && error.status === 0 ? count < 1 : false),
    },
    mutations: { retry: false },
  },
});

/** Trainers have no dashboard, so `/` lands them on their roster. */
function RoleHome() {
  const { user } = useAuth();
  if (user?.role === 'trainer') return <Navigate to={HOME_FOR_ROLE.trainer} replace />;
  return <Dashboard />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FP_ToastProvider>
        <FP_AlertProvider>
          <FP_AuthProvider>
            <FP_SocketProvider>
              <FP_ErrorBoundary>
                <Routes>
                  <Route path="/login" element={<Login />} />

                  <Route
                    element={(
                      <ProtectedRoute>
                        <FP_AppShell />
                      </ProtectedRoute>
                    )}
                  >
                    <Route index element={<RoleHome />} />
                    <Route path="clients" element={<Clients />} />
                    <Route path="media" element={<Media />} />
                    <Route path="exercises" element={<Exercises />} />
                    <Route path="plans/training" element={<PlansTraining />} />
                    <Route path="plans/diet" element={<PlansDiet />} />
                    <Route path="notifications" element={<Notifications />} />
                    <Route path="settings" element={<Settings />} />

                    {/* admin-only surfaces */}
                    <Route
                      path="content"
                      element={<ProtectedRoute role="admin"><Content /></ProtectedRoute>}
                    />
                    <Route
                      path="videos"
                      element={<ProtectedRoute role="admin"><Videos /></ProtectedRoute>}
                    />
                    <Route
                      path="categories"
                      element={<ProtectedRoute role="admin"><Categories /></ProtectedRoute>}
                    />
                    <Route
                      path="users"
                      element={<ProtectedRoute role="admin"><Users /></ProtectedRoute>}
                    />

                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </FP_ErrorBoundary>
            </FP_SocketProvider>
          </FP_AuthProvider>
        </FP_AlertProvider>
      </FP_ToastProvider>
    </QueryClientProvider>
  );
}
