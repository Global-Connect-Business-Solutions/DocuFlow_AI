import React, { useEffect } from 'react';
import { XMarkIcon } from './icons';

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ShortcutEntry {
    keys: string[];
    description: string;
}

interface ShortcutGroup {
    title: string;
    items: ShortcutEntry[];
}

const GROUPS: ShortcutGroup[] = [
    {
        title: 'Navigation',
        items: [
            { keys: ['↑', '↓'], description: 'Move active row up / down' },
            { keys: ['Shift', '↑/↓'], description: 'Extend selection up / down' },
            { keys: ['PageUp', 'PageDown'], description: 'Previous / next page' },
            { keys: ['Home', 'End'], description: 'Jump to first / last row on page' },
            { keys: ['Space'], description: 'Toggle selection of active row' },
            { keys: ['Ctrl', 'A'], description: 'Select all filtered rows (all pages)' },
            { keys: ['Esc'], description: 'Clear selection / exit edit / close help' },
        ],
    },
    {
        title: 'Search & Filter',
        items: [
            { keys: ['/'], description: 'Focus the description search' },
            { keys: ['Ctrl', 'F'], description: 'Focus the description search' },
            { keys: ['Ctrl', 'Shift', 'F'], description: 'Open the category filter dropdown' },
        ],
    },
    {
        title: 'Actions',
        items: [
            { keys: ['Ctrl', 'Enter'], description: 'Apply bulk category to selection' },
            { keys: ['Del'], description: 'Delete selected rows' },
            { keys: ['Ctrl', 'Shift', 'X'], description: 'Swap Debit / Credit on selection' },
            { keys: ['Ctrl', 'L'], description: 'Auto-label with AI' },
            { keys: ['Ctrl', 'E'], description: 'Toggle preview panel' },
            { keys: ['Ctrl', 'G'], description: 'Toggle category totals panel' },
            { keys: ['T'], description: 'Toggle category totals panel' },
            { keys: ['Ctrl', 'Shift', 'Enter'], description: 'Continue to next step' },
        ],
    },
    {
        title: 'History',
        items: [
            { keys: ['Ctrl', 'Z'], description: 'Undo last action' },
            { keys: ['Ctrl', 'Y'], description: 'Redo' },
            { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo (alternate)' },
        ],
    },
    {
        title: 'Cell editing',
        items: [
            { keys: ['Click'], description: 'Click a Debit / Credit cell to edit' },
            { keys: ['= expr'], description: 'Formula in cell, e.g. =100+50*2' },
            { keys: ['Enter'], description: 'Commit edit' },
            { keys: ['Esc'], description: 'Cancel edit' },
        ],
    },
    {
        title: 'Help',
        items: [{ keys: ['?'], description: 'Show this list' }],
    },
];

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-md border border-border bg-muted/70 text-[11px] font-bold text-foreground font-mono shadow-sm">
        {children}
    </kbd>
);

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        // Lock body scroll while modal is open.
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handler);
            document.body.style.overflow = prevOverflow;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-background/95 backdrop-blur-md flex items-center justify-center z-[200] p-4 sm:p-8"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
        >
            <div
                className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex justify-between items-center px-8 py-6 border-b border-border bg-card">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                            Review Categorize
                        </div>
                        <h2 id="shortcuts-title" className="text-2xl font-bold text-foreground">
                            Keyboard Shortcuts
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted"
                        aria-label="Close"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="px-8 py-6 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                    {GROUPS.map(group => (
                        <div key={group.title}>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground mb-3 pb-2 border-b border-border/40">
                                {group.title}
                            </h3>
                            <ul className="space-y-2.5">
                                {group.items.map((entry, i) => (
                                    <li
                                        key={`${group.title}-${i}`}
                                        className="flex items-center justify-between gap-3 text-sm"
                                    >
                                        <span className="text-foreground">{entry.description}</span>
                                        <span className="flex items-center gap-1 flex-shrink-0">
                                            {entry.keys.map((k, ki) => (
                                                <React.Fragment key={ki}>
                                                    {ki > 0 && (
                                                        <span className="text-muted-foreground text-xs">+</span>
                                                    )}
                                                    <Kbd>{k}</Kbd>
                                                </React.Fragment>
                                            ))}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="sticky bottom-0 px-8 py-4 border-t border-border bg-muted/40 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
                    <span>
                        Shortcuts are active only on{' '}
                        <span className="font-bold text-foreground">Step 1 · Review Categorize</span>{' '}
                        and are suppressed while typing in inputs.
                    </span>
                    <span className="flex items-center gap-2">
                        Press <Kbd>Esc</Kbd> or click outside to close
                    </span>
                </div>
            </div>
        </div>
    );
};
