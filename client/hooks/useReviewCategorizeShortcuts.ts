import React, { useCallback, useRef } from 'react';
import { useHotkeys, HotkeyMap } from './useHotkeys';
import type { ToastApi } from '../contexts/ToastContext';

// Minimal shape needed from a transaction row for navigation/selection.
interface NavRow {
    originalIndex: number;
}

interface ShortcutHandlers {
    applyBulk: () => void;
    bulkSwap: () => void;
    bulkDelete: () => void;
    autoLabel: () => void;
    togglePreview: () => void;
    toggleTotals: () => void;
    continueNext: () => void;
    undo: () => { label: string } | null;
    redo: () => { label: string } | null;
    prevPage?: () => boolean;     // returns true if page actually changed
    nextPage?: () => boolean;     // returns true if page actually changed
    pageSize?: number;            // current page size (rows per page)
}

interface UseReviewCategorizeShortcutsArgs<T extends NavRow> {
    enabled: boolean;
    filteredTransactions: T[];    // rows for the CURRENT page
    selectedIndices: Set<number>;
    setSelectedIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
    activeRowIndex: number | null;
    setActiveRowIndex: React.Dispatch<React.SetStateAction<number | null>>;
    searchInputRef: React.RefObject<HTMLInputElement>;
    filterDropdownRef: React.RefObject<HTMLDivElement>;
    bulkCategory: string;
    handlers: ShortcutHandlers;
    toast: ToastApi;
    openHelp: () => void;
    allFilteredCount?: number;    // total rows across all pages (for select-all)
    allFilteredRows?: T[];        // optional: full filtered list for select-all
}

export function useReviewCategorizeShortcuts<T extends NavRow>(
    args: UseReviewCategorizeShortcutsArgs<T>,
) {
    const {
        enabled,
        filteredTransactions,
        selectedIndices,
        setSelectedIndices,
        activeRowIndex,
        setActiveRowIndex,
        searchInputRef,
        filterDropdownRef,
        bulkCategory,
        handlers,
        toast,
        openHelp,
        allFilteredRows,
    } = args;

    // Anchor for Shift+Arrow range selection.
    const anchorRef = useRef<number | null>(null);

    // Keep latest values readable inside stable callbacks.
    const stateRef = useRef({ filteredTransactions, activeRowIndex, selectedIndices, bulkCategory });
    stateRef.current = { filteredTransactions, activeRowIndex, selectedIndices, bulkCategory };

    const clampIndex = (i: number) => {
        const len = stateRef.current.filteredTransactions.length;
        if (len === 0) return null;
        return Math.max(0, Math.min(len - 1, i));
    };

    const scrollActiveIntoView = (idx: number) => {
        // Use requestAnimationFrame so the DOM has had a chance to re-render.
        requestAnimationFrame(() => {
            const el = document.querySelector<HTMLElement>(`[data-row-index="${idx}"]`);
            el?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        });
    };

    const moveActive = (delta: number, extendSelection: boolean) => {
        const { filteredTransactions, activeRowIndex, selectedIndices } = stateRef.current;
        if (filteredTransactions.length === 0) return;
        const current = activeRowIndex ?? -1;
        const raw = current + delta;
        const len = filteredTransactions.length;

        // Boundary: if we'd go past page end and pagination is wired, flip to next page.
        if (!extendSelection && raw > len - 1 && handlers.nextPage) {
            const moved = handlers.nextPage();
            if (moved) {
                setActiveRowIndex(0);
                anchorRef.current = 0;
                requestAnimationFrame(() => scrollActiveIntoView(0));
                return;
            }
        }
        if (!extendSelection && raw < 0 && handlers.prevPage) {
            const moved = handlers.prevPage();
            if (moved) {
                const lastIdx = Math.max(0, (handlers.pageSize ?? len) - 1);
                setActiveRowIndex(lastIdx);
                anchorRef.current = lastIdx;
                requestAnimationFrame(() => scrollActiveIntoView(lastIdx));
                return;
            }
        }

        const next = clampIndex(raw);
        if (next === null) return;
        setActiveRowIndex(next);
        scrollActiveIntoView(next);

        if (extendSelection) {
            if (anchorRef.current === null) anchorRef.current = current >= 0 ? current : next;
            const a = anchorRef.current;
            const lo = Math.min(a, next);
            const hi = Math.max(a, next);
            const newSet = new Set(selectedIndices);
            for (let i = lo; i <= hi; i++) {
                newSet.add(filteredTransactions[i].originalIndex);
            }
            setSelectedIndices(newSet);
        } else {
            anchorRef.current = next;
        }
    };

    const jumpTo = (idx: number) => {
        const next = clampIndex(idx);
        if (next === null) return;
        setActiveRowIndex(next);
        anchorRef.current = next;
        scrollActiveIntoView(next);
    };

    const toggleActiveSelection = () => {
        const { filteredTransactions, activeRowIndex, selectedIndices } = stateRef.current;
        if (activeRowIndex === null || !filteredTransactions[activeRowIndex]) return;
        const oi = filteredTransactions[activeRowIndex].originalIndex;
        const newSet = new Set(selectedIndices);
        if (newSet.has(oi)) newSet.delete(oi);
        else newSet.add(oi);
        setSelectedIndices(newSet);
        anchorRef.current = activeRowIndex;
    };

    const selectAllFiltered = () => {
        // Prefer the cross-page filtered list when available; fall back to page rows.
        const source = allFilteredRows && allFilteredRows.length > 0
            ? allFilteredRows
            : stateRef.current.filteredTransactions;
        setSelectedIndices(new Set(source.map(t => t.originalIndex)));
    };

    const clearSelection = () => {
        setSelectedIndices(new Set());
        anchorRef.current = null;
    };

    const focusSearch = () => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
    };

    const openFilterDropdown = () => {
        const root = filterDropdownRef.current;
        if (!root) return;
        // CategoryDropdown renders an inner <button> as its trigger.
        const trigger = root.querySelector<HTMLButtonElement>('button');
        trigger?.click();
    };

    const reportUndo = useCallback(() => {
        const entry = handlers.undo();
        if (entry) toast.info(`Undid: ${entry.label}`);
        else toast.info('Nothing to undo');
    }, [handlers, toast]);

    const reportRedo = useCallback(() => {
        const entry = handlers.redo();
        if (entry) toast.info(`Redid: ${entry.label}`);
        else toast.info('Nothing to redo');
    }, [handlers, toast]);

    const tryApplyBulk = () => {
        const { bulkCategory, selectedIndices } = stateRef.current;
        if (!bulkCategory) {
            toast.error('Pick a bulk category first');
            return;
        }
        if (selectedIndices.size === 0) {
            toast.error('Select rows first (Space toggles the active row)');
            return;
        }
        const count = selectedIndices.size;
        handlers.applyBulk();
        toast.success(`Applied category to ${count} row${count === 1 ? '' : 's'}`);
    };

    const trySwap = () => {
        if (stateRef.current.selectedIndices.size === 0) {
            toast.error('Select rows first');
            return;
        }
        const count = stateRef.current.selectedIndices.size;
        handlers.bulkSwap();
        toast.success(`Swapped Debit/Credit on ${count} row${count === 1 ? '' : 's'}`);
    };

    const tryDelete = () => {
        if (stateRef.current.selectedIndices.size === 0) {
            toast.error('Select rows first');
            return;
        }
        const count = stateRef.current.selectedIndices.size;
        handlers.bulkDelete();
        toast.success(`Deleted ${count} row${count === 1 ? '' : 's'}`, {
            action: { label: 'Undo', onClick: reportUndo },
        });
    };

    const tryNextPage = () => {
        if (handlers.nextPage) handlers.nextPage();
    };
    const tryPrevPage = () => {
        if (handlers.prevPage) handlers.prevPage();
    };

    const bindings: HotkeyMap = {
        // Navigation
        'arrowdown': () => moveActive(1, false),
        'arrowup': () => moveActive(-1, false),
        'shift+arrowdown': () => moveActive(1, true),
        'shift+arrowup': () => moveActive(-1, true),
        // Page nav — flips pages when pagination is wired
        'pagedown': () => tryNextPage(),
        'pageup': () => tryPrevPage(),
        'home': () => jumpTo(0),
        'end': () => jumpTo(stateRef.current.filteredTransactions.length - 1),
        ' ': () => toggleActiveSelection(),
        'ctrl+a': () => selectAllFiltered(),
        'escape': {
            handler: () => {
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                clearSelection();
            },
            allowInInputs: true,
        },

        // Search / filter
        '/': () => focusSearch(),
        'ctrl+f': () => focusSearch(),
        'ctrl+shift+f': () => openFilterDropdown(),

        // Actions
        'ctrl+enter': () => tryApplyBulk(),
        'delete': () => tryDelete(),
        'backspace': () => tryDelete(),
        'ctrl+shift+x': () => trySwap(),
        'ctrl+l': () => {
            handlers.autoLabel();
            toast.info('Auto-label started...');
        },
        'ctrl+e': () => handlers.togglePreview(),
        // Totals: Ctrl+T is browser-reserved (new tab). Use Ctrl+G or plain "t".
        'ctrl+g': () => handlers.toggleTotals(),
        't': () => handlers.toggleTotals(),
        'ctrl+shift+enter': () => handlers.continueNext(),

        // History
        'ctrl+z': () => reportUndo(),
        'ctrl+y': () => reportRedo(),
        'ctrl+shift+z': () => reportRedo(),

        // Help — Shift+/ produces { shiftKey: true, key: '?' }, so register both forms.
        '?': () => openHelp(),
        'shift+?': () => openHelp(),
        'shift+/': () => openHelp(),
    };

    useHotkeys(bindings, { enabled });
}
