import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { HOME_FOR_ROLE } from '../lib/navItems.js';
import { FP_Button, FP_Screen } from '../components/index.ts';

export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const home = HOME_FOR_ROLE[user?.role] ?? '/';

  return (
    <FP_Screen>
      <div className="notfound">
        <div className="notfound__code">404</div>
        <h1>That page does not exist</h1>
        <p className="muted small">
          The link may be stale, or the page was moved. Everything the mobile app reads is under
          the Content editor.
        </p>
        <FP_Button icon={Home} onPress={() => navigate(home)}>Back to the CMS</FP_Button>
      </div>
    </FP_Screen>
  );
}
