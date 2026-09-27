import { Image as ImageIcon, Link2 } from 'lucide-react';
import { useState } from 'react';
import type { MediaAsset, MediaKind } from '@firon/shared';
import FP_MediaPicker from './FP_MediaPicker';
import FP_MediaThumb from './FP_MediaThumb';

export interface FP_MediaRefFieldProps {
  kind?: MediaKind;
  /** Current raw value (a MediaAsset id or an absolute URL). */
  value?: unknown;
  asset?: Partial<MediaAsset> | null;
  onChange: (asset: MediaAsset | null) => void;
  placeholder?: string;
}

const preview = (value: unknown, max = 36) => {
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

/** Inline image/video reference control: shows the linked asset, opens the picker. */
export default function FP_MediaRefField({
  kind, value, asset, onChange, placeholder = 'No media set',
}: FP_MediaRefFieldProps) {
  const [open, setOpen] = useState(false);
  const isUrl = typeof value === 'string' && /^(https?:|\/)/.test(value);

  return (
    <>
      <button type="button" className="mediaref" onClick={() => setOpen(true)} title="Choose media">
        {asset
          ? <FP_MediaThumb asset={asset} className="mediaref__thumb" />
          : <span className="mediaref__thumb">{isUrl ? <Link2 size={13} /> : <ImageIcon size={13} />}</span>}
        <span className="grow truncate small">
          {asset?.title || (value ? preview(value) : <span className="muted">{placeholder}</span>)}
        </span>
      </button>
      <FP_MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        kind={kind}
        selectedId={asset?.id ?? null}
        onSelect={onChange}
        title={`Choose ${kind ?? 'media'}`}
      />
    </>
  );
}
