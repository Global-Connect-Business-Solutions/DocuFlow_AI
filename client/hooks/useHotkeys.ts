import { useEffect, useRef } from 'react';

// Generic keyboard shortcut hook.
// Bindings: { "ctrl+enter": handler, "shift+arrowdown": handler, ... }
// A binding can also be { handler, allowInInputs?: boolean, preventDefault?: boolean }.
//
// Modifiers (any order, lowercase): ctrl, meta, shift, alt.
// Key names match KeyboardEvent.key in lowercase: "enter", "escape", "arrowup", "/", "a", etc.
// "ctrl" matches Ctrl on Win/Linux and Cmd on Mac (we normalize meta->ctrl).

export type HotkeyHandler = (event: KeyboardEvent) => void;

export interface HotkeyBinding {
    handler: HotkeyHandler;
    allowInInputs?: boolean;
    preventDefault?: boolean;
}

export type HotkeyMap = Record<string, HotkeyHandler | HotkeyBinding>;

interface UseHotkeysOptions {
    enabled?: boolean;
    ignoreInInputs?: boolean;
}

const isEditableTarget = (el: EventTarget | null): boolean => {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
};

const buildEventCombo = (e: KeyboardEvent): string => {
    const parts: string[] = [];
    // Treat meta as ctrl so the same binding works on Mac.
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
};

const normalizeBindingKey = (k: string): string =>
    k.toLowerCase().split('+').map(s => s.trim()).sort((a, b) => {
        const order = ['ctrl', 'shift', 'alt'];
        const ai = order.indexOf(a);
        const bi = order.indexOf(b);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    }).join('+');

const normalizeEventCombo = (combo: string): string => normalizeBindingKey(combo);

export const useHotkeys = (bindings: HotkeyMap, options: UseHotkeysOptions = {}) => {
    const { enabled = true, ignoreInInputs = true } = options;

    // Keep latest bindings in a ref so we don't add/remove the listener on every render.
    const bindingsRef = useRef(bindings);
    bindingsRef.current = bindings;

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const combo = normalizeEventCombo(buildEventCombo(event));
            // Find a matching binding (compare normalized keys).
            const map = bindingsRef.current;
            for (const key of Object.keys(map)) {
                if (normalizeBindingKey(key) !== combo) continue;
                const raw = map[key];
                const binding: HotkeyBinding =
                    typeof raw === 'function'
                        ? { handler: raw }
                        : raw;
                if (ignoreInInputs && !binding.allowInInputs && isEditableTarget(event.target)) {
                    return;
                }
                if (binding.preventDefault !== false) {
                    event.preventDefault();
                }
                binding.handler(event);
                return;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [enabled, ignoreInInputs]);
};
