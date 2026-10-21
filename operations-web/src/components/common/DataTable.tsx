import React, { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { SkeletonTable } from './SkeletonLoader';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionText?: string;
  onEmptyAction?: () => void;
  onRowClick?: (row: T) => void;
  // Pagination
  currentPage?: number;
  totalPages?: number;
  totalRecords?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'Không tìm thấy dữ liệu',
  emptyDescription = 'Hiện chưa có bản ghi nào phù hợp với bộ lọc hiện tại.',
  emptyActionText,
  onEmptyAction,
  onRowClick,
  currentPage = 1,
  totalPages = 1,
  totalRecords,
  pageSize = 10,
  onPageChange,
}: DataTableProps<T>) {
  if (isLoading) {
    return <SkeletonTable rows={pageSize > 6 ? 6 : pageSize} cols={columns.length} />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5EBE5] overflow-hidden">
        <EmptyState
          icon={<Inbox className="w-6 h-6 text-[#2E7D4A]" />}
          title={emptyTitle}
          description={emptyDescription}
          actionText={emptyActionText}
          onAction={onEmptyAction}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5EBE5] shadow-[0_2px_12px_rgba(28,43,32,0.04)] overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E5EBE5] bg-[#F6F8F4] text-[#66756B] text-xs font-semibold uppercase tracking-wider sticky top-0 z-10">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`py-3.5 px-4 ${
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                      ? 'text-right'
                      : 'text-left'
                  } ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5EF] text-sm text-[#1C2B20]">
            {data.map((row, index) => (
              <tr
                key={keyExtractor(row, index)}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors h-14 sm:h-16 ${
                  onRowClick ? 'cursor-pointer hover:bg-[#F6F8F4]' : 'hover:bg-[#FAFBF9]'
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-3.5 px-4 ${
                      col.align === 'center'
                        ? 'text-center'
                        : col.align === 'right'
                        ? 'text-right'
                        : 'text-left'
                    } ${col.className || ''}`}
                  >
                    {col.render
                      ? col.render(row, index)
                      : String((row as any)[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {(totalPages > 1 || totalRecords !== undefined) && (
        <div className="px-5 py-3.5 border-t border-[#E5EBE5] bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#66756B]">
          <div>
            {totalRecords !== undefined ? (
              <span>
                Hiển thị{' '}
                <strong className="text-[#1C2B20]">
                  {(currentPage - 1) * pageSize + 1} -{' '}
                  {Math.min(currentPage * pageSize, totalRecords)}
                </strong>{' '}
                trên tổng số <strong className="text-[#1C2B20]">{totalRecords}</strong> bản ghi
              </span>
            ) : (
              <span>
                Trang <strong className="text-[#1C2B20]">{currentPage}</strong> /{' '}
                <strong className="text-[#1C2B20]">{totalPages}</strong>
              </span>
            )}
          </div>

          {totalPages > 1 && onPageChange && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-[#E5EBE5] hover:bg-[#F6F8F4] disabled:opacity-40 disabled:cursor-not-allowed text-[#66756B] hover:text-[#1C2B20] transition-colors"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1;
                  // Show max 5 page buttons
                  if (
                    p === 1 ||
                    p === totalPages ||
                    (p >= currentPage - 1 && p <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={p}
                        onClick={() => onPageChange(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                          currentPage === p
                            ? 'bg-[#2E7D4A] text-white shadow-sm'
                            : 'border border-[#E5EBE5] text-[#66756B] hover:bg-[#F6F8F4] hover:text-[#1C2B20]'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  }
                  if (p === currentPage - 2 || p === currentPage + 2) {
                    return (
                      <span key={p} className="px-1 text-slate-400">
                        …
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-[#E5EBE5] hover:bg-[#F6F8F4] disabled:opacity-40 disabled:cursor-not-allowed text-[#66756B] hover:text-[#1C2B20] transition-colors"
                title="Trang sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DataTable;
