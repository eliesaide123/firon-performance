import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext.jsx';
import { PAGE_TITLES } from '../lib/navItems.js';
import FP_IconButton from './FP_IconButton';
import FP_NotificationsBell from './FP_NotificationsBell';
import FP_StatusDot from './FP_StatusDot';
import FP_UserMenu from './FP_UserMenu';

export interface FP_TopbarProps {
  onMenu: () => void;
}

/** Page title, live socket dot, notifications bell and the account menu. */
export default function FP_Topbar({ onMenu }: FP_TopbarProps) {
  const { pathname } = useLocation();
  const { status, socketId } = useSocket();
  const title = PAGE_TITLES[pathname]
    ?? PAGE_TITLES[`/${pathname.split('/')[1]}`]
    ?? 'Firon Performance';

  return (
    <header className="topbar">
      <FP_IconButton icon={Menu} label="Toggle navigation" onPress={onMenu} className="only-mobile" />
      <div>
        <div className="topbar__title">{title}</div>
        <div className="topbar__crumb">{pathname}</div>
      </div>
      <div className="topbar__spacer" />
      <FP_StatusDot status={status} detail={socketId ? `socket ${socketId}` : null} />
      <FP_NotificationsBell />
      <FP_UserMenu />
    </header>
  );
}
