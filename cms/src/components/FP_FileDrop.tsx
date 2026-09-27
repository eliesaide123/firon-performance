import clsx from 'clsx';
import { UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';

export interface FP_FileDropProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  title?: string;
  sub?: string;
  disabled?: boolean;
}

/** Drag-and-drop (or click) upload zone. Progress is rendered by the caller. */
export default function FP_FileDrop({
  onFiles,
  accept = 'image/*,video/*',
  multiple = true,
  title = 'Drop files here or click to browse',
  sub = 'MP4 or JPG · routed through admin approval',
  disabled,
}: FP_FileDropProps) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const emit = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter(Boolean);
    if (files.length) onFiles(multiple ? files : [files[0]!]);
  };

  return (
    <div
      className={clsx('filedrop', over && 'filedrop--over')}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      aria-label={title}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) { e.preventDefault(); inputRef.current?.click(); }
      }}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) emit(e.dataTransfer.files); }}
    >
      <UploadCloud size={26} style={{ margin: '0 auto' }} />
      <div className="filedrop__title">{title}</div>
      <div className="filedrop__sub">{sub}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => { emit(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
