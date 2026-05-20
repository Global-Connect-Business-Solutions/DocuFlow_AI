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
    closeHelp?: () => void;       // for global Esc fallback
    isHelpOpen?: boolean;         // for global Esc fallback
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
        closeHelp,
        isHelpOpen,
        allFilteredRows,
    } = args;

    // Anchor for Shift+Arrow range selection.
    const anchorRef = useRef<number | null>(null);

    // Keep latest values readable inside stable callbacks.
    const stateRef = useRef({ filteredTransactions, activeRowIndex, selectedIndices, bulkCategory, isHelpOpen });
    stateRef.current = { filteredTransactions, activeRowIndex, selectedIndices, bulkCategory, isHelpOpen };

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

    // Track whether we've shown the one-time "what did Space do?" hint.
    const spaceHintShownRef = useRef(false);

    const toggleActiveSelection = () => {
        const { filteredTransactions, activeRowIndex, selectedIndices } = stateRef.current;
        if (filteredTransactions.length === 0) return;
        // If nothing is active yet, default to the FIRST row (not the last) and
        // toggle its selection. This matches what the user expects: Space →
        // "select the row I'm looking at" — and the first visible row is the
        // natural starting point on an unblemished view.
        const idx = activeRowIndex ?? 0;
        if (!filteredTransactions[idx]) return;
        if (activeRowIndex === null) {
            setActiveRowIndex(idx);
            scrollActiveIntoView(idx);
        }
        const oi = filteredTransactions[idx].originalIndex;
        const newSet = new Set(selectedIndices);
        if (newSet.has(oi)) newSet.delete(oi);
        else newSet.add(oi);
        setSelectedIndices(newSet);
        anchorRef.current = idx;

        if (!spaceHintShownRef.current) {
            spaceHintShownRef.current = true;
            toast.info(
                'Selected. Press Ctrl+Enter to apply category, Del to delete, or Space again to deselect.',
                { duration: 5000 },
            );
        }
    };

    // Tab navigation between editable cells inside the active row.
    // Returns true if Tab was handled (caller should preventDefault).
    const focusNextCellInActiveRow = (dir: 1 | -1): boolean => {
        const activeTr = document.querySelector<HTMLTableRowElement>('tr[data-active="true"]');
        if (!activeTr) return false;
        const selector = 'button, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"])';
        const cells = Array.from(activeTr.querySelectorAll<HTMLElement>(selector))
            .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
        if (cells.length === 0) return false;

        const current = document.activeElement as HTMLElement | null;
        const currentIdx = current ? cells.indexOf(current) : -1;
        const nextIdx = currentIdx === -1 ? (dir === 1 ? 0 : cells.length - 1) : currentIdx + dir;

        if (nextIdx < 0 || nextIdx >= cells.length) {
            // Past the end — move active row in that direction, then focus
            // the first/last cell of the new active row after re-render.
            moveActive(dir, false);
            requestAnimationFrame(() => {
                const newActive = document.querySelector<HTMLTableRowElement>('tr[data-active="true"]');
                if (!newActive) return;
                const newCells = Array.from(newActive.querySelectorAll<HTMLElement>(selector))
                    .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
                if (newCells.length === 0) return;
                (dir === 1 ? newCells[0] : newCells[newCells.length - 1]).focus();
            });
            return true;
        }
        cells[nextIdx].focus();
        return true;
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
        // Tab through editable cells in the active row.
        // preventDefault: false so we can fall through to default browser Tab
        // when there's no active row.
        'tab': {
            handler: (e) => {
                if (focusNextCellInActiveRow(1)) e.preventDefault();
            },
            allowInInputs: true,
            preventDefault: false,
        },
        'shift+tab': {
            handler: (e) => {
                if (focusNextCellInActiveRow(-1)) e.preventDefault();
            },
            allowInInputs: true,
            preventDefault: false,
        },
        // Page nav — flips pages when pagination is wired
        'pagedown': () => tryNextPage(),
        'pageup': () => tryPrevPage(),
        'home': () => jumpTo(0),
        'end': () => jumpTo(stateRef.current.filteredTransactions.length - 1),
        ' ': () => toggleActiveSelection(),
        'ctrl+a': () => selectAllFiltered(),
        'escape': {
            handler: () => {
                // Priority 1: close the help modal if open. This is a backup —
                // the modal also installs its own Esc listener.
                if (stateRef.current.isHelpOpen && closeHelp) {
                    closeHelp();
                    return;
                }
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
