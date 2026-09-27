import { Plus, type LucideIcon } from 'lucide-react';

export interface FP_FabProps {
  icon?: LucideIcon;
  label: string;
  onPress?: () => void;
}

/** Floating action button. */
export default function FP_Fab({ icon: Icon = Plus, label, onPress }: FP_FabProps) {
  return (
    <button type="button" className="fab" aria-label={label} title={label} onClick={onPress}>
      <Icon size={22} />
    </button>
  );
}
