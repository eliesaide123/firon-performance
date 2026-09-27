import clsx from 'clsx';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import FP_EmptyState from './FP_EmptyState';
import FP_Pagination from './FP_Pagination';
import FP_SkeletonRows from './FP_SkeletonRows';

export interface FP_TableColumn<Row> {
  key: string;
  header: ReactNode;
  render?: (row: Row) => ReactNode;
  /** Value used when sorting this column; defaults to `row[key]`. */
  sortValue?: (row: Row) => string | number | null | undefined;
  sortable?: boolean;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export interface FP_TableProps<Row> {
  columns: Array<FP_TableColumn<Row>>;
  rows: Row[];
  rowKey?: (row: Row, index: number) => string | number;
  loading?: boolean;
  empty?: ReactNode;
  pageSize?: number;
  /** Let the API paginate instead of slicing locally. */
  serverPaged?: boolean;
  page?: number;
  pages?: number;
  total?: number;
  limit?: number;
  onPageChange?: (page: number) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  onRowPress?: (row: Row) => void;
  rowClassName?: (row: Row) => string | undefined;
  compact?: boolean;
}

/** Sortable, paginated table. */
export default function FP_Table<Row>({
  columns, rows, rowKey, loading, empty, pageSize = 25, serverPaged,
  page: serverPage, pages: serverPages, total: serverTotal, limit,
  onPageChange, initialSort, onRowPress, rowClassName, compact,
}: FP_TableProps<Row>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const get = col.sortValue ?? ((r: Row) => (r as Record<string, unknown>)[col.key] as string | number);
    const factor = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = get(a); const bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor;
    });
  }, [rows, sort, columns]);

  const totalPages = serverPaged ? (serverPages || 1) : Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = serverPaged ? (serverPage || 1) : Math.min(page, totalPages);
  const visible = serverPaged ? sorted : sorted.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key: string) => {
    setPage(1);
    setSort((s) => (s?.key === key
      ? (s.dir === 'asc' ? { key, dir: 'desc' as const } : null)
      : { key, dir: 'asc' as const }));
  };

  if (loading) return <div style={{ padding: 16 }}><FP_SkeletonRows rows={6} height={17} /></div>;
  if (!rows.length) return <>{empty ?? <FP_EmptyState />}</>;

  return (
    <>
      <div className="table-wrap">
        <table className={clsx('table', compact && 'table--compact')}>
          <thead>
            <tr>
              {columns.map((c) => {
                const sortable = c.sortable !== false;
                const isSorted = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    style={{ width: c.width, textAlign: c.align }}
                    className={clsx(sortable && 'is-sortable')}
                    onClick={sortable ? () => toggleSort(c.key) : undefined}
                    aria-sort={isSorted ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <span className="th-sort">
                      {c.header}
                      {isSorted ? (sort!.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={rowKey ? rowKey(row, i) : ((row as { id?: string }).id ?? i)}
                className={rowClassName?.(row)}
                onClick={onRowPress ? () => onRowPress(row) : undefined}
                style={onRowPress ? { cursor: 'pointer' } : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align }} className={c.className}>
                    {c.render ? c.render(row) : ((row as Record<string, ReactNode>)[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FP_Pagination
        page={current}
        pages={totalPages}
        total={serverPaged ? serverTotal : sorted.length}
        limit={limit}
        onChange={(p) => (serverPaged ? onPageChange?.(p) : setPage(p))}
      />
    </>
  );
}
