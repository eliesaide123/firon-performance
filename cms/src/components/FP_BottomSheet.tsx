import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import useFpFocusTrap from './useFpFocusTrap';

export interface FP_BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

/** Slide-up sheet with a grab handle and an 82%-height ceiling. */
export default function FP_BottomSheet({
  open, onClose, title, children, footer,
}: FP_BottomSheetProps) {
  const ref = useFpFocusTrap(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="sheet-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Sheet'}
        tabIndex={-1}
        className="sheet"
      >
        <div className="sheet__grab" />
        {title ? <div className="modal__title">{title}</div> : null}
        <div className="sheet__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
