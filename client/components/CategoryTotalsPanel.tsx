import React, { useMemo } from 'react';
import { XMarkIcon } from './icons';

const formatDecimal = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface TotalsRow {
    category?: string;
    debit?: number;
    credit?: number;
}

interface CategoryTotalsPanelProps {
    rows: TotalsRow[];
    onClose: () => void;
}

const UNCATEGORIZED_LABEL = 'Uncategorized';

const getChildCategory = (raw: string): string => {
    if (!raw) return UNCATEGORIZED_LABEL;
    const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
    return parts[parts.length - 1] || UNCATEGORIZED_LABEL;
};

export const CategoryTotalsPanel: React.FC<CategoryTotalsPanelProps> = ({ rows, onClose }) => {
    const groups = useMemo(() => {
        const map = new Map<string, { count: number; sumDebit: number; sumCredit: number }>();
        for (const r of rows) {
            const raw = r.category || UNCATEGORIZED_LABEL;
            const label = raw.toUpperCase().includes('UNCATEGORIZED') ? UNCATEGORIZED_LABEL : getChildCategory(raw);
            const entry = map.get(label) || { count: 0, sumDebit: 0, sumCredit: 0 };
            entry.count++;
            entry.sumDebit += r.debit || 0;
            entry.sumCredit += r.credit || 0;
            map.set(label, entry);
        }
        return Array.from(map.entries())
            .map(([label, v]) => ({ label, ...v, net: v.sumCredit - v.sumDebit }))
            .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
    }, [rows]);

    const totals = useMemo(
        () => groups.reduce(
            (acc, g) => {
                acc.count += g.count;
                acc.debit += g.sumDebit;
                acc.credit += g.sumCredit;
                return acc;
            },
            { count: 0, debit: 0, credit: 0 },
        ),
        [groups],
    );

    return (
        <div className="w-full lg:w-1/3 bg-background rounded-lg border border-border flex flex-col h-[600px] lg:h-full">
            <div className="p-3 border-b border-border flex justify-between items-center bg-muted rounded-t-lg">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                        Category Totals
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {groups.length} categories · {totals.count} rows
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-muted/80 rounded text-status-danger"
                    aria-label="Close category totals"
                >
                    <XMarkIcon className="w-5 h-5" />
                </button>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        <tr>
                            <th className="px-3 py-2 text-left">Category</th>
                            <th className="px-2 py-2 text-right">Count</th>
                            <th className="px-2 py-2 text-right">Debit</th>
                            <th className="px-2 py-2 text-right">Credit</th>
                            <th className="px-3 py-2 text-right">Net</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groups.map(g => (
                            <tr key={g.label} className="border-b border-border/40 hover:bg-muted/30">
                                <td className="px-3 py-1.5 text-foreground font-medium truncate max-w-[180px]" title={g.label}>
                                    {g.label}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{g.count}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-status-danger">
                                    {g.sumDebit > 0 ? formatDecimal(g.sumDebit) : '-'}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono text-status-success">
                                    {g.sumCredit > 0 ? formatDecimal(g.sumCredit) : '-'}
                                </td>
                                <td className={`px-3 py-1.5 text-right font-mono font-semibold ${g.net >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                                    {formatDecimal(g.net)}
                                </td>
                            </tr>
                        ))}
                        {groups.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                                    No transactions in view.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    {groups.length > 0 && (
                        <tfoot className="sticky bottom-0 bg-card border-t border-border">
                            <tr>
                                <td className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-foreground">
                                    Totals
                                </td>
                                <td className="px-2 py-2 text-right font-mono font-bold text-foreground">{totals.count}</td>
                                <td className="px-2 py-2 text-right font-mono font-bold text-status-danger">
                                    {formatDecimal(totals.debit)}
                                </td>
                                <td className="px-2 py-2 text-right font-mono font-bold text-status-success">
                                    {formatDecimal(totals.credit)}
                                </td>
                                <td className={`px-3 py-2 text-right font-mono font-bold ${totals.credit - totals.debit >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                                    {formatDecimal(totals.credit - totals.debit)}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
};
