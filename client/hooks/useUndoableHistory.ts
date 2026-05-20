import { useCallback, useRef, useState } from 'react';

// Snapshot-based undo/redo. Pass the current value + setter; the hook keeps
// internal refs and exposes stable callbacks that read the latest value at
// call-time. Stable callback identities = no useCallback dep churn at the call
// site, which keeps the parent component's hook-order rock solid.

interface HistoryEntry<T> {
    label: string;
    snapshot: T;
}

export interface UndoableHistory<T> {
    pushHistory: (label: string) => void;
    undo: () => HistoryEntry<T> | null;
    redo: () => HistoryEntry<T> | null;
    canUndo: boolean;
    canRedo: boolean;
    clear: () => void;
    lastLabel: string | null;
}

export const useUndoableHistory = <T,>(
    value: T,
    setValue: (next: T) => void,
    maxDepth: number = 50,
): UndoableHistory<T> => {
    // Mirror the current value/setter into refs so callbacks always see the
    // latest without listing them as deps (which would thrash identity).
    const valueRef = useRef(value);
    valueRef.current = value;
    const setValueRef = useRef(setValue);
    setValueRef.current = setValue;
    const maxDepthRef = useRef(maxDepth);
    maxDepthRef.current = maxDepth;

    const pastRef = useRef<HistoryEntry<T>[]>([]);
    const futureRef = useRef<HistoryEntry<T>[]>([]);
    const [, force] = useState(0);

    const clone = (v: T): T => JSON.parse(JSON.stringify(v));

    const pushHistory = useCallback((label: string) => {
        const snap = clone(valueRef.current);
        pastRef.current.push({ label, snapshot: snap });
        if (pastRef.current.length > maxDepthRef.current) pastRef.current.shift();
        futureRef.current = [];
        force(v => v + 1);
    }, []);

    const undo = useCallback((): HistoryEntry<T> | null => {
        const entry = pastRef.current.pop();
        if (!entry) return null;
        const current = clone(valueRef.current);
        futureRef.current.push({ label: entry.label, snapshot: current });
        setValueRef.current(entry.snapshot);
        force(v => v + 1);
        return entry;
    }, []);

    const redo = useCallback((): HistoryEntry<T> | null => {
        const entry = futureRef.current.pop();
        if (!entry) return null;
        const current = clone(valueRef.current);
        pastRef.current.push({ label: entry.label, snapshot: current });
        setValueRef.current(entry.snapshot);
        force(v => v + 1);
        return entry;
    }, []);

    const clear = useCallback(() => {
        pastRef.current = [];
        futureRef.current = [];
        force(v => v + 1);
    }, []);

    return {
        pushHistory,
        undo,
        redo,
        canUndo: pastRef.current.length > 0,
        canRedo: futureRef.current.length > 0,
        clear,
        lastLabel: pastRef.current.length ? pastRef.current[pastRef.current.length - 1].label : null,
    };
};
