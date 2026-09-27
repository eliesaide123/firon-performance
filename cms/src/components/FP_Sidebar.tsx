import clsx from 'clsx';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { navForRole } from '../lib/navItems.js';
import { APP_VERSION } from '../lib/constants.js';
import FP_Icon from './FP_Icon';
import FP_IconButton from './FP_IconButton';

export interface FP_SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Slides the drawer in on narrow screens. */
  open?: boolean;
}

/** Collapsible primary navigation. Items differ for admin vs trainer. */
export default function FP_Sidebar({ collapsed, onToggle, open }: FP_SidebarProps) {
  const { user } = useAuth();
  const { status } = useSocket();
  const sections = navForRole(user?.role ?? 'admin');

  return (
    <nav
      className={clsx('sidebar', collapsed && 'sidebar--collapsed', open && 'sidebar--open')}
      aria-label="Main navigation"
    >
      <div className="sidebar__brand">
        <span className="sidebar__mark"><FP_Icon glyph="logo" size={16} tone="onAccent" /></span>
        {collapsed ? null : (
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="sidebar__name truncate">Firon Performance</div>
            <div className="sidebar__tag">{user?.role === 'trainer' ? 'Trainer portal' : 'Admin CMS'}</div>
          </div>
        )}
      </div>

      <div className="sidebar__nav">
        {sections.map((section) => (
          <div key={section.title}>
            {collapsed ? null : <div className="sidebar__section">{section.title}</div>}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => clsx('navlink', isActive && 'is-active')}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={17} />
                {collapsed ? null : <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar__foot row between">
        {collapsed ? null : <span className="tiny muted">v{APP_VERSION} · socket {status}</span>}
        <FP_IconButton
          small
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onPress={onToggle}
        />
      </div>
    </nav>
  );
}
