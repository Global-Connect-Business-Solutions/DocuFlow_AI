import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronDownIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    AssetIcon,
    BanknotesIcon,
    EquityIcon,
    IncomeIcon,
    ExpenseIcon
} from './icons';
import { CHART_OF_ACCOUNTS } from '../services/geminiService';

export const getChildCategory = (category: string) => {
    if (!category) return '';
    const parts = category.split('|');
    return parts[parts.length - 1].trim();
};

interface CategoryDropdownProps {
    value: string;
    onChange: (val: string) => void;
    customCategories: string[];
    bankCategories?: string[];
    placeholder?: string;
    className?: string;
    showAllOption?: boolean;
}

// A single entry in the flat keyboard-navigable list.
interface FlatOption {
    value: string;            // value passed to onChange()
    label: string;
}

export const CategoryDropdown = ({
    value,
    onChange,
    customCategories,
    bankCategories = [],
    placeholder = "Select Category...",
    className = "",
    showAllOption = false
}: CategoryDropdownProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const portalMenuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const openTimestampRef = useRef<number>(0);

    // Open: reset internal state, focus search, and install scroll/resize
    // listeners that keep the menu glued to the trigger. The menu uses
    // position:fixed (viewport coords) so we just need to mirror the trigger's
    // getBoundingClientRect on every relevant event.
    useEffect(() => {
        if (!isOpen) return;

        const computeStyle = () => {
            if (!dropdownRef.current) return null;
            const rect = dropdownRef.current.getBoundingClientRect();
            return {
                top: rect.bottom,
                left: rect.left,
                width: rect.width,
                rect,
            };
        };

        const apply = () => {
            const s = computeStyle();
            if (!s) return;
            // If the trigger has been scrolled fully off-screen, dismiss.
            if (s.rect.bottom < -2 || s.rect.top > window.innerHeight + 2) {
                setIsOpen(false);
                return;
            }
            setMenuStyle({ top: s.top, left: s.left, width: s.width });
        };

        apply();
        setSearchTerm('');
        setHighlightedIndex(0);
        openTimestampRef.current = Date.now();
        setTimeout(() => {
            if (searchInputRef.current) searchInputRef.current.focus();
        }, 50);

        const handleScroll = (event: Event) => {
            // Ignore scrolls that happen INSIDE the menu itself — those are
            // caused by our own arrow-key scrollIntoView and shouldn't trigger
            // a reposition.
            if (portalMenuRef.current && portalMenuRef.current.contains(event.target as Node)) {
                return;
            }
            apply();
        };

        const handleMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (dropdownRef.current && dropdownRef.current.contains(target)) return;
            if (portalMenuRef.current && portalMenuRef.current.contains(target)) return;
            setIsOpen(false);
        };

        const handleResize = () => apply();

        document.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);

        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }, [isOpen]);

    const matchesSearch = (text: string) => text.toLowerCase().includes(searchTerm.toLowerCase());

    const isUncategorized = (value === 'UNCATEGORIZED' || (value && value.toLowerCase().includes('uncategorized'))) && value !== 'ALL';
    const currentLabel = value === 'ALL' ? 'All Categories' : (isUncategorized ? 'Uncategorized' : getChildCategory(value) || placeholder);

    // Build the flat option list in display order — single source of truth for both
    // the visual render and keyboard navigation. Order MUST match the render below.
    const flatOptions = useMemo<FlatOption[]>(() => {
        const out: FlatOption[] = [];

        if (showAllOption && matchesSearch('All Categories')) {
            out.push({ value: 'ALL', label: 'All Categories' });
        }
        if (matchesSearch('Uncategorized')) {
            out.push({ value: 'UNCATEGORIZED', label: 'Uncategorized' });
        }
        out.push({ value: '__NEW__', label: 'Add New Category' });

        const visibleBanks = bankCategories.filter(c => matchesSearch(c));
        visibleBanks.forEach(c => out.push({ value: c, label: getChildCategory(c) }));

        Object.entries(CHART_OF_ACCOUNTS).forEach(([mainCategory, sub]) => {
            const relatedCustom = customCategories.filter(c => c.startsWith(`${mainCategory} |`) && matchesSearch(c));
            const standardOptions: string[] = [];
            if (Array.isArray(sub)) {
                sub.forEach(item => standardOptions.push(`${mainCategory} | ${item}`));
            } else if (typeof sub === 'object') {
                Object.entries(sub).forEach(([subGroup, items]) =>
                    (items as string[]).forEach(item => standardOptions.push(`${mainCategory} | ${subGroup} | ${item}`))
                );
            }
            const visibleStandard = standardOptions.filter(c => matchesSearch(c));

            relatedCustom.forEach(c => out.push({ value: c, label: `${getChildCategory(c)} (Custom)` }));
            visibleStandard.forEach(c => out.push({ value: c, label: getChildCategory(c) }));
        });

        const orphans = customCategories.filter(
            c => !Object.keys(CHART_OF_ACCOUNTS).some(root => c.startsWith(`${root} |`)) && matchesSearch(c),
        );
        orphans.forEach(c => out.push({ value: c, label: `${getChildCategory(c)} (Custom)` }));

        return out;
    }, [searchTerm, customCategories, bankCategories, showAllOption]);

    // Keep highlightedIndex valid as the filter narrows.
    useEffect(() => {
        if (highlightedIndex >= flatOptions.length) {
            setHighlightedIndex(Math.max(0, flatOptions.length - 1));
        }
    }, [flatOptions.length, highlightedIndex]);
    useEffect(() => { setHighlightedIndex(0); }, [searchTerm]);

    // Scroll the highlighted option into view by adjusting only the menu's
    // internal scroll container — never the window. (scrollIntoView climbs
    // ancestors and can scroll the page, which used to close the dropdown.)
    useEffect(() => {
        if (!isOpen) return;
        const menu = portalMenuRef.current;
        if (!menu) return;
        const item = menu.querySelector<HTMLElement>(`[data-option-index="${highlightedIndex}"]`);
        if (!item) return;
        const scrollContainer = item.closest<HTMLElement>('.custom-scrollbar') || menu;
        const itemRect = item.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        if (itemRect.top < containerRect.top) {
            scrollContainer.scrollTop -= containerRect.top - itemRect.top;
        } else if (itemRect.bottom > containerRect.bottom) {
            scrollContainer.scrollTop += itemRect.bottom - containerRect.bottom;
        }
    }, [highlightedIndex, isOpen]);

    const commitOption = (opt: FlatOption | undefined) => {
        if (!opt) return;
        onChange(opt.value);
        setIsOpen(false);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Stop dropdown nav keys from bubbling up to the global hotkeys hook.
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            setHighlightedIndex(i => Math.min(Math.max(0, flatOptions.length - 1), i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            setHighlightedIndex(i => Math.max(0, i - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            commitOption(flatOptions[highlightedIndex]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
        } else if (e.key === 'Home') {
            e.preventDefault();
            e.stopPropagation();
            setHighlightedIndex(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            e.stopPropagation();
            setHighlightedIndex(Math.max(0, flatOptions.length - 1));
        }
    };

    // Map a value to its flat-list index so we can apply the highlight class.
    const indexOfValue = (v: string) => flatOptions.findIndex(o => o.value === v);

    const menuContent = (
        <div
            ref={portalMenuRef}
            className="fixed z-[9999] mt-1 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150"
            style={{
                top: menuStyle?.top,
                left: menuStyle?.left,
                width: Math.max(menuStyle?.width || 260, 260)
            }}
        >
            <div className="p-2 border-b border-border bg-card sticky top-0 z-10">
                <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="w-full bg-muted/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground transition-all"
                        placeholder="Search category..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={handleSearchKeyDown}
                    />
                </div>
            </div>

            <div className="max-h-[320px] overflow-y-auto custom-scrollbar overflow-x-hidden">
                {/* Static Actions */}
                <div className="p-1 space-y-0.5">
                    {showAllOption && matchesSearch('All Categories') && (() => {
                        const idx = indexOfValue('ALL');
                        const highlighted = idx === highlightedIndex;
                        return (
                            <button
                                type="button"
                                data-option-index={idx}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                onClick={() => { onChange('ALL'); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-colors ${value === 'ALL'
                                    ? 'bg-primary text-primary-foreground'
                                    : highlighted
                                        ? 'bg-accent text-accent-foreground'
                                        : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                            >
                                All Categories
                            </button>
                        );
                    })()}
                    {matchesSearch('Uncategorized') && (() => {
                        const idx = indexOfValue('UNCATEGORIZED');
                        const highlighted = idx === highlightedIndex;
                        return (
                            <button
                                type="button"
                                data-option-index={idx}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                onClick={() => { onChange('UNCATEGORIZED'); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold italic transition-colors ${value === 'UNCATEGORIZED'
                                    ? 'bg-destructive/15 text-destructive'
                                    : highlighted
                                        ? 'bg-accent text-accent-foreground'
                                        : 'text-destructive/90 hover:bg-destructive/10 hover:text-destructive'
                                    }`}
                            >
                                Uncategorized
                            </button>
                        );
                    })()}
                    {(() => {
                        const idx = indexOfValue('__NEW__');
                        const highlighted = idx === highlightedIndex;
                        return (
                            <button
                                type="button"
                                data-option-index={idx}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                onClick={() => { onChange('__NEW__'); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-[11px] text-primary font-bold transition-colors flex items-center gap-2 ${highlighted ? 'bg-accent' : 'hover:bg-accent hover:text-accent-foreground'}`}
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                Add New Category
                            </button>
                        );
                    })()}
                </div>

                <div className="h-px bg-border my-1 mx-2" />

                {/* Bank Accounts - Dynamic from uploaded files */}
                {bankCategories.length > 0 && (() => {
                    const visibleBanks = bankCategories.filter(c => matchesSearch(c));
                    if (visibleBanks.length === 0) return null;
                    return (
                        <>
                            <div className="p-1">
                                <div className="mt-1">
                                    <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-foreground flex items-center gap-2 opacity-80">
                                        <BanknotesIcon className="w-3.5 h-3.5" />
                                        Bank Accounts
                                    </div>
                                    <div className="space-y-0.5">
                                        {visibleBanks.map(c => {
                                            const idx = indexOfValue(c);
                                            const highlighted = idx === highlightedIndex;
                                            return (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    data-option-index={idx}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    onClick={() => { onChange(c); setIsOpen(false); }}
                                                    className={`w-full text-left px-8 py-1.5 rounded-lg text-[11px] transition-colors ${value === c
                                                        ? 'bg-primary text-primary-foreground font-bold'
                                                        : highlighted
                                                            ? 'bg-accent text-accent-foreground'
                                                            : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground'
                                                        }`}
                                                >
                                                    {getChildCategory(c)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="h-px bg-border my-1 mx-2" />
                        </>
                    );
                })()}

                {/* Chart of Accounts */}
                <div className="p-1 pb-4">
                    {Object.entries(CHART_OF_ACCOUNTS).map(([mainCategory, sub]) => {
                        const relatedCustom = customCategories.filter(c => c.startsWith(`${mainCategory} |`) && matchesSearch(c));
                        const standardOptions: string[] = [];

                        if (Array.isArray(sub)) {
                            sub.forEach(item => standardOptions.push(`${mainCategory} | ${item}`));
                        } else if (typeof sub === 'object') {
                            Object.entries(sub).forEach(([subGroup, items]) =>
                                (items as string[]).forEach(item => standardOptions.push(`${mainCategory} | ${subGroup} | ${item}`))
                            );
                        }

                        const visibleStandard = standardOptions.filter(c => matchesSearch(c));

                        if (relatedCustom.length === 0 && visibleStandard.length === 0) return null;

                        return (
                            <div key={mainCategory} className="mt-2">
                                <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-foreground flex items-center gap-2 opacity-80">
                                    {mainCategory === 'Assets' && <AssetIcon className="w-3.5 h-3.5" />}
                                    {mainCategory === 'Liabilities' && <BanknotesIcon className="w-3.5 h-3.5" />}
                                    {mainCategory === 'Equity' && <EquityIcon className="w-3.5 h-3.5" />}
                                    {mainCategory === 'Income' && <IncomeIcon className="w-3.5 h-3.5" />}
                                    {mainCategory === 'Expenses' && <ExpenseIcon className="w-3.5 h-3.5" />}
                                    {mainCategory}
                                </div>

                                <div className="space-y-0.5">
                                    {relatedCustom.map(c => {
                                        const idx = indexOfValue(c);
                                        const highlighted = idx === highlightedIndex;
                                        return (
                                            <button
                                                key={c}
                                                type="button"
                                                data-option-index={idx}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                onClick={() => { onChange(c); setIsOpen(false); }}
                                                className={`w-full text-left px-8 py-1.5 rounded-lg text-[11px] transition-colors ${value === c
                                                    ? 'bg-primary text-primary-foreground font-bold'
                                                    : highlighted
                                                        ? 'bg-accent text-accent-foreground'
                                                        : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                                                    }`}
                                            >
                                                {getChildCategory(c)} (Custom)
                                            </button>
                                        );
                                    })}

                                    {visibleStandard.map(c => {
                                        const idx = indexOfValue(c);
                                        const highlighted = idx === highlightedIndex;
                                        return (
                                            <button
                                                key={c}
                                                type="button"
                                                data-option-index={idx}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                onClick={() => { onChange(c); setIsOpen(false); }}
                                                className={`w-full text-left px-8 py-1.5 rounded-lg text-[11px] transition-colors ${value === c
                                                    ? 'bg-primary text-primary-foreground font-bold'
                                                    : highlighted
                                                        ? 'bg-accent text-accent-foreground'
                                                        : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground'
                                                    }`}
                                            >
                                                {getChildCategory(c)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Handle orphan custom categories */}
                    {(() => {
                        const orphans = customCategories.filter(c => !Object.keys(CHART_OF_ACCOUNTS).some(root => c.startsWith(`${root} |`)) && matchesSearch(c));
                        if (orphans.length === 0) return null;
                        return (
                            <div className="mt-2">
                                <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-foreground flex items-center gap-2 opacity-80">
                                    Others
                                </div>
                                <div className="space-y-0.5">
                                    {orphans.map(c => {
                                        const idx = indexOfValue(c);
                                        const highlighted = idx === highlightedIndex;
                                        return (
                                            <button
                                                key={c}
                                                type="button"
                                                data-option-index={idx}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                onClick={() => { onChange(c); setIsOpen(false); }}
                                                className={`w-full text-left px-8 py-1.5 rounded-lg text-[11px] transition-colors ${value === c
                                                    ? 'bg-primary text-primary-foreground font-bold'
                                                    : highlighted
                                                        ? 'bg-accent text-accent-foreground'
                                                        : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                                                    }`}
                                            >
                                                {getChildCategory(c)} (Custom)
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/50 border ${isUncategorized ? 'border-destructive/30' : (value === 'ALL' ? 'border-primary/30' : 'border-border')} rounded-lg hover:border-primary/50 transition-all text-left outline-none min-h-[32px]`}
            >
                <span className={`text-[11px] truncate ${isUncategorized ? 'text-destructive font-bold italic' : (value === 'ALL' ? 'text-primary font-bold' : 'text-foreground')}`}>
                    {currentLabel}
                </span>
                <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : 'text-muted-foreground'}`} />
            </button>

            {isOpen && createPortal(menuContent, document.body)}
        </div>
    );
};
