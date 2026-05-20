import React from 'react';
import { CheckIcon, XMarkIcon, ExclamationTriangleIcon, InformationCircleIcon } from './icons';
import type { ActiveToast } from '../contexts/ToastContext';

export const ToastContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
        {children}
    </div>
);

const VARIANT_STYLES: Record<ActiveToast['variant'], { ring: string; iconBg: string; icon: React.ReactNode }> = {
    success: {
        ring: 'border-status-success/40',
        iconBg: 'bg-status-success/10 text-status-success',
        icon: <CheckIcon className="w-4 h-4" />,
    },
    info: {
        ring: 'border-primary/40',
        iconBg: 'bg-primary/10 text-primary',
        icon: <InformationCircleIcon className="w-4 h-4" />,
    },
    error: {
        ring: 'border-status-danger/40',
        iconBg: 'bg-status-danger/10 text-status-danger',
        icon: <ExclamationTriangleIcon className="w-4 h-4" />,
    },
};

interface ToastItemProps {
    toast: ActiveToast;
    onDismiss: () => void;
}

export const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
    const styles = VARIANT_STYLES[toast.variant];
    return (
        <div
            className={`pointer-events-auto flex items-start gap-3 min-w-[260px] max-w-[420px] rounded-xl border ${styles.ring} bg-card/95 backdrop-blur-sm shadow-lg shadow-background/30 px-3 py-2.5`}
            role="status"
        >
            <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${styles.iconBg}`}>
                {styles.icon}
            </div>
            <div className="flex-1 text-sm text-foreground leading-tight pt-0.5">{toast.message}</div>
            {toast.action && (
                <button
                    onClick={() => {
                        toast.action!.onClick();
                        onDismiss();
                    }}
                    className="text-xs font-bold uppercase tracking-[0.16em] text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded"
                >
                    {toast.action.label}
                </button>
            )}
            <button
                onClick={onDismiss}
                className="text-muted-foreground hover:text-foreground transition-colors -mr-1 -mt-0.5"
                aria-label="Dismiss"
            >
                <XMarkIcon className="w-4 h-4" />
            </button>
        </div>
    );
};
