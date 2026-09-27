export interface FP_DividerProps { className?: string }

/** 1px hairline. */
export default function FP_Divider({ className }: FP_DividerProps) {
  return <div className={`divider ${className || ''}`} role="separator" />;
}
