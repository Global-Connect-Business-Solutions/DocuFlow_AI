import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ToastContainer, ToastItem } from '../components/Toast';

export type ToastVariant = 'success' | 'info' | 'error';

export interface ToastAction {
    label: string;
    onClick: () => void;
}

export interface ActiveToast {
    id: number;
    message: string;
    variant: ToastVariant;
    action?: ToastAction;
}

export interface ToastApi {
    success: (message: string, opts?: { action?: ToastAction; duration?: number }) => void;
    info: (message: string, opts?: { action?: ToastAction; duration?: number }) => void;
    error: (message: string, opts?: { action?: ToastAction; duration?: number }) => void;
    dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const MAX_VISIBLE = 4;
const DEFAULT_DURATION = 3000;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ActiveToast[]>([]);
    const idRef = useRef(0);
    const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

    const dismiss = useCallback((id: number) => {
        const t = timersRef.current.get(id);
        if (t) {
            clearTimeout(t);
            timersRef.current.delete(id);
        }
        setToasts(prev => prev.filter(x => x.id !== id));
    }, []);

    const push = useCallback(
        (variant: ToastVariant, message: string, opts?: { action?: ToastAction; duration?: number }) => {
            const id = ++idRef.current;
            const duration = opts?.duration ?? DEFAULT_DURATION;
            setToasts(prev => {
                const next = [...prev, { id, message, variant, action: opts?.action }];
                // Trim oldest if over the visible cap.
                if (next.length > MAX_VISIBLE) {
                    const dropped = next.splice(0, next.length - MAX_VISIBLE);
                    for (const d of dropped) {
                        const tmr = timersRef.current.get(d.id);
                        if (tmr) {
                            clearTimeout(tmr);
                            timersRef.current.delete(d.id);
                        }
                    }
                }
                return next;
            });
            const timer = setTimeout(() => dismiss(id), duration);
            timersRef.current.set(id, timer);
        },
        [dismiss],
    );

    const api = useMemo<ToastApi>(
        () => ({
            success: (msg, opts) => push('success', msg, opts),
            info: (msg, opts) => push('info', msg, opts),
            error: (msg, opts) => push('error', msg, opts),
            dismiss,
        }),
        [push, dismiss],
    );

    return (
        <ToastContext.Provider value={api}>
            {children}
            <ToastContainer>
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
                ))}
            </ToastContainer>
        </ToastContext.Provider>
    );
};

// Safe to call outside a provider in dev — returns a no-op API so test renders
// don't crash. In production paths the provider is always mounted at root.
const NOOP_API: ToastApi = {
    success: () => {},
    info: () => {},
    error: () => {},
    dismiss: () => {},
};

export const useToast = (): ToastApi => {
    const ctx = useContext(ToastContext);
    return ctx ?? NOOP_API;
};
