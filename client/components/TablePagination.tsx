import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 0] as const;

interface TablePaginationProps {
    page: number;              // 0-based
    pageSize: number;          // 0 means "All"
    totalRows: number;
    onPageChange: (next: number) => void;
    onPageSizeChange: (next: number) => void;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
    page,
    pageSize,
    totalRows,
    onPageChange,
    onPageSizeChange,
}) => {
    const isAll = pageSize === 0;
    const pageCount = isAll ? 1 : Math.max(1, Math.ceil(totalRows / pageSize));
    const clampedPage = Math.min(page, pageCount - 1);
    const start = isAll ? (totalRows === 0 ? 0 : 1) : clampedPage * pageSize + 1;
    const end = isAll ? totalRows : Math.min(totalRows, (clampedPage + 1) * pageSize);

    const goFirst = () => onPageChange(0);
    const goPrev = () => onPageChange(Math.max(0, clampedPage - 1));
    const goNext = () => onPageChange(Math.min(pageCount - 1, clampedPage + 1));
    const goLast = () => onPageChange(pageCount - 1);

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-xl border border-border/40 bg-card/40 text-xs">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                    Rows per page
                </span>
                <select
                    value={pageSize}
                    onChange={(e) => {
                        const next = Number(e.target.value);
                        onPageSizeChange(next);
                        onPageChange(0);
                    }}
                    className="h-8 rounded-lg border border-border/50 bg-background/70 px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                    {PAGE_SIZE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>
                            {opt === 0 ? 'All' : opt}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                    {totalRows === 0 ? (
                        '0 rows'
                    ) : (
                        <>
                            <span className="font-mono font-semibold text-foreground">
                                {start.toLocaleString('en-US')}–{end.toLocaleString('en-US')}
                            </span>
                            {' of '}
                            <span className="font-mono font-semibold text-foreground">
                                {totalRows.toLocaleString('en-US')}
                            </span>
                        </>
                    )}
                </span>
                {!isAll && (
                    <span className="text-muted-foreground hidden sm:inline">
                        · Page{' '}
                        <span className="font-mono font-semibold text-foreground">{clampedPage + 1}</span>
                        {' / '}
                        <span className="font-mono font-semibold text-foreground">{pageCount}</span>
                    </span>
                )}
                <div className="flex items-center gap-1 ml-1">
                    <PageBtn onClick={goFirst} disabled={clampedPage === 0 || isAll} title="First page">
                        «
                    </PageBtn>
                    <PageBtn onClick={goPrev} disabled={clampedPage === 0 || isAll} title="Previous page (PageUp)">
                        <ChevronLeftIcon className="w-3.5 h-3.5" />
                    </PageBtn>
                    <PageBtn onClick={goNext} disabled={clampedPage >= pageCount - 1 || isAll} title="Next page (PageDown)">
                        <ChevronRightIcon className="w-3.5 h-3.5" />
                    </PageBtn>
                    <PageBtn onClick={goLast} disabled={clampedPage >= pageCount - 1 || isAll} title="Last page">
                        »
                    </PageBtn>
                </div>
            </div>
        </div>
    );
};

const PageBtn: React.FC<{
    onClick: () => void;
    disabled?: boolean;
    title?: string;
    children: React.ReactNode;
}> = ({ onClick, disabled, title, children }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className="inline-flex items-center justify-center h-7 min-w-[1.75rem] px-1.5 rounded-md border border-border/50 bg-card/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[11px] font-bold"
    >
        {children}
    </button>
);
