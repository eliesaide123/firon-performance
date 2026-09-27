import { Table2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import FP_Card from './FP_Card';
import FP_Chip from './FP_Chip';
import FP_EmptyState from './FP_EmptyState';

export interface FP_ChartCardProps {
  title: string;
  sub?: ReactNode;
  /** Rows behind the plot, used for the "Show data" table. */
  data?: Array<Record<string, unknown>>;
  nameKey?: string;
  valueKey?: string;
  valueLabel?: string;
  children?: ReactNode;
}

/**
 * Chart frame: title, the plot, and a "Show data" table so every number is
 * readable without relying on colour.
 */
export default function FP_ChartCard({
  title, sub, data = [], nameKey = 'name', valueKey = 'value', valueLabel = 'Value', children,
}: FP_ChartCardProps) {
  const [showTable, setShowTable] = useState(false);

  return (
    <FP_Card>
      <div className="row between">
        <div>
          <div className="card__title">{title}</div>
          {sub ? <div className="card__sub">{sub}</div> : null}
        </div>
        <FP_Chip icon={Table2} onPress={() => setShowTable((s) => !s)}>
          {showTable ? 'Hide data' : 'Show data'}
        </FP_Chip>
      </div>

      {data.length ? (
        <div className="chart-wrap mt3">{children}</div>
      ) : (
        <FP_EmptyState title="No data yet" message="Nothing to plot for this metric." />
      )}

      {showTable && data.length ? (
        <div className="table-wrap mt3">
          <table className="table table--compact">
            <thead>
              <tr><th>{title}</th><th style={{ textAlign: 'right' }}>{valueLabel}</th></tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={`${String(row[nameKey])}-${i}`}>
                  <td>{String(row[nameKey] ?? '—')}</td>
                  <td className="table__num">{String(row[valueKey] ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </FP_Card>
  );
}
