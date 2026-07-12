"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminColumn<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  /** Hide this column on mobile card primary row (still shown when expanded) */
  mobileHidden?: boolean;
  /** Prefer as the card title on mobile */
  mobilePrimary?: boolean;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
};

interface AdminDataTableProps<T> {
  rows: T[];
  columns: AdminColumn<T>[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  pageSize?: number;
  stickyHeader?: boolean;
  className?: string;
  minWidth?: string;
  /** Columns to show in the compact mobile card before expand (defaults to first 3 non-hidden) */
  mobilePreviewKeys?: string[];
}

function Pagination({
  safePage,
  pageCount,
  pageSize,
  total,
  setPage,
}: {
  safePage: number;
  pageCount: number;
  pageSize: number;
  total: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  if (total <= pageSize) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
      <span className="text-center sm:text-left">
        Showing {safePage * pageSize + 1}–
        {Math.min((safePage + 1) * pageSize, total)} of {total}
      </span>
      <div className="flex justify-center gap-2">
        <button
          type="button"
          disabled={safePage === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="min-h-11 rounded-xl border border-gray-200 px-4 font-medium disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={safePage >= pageCount - 1}
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          className="min-h-11 rounded-xl border border-gray-200 px-4 font-medium disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function MobileCards<T>({
  pageRows,
  columns,
  rowKey,
  emptyMessage,
  mobilePreviewKeys,
}: {
  pageRows: T[];
  columns: AdminColumn<T>[];
  rowKey: (row: T) => string;
  emptyMessage: string;
  mobilePreviewKeys?: string[];
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const primaryCol =
    columns.find((c) => c.mobilePrimary) ?? columns.find((c) => !c.mobileHidden) ?? columns[0];

  const previewKeys =
    mobilePreviewKeys ??
    columns
      .filter((c) => !c.mobileHidden && c.key !== primaryCol?.key)
      .slice(0, 2)
      .map((c) => c.key);

  if (pageRows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-4 py-10 text-center text-ink-muted shadow-card">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {pageRows.map((row) => {
        const id = rowKey(row);
        const isOpen = !!expanded[id];
        const previewCols = columns.filter((c) => previewKeys.includes(c.key));
        const restCols = columns.filter(
          (c) => c.key !== primaryCol?.key && !previewKeys.includes(c.key)
        );

        return (
          <li
            key={id}
            className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card"
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {primaryCol && (
                    <div className="text-sm font-semibold text-ink">
                      {primaryCol.render(row)}
                    </div>
                  )}
                  <dl className="mt-2 space-y-1.5">
                    {previewCols.map((col) => (
                      <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                        <dt className="shrink-0 text-ink-soft">{col.label}</dt>
                        <dd className="min-w-0 text-right text-ink">{col.render(row)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              {isOpen && restCols.length > 0 && (
                <dl className="mt-3 space-y-2 border-t border-gray-50 pt-3">
                  {restCols.map((col) => (
                    <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                      <dt className="shrink-0 text-ink-soft">{col.label}</dt>
                      <dd className="min-w-0 text-right text-ink">{col.render(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {restCols.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
                  }
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-gray-50 text-sm font-medium text-ink-muted hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <>
                      Less <ChevronUp className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      More details <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminDataTable<T>({
  rows,
  columns,
  rowKey,
  emptyMessage = "No records found.",
  pageSize = 25,
  stickyHeader = true,
  className,
  minWidth = "960px",
  mobilePreviewKeys,
}: AdminDataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.sortValue?.(a) ?? "";
      const bv = col.sortValue?.(b) ?? "";
      if (av === bv) return 0;
      if (av === null || av === undefined || av === "") return 1;
      if (bv === null || bv === undefined || bv === "") return -1;
      const cmp = av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, columns, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  const pagination = (
    <Pagination
      safePage={safePage}
      pageCount={pageCount}
      pageSize={pageSize}
      total={sorted.length}
      setPage={setPage}
    />
  );

  return (
    <div className={cn(className)}>
      {/* Mobile: expandable cards */}
      <div className="md:hidden">
        <MobileCards
          pageRows={pageRows}
          columns={columns}
          rowKey={rowKey}
          emptyMessage={emptyMessage}
          mobilePreviewKeys={mobilePreviewKeys}
        />
        <div className="mt-3 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
          {pagination}
        </div>
      </div>

      {/* Tablet+: table with horizontal scroll only when needed */}
      <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" style={{ minWidth }}>
            <thead
              className={cn(
                "border-b border-gray-100 bg-gray-50 text-ink-muted",
                stickyHeader && "sticky top-0 z-10"
              )}
            >
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn("whitespace-nowrap px-4 py-3 font-medium", col.headerClassName)}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex min-h-11 items-center gap-1 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
                      >
                        {col.label}
                        {sortKey === col.key ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-muted">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className="border-b border-gray-50 hover:bg-gray-50/60"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3 align-middle", col.className)}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pagination}
      </div>
    </div>
  );
}
