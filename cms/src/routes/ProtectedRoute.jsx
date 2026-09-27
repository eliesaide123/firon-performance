import { ShieldAlert } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { FP_EmptyState, FP_LoadingBlock, FP_Screen } from '../components/index.ts';

/**
 * Gate a route on authentication and (optionally) a role.
 * `role` accepts a single role or an array.
 */
export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FP_LoadingBlock label="Restoring your session…" />;

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) {
      return (
        <FP_Screen>
          <FP_EmptyState
            icon={ShieldAlert}
            title="You don't have access to this page"
            message={`This area is restricted to ${allowed.join(' / ')} accounts. You are signed in as ${user.role}.`}
          />
        </FP_Screen>
      );
    }
  }

  return children;
}
