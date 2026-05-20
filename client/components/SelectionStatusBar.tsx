import React, { useMemo } from 'react';
import { CheckIcon, ArrowsRightLeftIcon, XMarkIcon } from './icons';

const formatDecimal = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface StatusRow {
    originalIndex: number;
    debit?: number;
    credit?: number;
}

interface SelectionStatusBarProps {
    selectedIndices: Set<number>;
    rows: StatusRow[];
    onClear?: () => void;
    onApply?: () => void;
    canApply?: boolean;
}

export const SelectionStatusBar: React.FC<SelectionStatusBarProps> = ({
    selectedIndices,
    rows,
    onClear,
    onApply,
    canApply = false,
}) => {
    const stats = useMemo(() => {
        if (selectedIndices.size === 0) return null;
        let count = 0;
        let sumDebit = 0;
        let sumCredit = 0;
        let debitCount = 0;
        let creditCount = 0;
        for (const r of rows) {
            if (!selectedIndices.has(r.originalIndex)) continue;
            count++;
            const d = r.debit || 0;
            const c = r.credit || 0;
            sumDebit += d;
            sumCredit += c;
            if (d > 0) debitCount++;
            if (c > 0) creditCount++;
        }
        const net = sumCredit - sumDebit;
        const avgDebit = debitCount > 0 ? sumDebit / debitCount : 0;
        const avgCredit = creditCount > 0 ? sumCredit / creditCount : 0;
        return { count, sumDebit, sumCredit, net, avgDebit, avgCredit };
    }, [selectedIndices, rows]);

    // Idle hint bar (no selection) — keeps the layout stable, modern look.
    if (!stats) {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm px-4 py-2 text-xs text-muted-foreground transition-all duration-200 ease-out">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted/60">
                    <CheckIcon className="w-3 h-3 opacity-40" />
                </span>
                <span>
                    Click rows or press <Kbd>Space</Kbd> on the active row to start selecting. Live totals will appear here.
                </span>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/80 backdrop-blur-md shadow-sm transition-all duration-200 ease-out animate-in fade-in slide-in-from-top-1">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
            <div className="flex flex-wrap items-center gap-x-1 gap-y-2 pl-5 pr-3 py-2.5">
                <span className="inline-flex items-center gap-1.5 pr-3 mr-1 border-r border-border/40">
                    <span className="inline-flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                        Selection
                    </span>
                </span>

                <Stat label="Count" value={String(stats.count)} />
                <Stat label="Sum Debit" value={formatDecimal(stats.sumDebit)} tone="danger" />
                <Stat label="Sum Credit" value={formatDecimal(stats.sumCredit)} tone="success" />
                <Stat
                    label="Net"
                    value={formatDecimal(stats.net)}
                    tone={stats.net >= 0 ? 'success' : 'danger'}
                    emphasize
                />
                <Stat label="Avg Debit" value={formatDecimal(stats.avgDebit)} muted />
                <Stat label="Avg Credit" value={formatDecimal(stats.avgCredit)} muted />

                <div className="ml-auto flex items-center gap-1.5">
                    {onApply && (
                        <button
                            type="button"
                            onClick={onApply}
                            disabled={!canApply}
                            title="Apply bulk category to selection (Ctrl+Enter)"
                            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-[0.22em] bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ArrowsRightLeftIcon className="w-3 h-3" />
                            Apply
                        </button>
                    )}
                    {onClear && (
                        <button
                            type="button"
                            onClick={onClear}
                            title="Clear selection (Esc)"
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.22em] border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                        >
                            <XMarkIcon className="w-3 h-3" />
                            Clear
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

interface StatProps {
    label: string;
    value: string;
    tone?: 'success' | 'danger';
    muted?: boolean;
    emphasize?: boolean;
}

const Stat: React.FC<StatProps> = ({ label, value, tone, muted, emphasize }) => {
    const valueClass =
        tone === 'success'
            ? 'text-status-success'
            : tone === 'danger'
              ? 'text-status-danger'
              : muted
                ? 'text-muted-foreground'
                : 'text-foreground';
    return (
        <span className="inline-flex items-baseline gap-1.5 px-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
                {label}
            </span>
            <span className={`font-mono font-semibold ${emphasize ? 'text-sm' : 'text-xs'} ${valueClass}`}>
                {value}
            </span>
        </span>
    );
};

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded border border-border bg-muted/70 text-[10px] font-bold text-foreground font-mono">
        {children}
    </kbd>
);
