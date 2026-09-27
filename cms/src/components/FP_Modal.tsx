import clsx from 'clsx';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import FP_IconButton from './FP_IconButton';
import useFpFocusTrap from './useFpFocusTrap';

export interface FP_ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  size?: 'md' | 'lg';
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Backdrop + centred panel. Esc closes, focus is trapped. */
export default function FP_Modal({
  open, onClose, title, size, children, footer, className,
}: FP_ModalProps) {
  const ref = useFpFocusTrap(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        tabIndex={-1}
        className={clsx('modal', size && `modal--${size}`, className)}
      >
        <div className="modal__head">
          <div className="modal__title">{title}</div>
          <FP_IconButton icon={X} label="Close" small onPress={onClose} />
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
