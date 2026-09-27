import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface FP_PaginationProps {
  page?: number;
  pages?: number;
  total?: number;
  limit?: number;
  onChange: (page: number) => void;
}

/** Page controls with a five-page sliding window. */
export default function FP_Pagination({
  page = 1, pages = 1, total = 0, limit, onChange,
}: FP_PaginationProps) {
  if (!pages || pages <= 1) {
    return total ? <div className="pagination">{total} item{total === 1 ? '' : 's'}</div> : null;
  }

  const from = Math.max(1, Math.min(page - 2, pages - 4));
  const to = Math.min(pages, from + 4);
  const window: number[] = [];
  for (let i = from; i <= to; i += 1) window.push(i);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span>
        {total ? `${total} items · ` : ''}page {page} of {pages}
        {limit ? ` · ${limit}/page` : ''}
      </span>
      <div className="pagination__pages">
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={13} />
        </button>
        {from > 1 ? <button type="button" onClick={() => onChange(1)}>1</button> : null}
        {window.map((p) => (
          <button
            key={p}
            type="button"
            aria-current={p === page ? 'page' : undefined}
            className={p === page ? 'is-active' : undefined}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
        {to < pages ? <button type="button" onClick={() => onChange(pages)}>{pages}</button> : null}
        <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <ChevronRight size={13} />
        </button>
      </div>
    </nav>
  );
}
