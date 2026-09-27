import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface FP_BreadcrumbItem { label: string; to?: string }
export interface FP_BreadcrumbsProps { items: FP_BreadcrumbItem[] }

/** Compact trail above a page title. */
export default function FP_Breadcrumbs({ items }: FP_BreadcrumbsProps) {
  if (!items?.length) return null;
  return (
    <nav className="fp-crumbs" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="fp-crumbs__item">
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span className="muted">{item.label}</span>}
          {i < items.length - 1 ? <ChevronRight size={12} /> : null}
        </span>
      ))}
    </nav>
  );
}
