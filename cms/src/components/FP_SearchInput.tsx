import { Search, X } from 'lucide-react';

export interface FP_SearchInputProps {
  value?: string;
  onChange?: (next: string) => void;
  placeholder?: string;
  className?: string;
}

/** Magnifier + input + clear. */
export default function FP_SearchInput({
  value, onChange, placeholder = 'Search…', className,
}: FP_SearchInputProps) {
  return (
    <div className={`search-in ${className || ''}`}>
      <Search size={15} />
      <input
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value ? (
        <button type="button" className="toast__close" aria-label="Clear search" onClick={() => onChange?.('')}>
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}
