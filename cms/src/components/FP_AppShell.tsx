import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import FP_ErrorBoundary from './FP_ErrorBoundary';
import FP_Sidebar from './FP_Sidebar';
import FP_Topbar from './FP_Topbar';

const KEY = 'firon.sidebarCollapsed';

/** Sidebar + topbar around the routed page. */
export default function FP_AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    try { window.localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  return (
    <div className="shell">
      <FP_Sidebar collapsed={collapsed} open={mobileOpen} onToggle={() => setCollapsed((c) => !c)} />
      <div className="main">
        <FP_Topbar onMenu={() => setMobileOpen((o) => !o)} />
        {/* Route-level boundary: a page crash must not take down the shell. */}
        <FP_ErrorBoundary key={pathname}>
          <Outlet />
        </FP_ErrorBoundary>
      </div>
    </div>
  );
}
