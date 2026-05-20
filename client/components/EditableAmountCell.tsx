import React, { useEffect, useRef, useState } from 'react';
import { evaluateFormula, isFormula } from '../utils/formulaEval';
import { PencilIcon } from './icons';

const formatDecimal = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface EditableAmountCellProps {
    value: number;
    onCommit: (newValue: number) => void;
    onBeforeCommit?: () => void;
    onError?: (message: string) => void;
    colorClass: string;
    placeholderDash?: boolean;
    title?: string;
}

export const EditableAmountCell: React.FC<EditableAmountCellProps> = ({
    value,
    onCommit,
    onBeforeCommit,
    onError,
    colorClass,
    placeholderDash = true,
    title,
}) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [editing]);

    const startEdit = (e?: React.MouseEvent | React.KeyboardEvent) => {
        e?.stopPropagation();
        setDraft(value > 0 ? String(value) : '');
        setEditing(true);
    };

    const commit = () => {
        const raw = draft.trim();
        if (raw === '') {
            onBeforeCommit?.();
            onCommit(0);
            setEditing(false);
            return;
        }
        try {
            const parsed = isFormula(raw) ? evaluateFormula(raw) : Number(raw);
            if (!Number.isFinite(parsed)) throw new Error('Invalid number');
            onBeforeCommit?.();
            onCommit(Math.max(0, Math.round(parsed * 100) / 100));
            setEditing(false);
        } catch (e: any) {
            onError?.(e?.message || 'Invalid expression');
        }
    };

    const cancel = () => {
        setEditing(false);
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commit();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancel();
                    }
                }}
                className={`w-full text-right font-mono bg-background border border-primary/60 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 ${colorClass}`}
                placeholder="number or =formula"
            />
        );
    }

    return (
        <button
            type="button"
            onClick={startEdit}
            onMouseDown={(e) => e.stopPropagation()}
            title={title || 'Click to edit — accepts =formula like =100+50'}
            className={`group relative w-full flex items-center justify-end gap-1 font-mono text-xs px-1.5 py-1 rounded border border-transparent hover:border-dashed hover:border-primary/50 hover:bg-primary/5 cursor-text transition-colors ${colorClass}`}
        >
            <PencilIcon className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
            <span>{value > 0 ? formatDecimal(value) : placeholderDash ? '-' : '0.00'}</span>
        </button>
    );
};
