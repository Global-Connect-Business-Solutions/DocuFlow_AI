import React, { useEffect, useRef, useState } from 'react';
import { evaluateFormula, isFormula } from '../utils/formulaEval';

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

// Always-input cell. At rest it looks like a styled number; on focus / hover
// it visibly turns into an editable field. This avoids the click-then-mount
// race that made the previous button-based cell feel "dead".
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

    const display = value > 0 ? formatDecimal(value) : (placeholderDash ? '-' : '0.00');

    const commit = () => {
        if (!editing) return;
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
            // Stay in edit mode so the user can fix.
        }
    };

    // When the underlying value changes externally (e.g., undo), reset draft
    // if not actively editing.
    useEffect(() => {
        if (!editing) setDraft('');
    }, [value, editing]);

    return (
        <input
            ref={inputRef}
            type="text"
            value={editing ? draft : display}
            placeholder="0.00"
            title={title || 'Click to edit — accepts =formula like =100+50'}
            onChange={(e) => {
                if (!editing) setEditing(true);
                setDraft(e.target.value);
            }}
            onFocus={(e) => {
                setDraft(value > 0 ? String(value) : '');
                setEditing(true);
                // Use rAF so the controlled value flips to `draft` before we select.
                requestAnimationFrame(() => {
                    e.target.select?.();
                });
            }}
            onBlur={() => {
                if (editing) commit();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                    inputRef.current?.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditing(false);
                    setDraft('');
                    inputRef.current?.blur();
                }
            }}
            className={`w-full text-right font-mono text-xs px-2 py-1 rounded border bg-transparent cursor-text transition-colors ${
                editing
                    ? 'border-primary bg-background ring-2 ring-primary/40 outline-none'
                    : 'border-dashed border-border/50 hover:border-primary/60 hover:bg-primary/5'
            } ${colorClass}`}
        />
    );
};
