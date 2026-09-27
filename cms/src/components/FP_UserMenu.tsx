import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import useClickOutside from '../hooks/useClickOutside.js';
import FP_Avatar from './FP_Avatar';
import FP_Badge from './FP_Badge';

/** Account chip with the signed-in identity, role and sign-out. */
export default function FP_UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false), open);

  return (
    <div ref={ref} className="usermenu">
      <button
        type="button"
        className="chip"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FP_Avatar name={user?.name} src={user?.avatarUrl} size={22} />
        <span className="truncate usermenu__name">{user?.name ?? 'Account'}</span>
        <ChevronDown size={13} />
      </button>

      {open ? (
        <div className="popover popover--menu" role="menu">
          <div className="popover__head">
            <FP_Avatar name={user?.name} src={user?.avatarUrl} size={32} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="truncate">{user?.name}</div>
              <div className="tiny muted truncate">{user?.email}</div>
            </div>
          </div>
          <div className="menu">
            <div className="menu__item menu__item--static">
              <User size={15} />
              <span className="grow">Role</span>
              <FP_Badge tone={user?.role === 'admin' ? 'pt' : 'ok'}>{user?.role}</FP_Badge>
            </div>
            <button
              type="button"
              className="menu__item"
              role="menuitem"
              onClick={() => { setOpen(false); navigate('/settings'); }}
            >
              <Settings size={15} /> Settings
            </button>
            <div className="menu__sep" />
            <button
              type="button"
              className="menu__item menu__item--danger"
              role="menuitem"
              onClick={() => logout()}
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
