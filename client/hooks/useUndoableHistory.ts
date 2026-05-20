import { useCallback, useRef, useState } from 'react';

// Snapshot-based undo/redo. Caller decides when to push (typically before each
// mutating user action). `getSnapshot` reads the current value at push time;
// `applySnapshot` restores it on undo/redo.

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
    getSnapshot: () => T,
    applySnapshot: (snapshot: T) => void,
    maxDepth: number = 50,
): UndoableHistory<T> => {
    const pastRef = useRef<HistoryEntry<T>[]>([]);
    const futureRef = useRef<HistoryEntry<T>[]>([]);
    const [, force] = useState(0);
    const rerender = useCallback(() => force(v => v + 1), []);

    // Deep clone via JSON. The transaction list is plain data, so this is safe
    // and avoids subtle mutation bugs from `[...arr]` (which would still share
    // row object references).
    const clone = (v: T): T => JSON.parse(JSON.stringify(v));

    const pushHistory = useCallback((label: string) => {
        const snap = clone(getSnapshot());
        pastRef.current.push({ label, snapshot: snap });
        if (pastRef.current.length > maxDepth) pastRef.current.shift();
        futureRef.current = [];
        rerender();
    }, [getSnapshot, maxDepth, rerender]);

    const undo = useCallback((): HistoryEntry<T> | null => {
        const entry = pastRef.current.pop();
        if (!entry) return null;
        // Save current state to future stack so redo can restore it.
        const current = clone(getSnapshot());
        futureRef.current.push({ label: entry.label, snapshot: current });
        applySnapshot(entry.snapshot);
        rerender();
        return entry;
    }, [getSnapshot, applySnapshot, rerender]);

    const redo = useCallback((): HistoryEntry<T> | null => {
        const entry = futureRef.current.pop();
        if (!entry) return null;
        const current = clone(getSnapshot());
        pastRef.current.push({ label: entry.label, snapshot: current });
        applySnapshot(entry.snapshot);
        rerender();
        return entry;
    }, [getSnapshot, applySnapshot, rerender]);

    const clear = useCallback(() => {
        pastRef.current = [];
        futureRef.current = [];
        rerender();
    }, [rerender]);

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
