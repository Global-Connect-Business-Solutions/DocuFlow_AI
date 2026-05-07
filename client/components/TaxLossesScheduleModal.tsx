import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, InformationCircleIcon, RefreshIcon } from './icons';

export interface TaxLossesSchedule {
    broughtForward: number;
    incurredCurrentPeriod: number;
    receivedFromRestructuring: number;
    transferredFromRestructuring: number;
    limitedDueToOwnershipChange: number;
    utilisedCurrentPeriod: number;
    otherAdjustmentsIncrease: number;
    otherAdjustmentsDecrease: number;
    carriedForwardAvailable: number;
    broughtForwardManuallyOverridden?: boolean;
    incurredCurrentPeriodManuallyOverridden?: boolean;
}

export const DEFAULT_TAX_LOSSES_SCHEDULE: TaxLossesSchedule = {
    broughtForward: 0,
    incurredCurrentPeriod: 0,
    receivedFromRestructuring: 0,
    transferredFromRestructuring: 0,
    limitedDueToOwnershipChange: 0,
    utilisedCurrentPeriod: 0,
    otherAdjustmentsIncrease: 0,
    otherAdjustmentsDecrease: 0,
    carriedForwardAvailable: 0,
    broughtForwardManuallyOverridden: false,
    incurredCurrentPeriodManuallyOverridden: false,
};

/**
 * Computes the FTA-style Tax Losses Schedule given the user-entered fields and
 * the current period's pre-loss-adjustment taxable income (Q19).
 *
 * Set-off rules (UAE FTA Article 37):
 *   - Set-off only when current period has a profit (Q19 > 0)
 *   - Maximum set-off = 75% of current period profit
 *   - Available loss = brought_forward + received_restructuring + adj_increase
 *                      - transferred_restructuring - limited_ownership - adj_decrease
 *   - Utilised = min(max(0, available_loss), max_setoff)
 *   - Carried forward = max(0, available_loss - utilised) + incurred_current_period
 */
export const computeTaxLossesSchedule = (
    schedule: Partial<TaxLossesSchedule>,
    taxableIncomeBeforeAdj: number
): TaxLossesSchedule => {
    const toInt = (v: unknown) => Math.round(Number(v) || 0);

    const broughtForward = toInt(schedule.broughtForward);
    const receivedFromRestructuring = toInt(schedule.receivedFromRestructuring);
    const transferredFromRestructuring = toInt(schedule.transferredFromRestructuring);
    const limitedDueToOwnershipChange = toInt(schedule.limitedDueToOwnershipChange);
    const otherAdjustmentsIncrease = toInt(schedule.otherAdjustmentsIncrease);
    const otherAdjustmentsDecrease = toInt(schedule.otherAdjustmentsDecrease);

    // Incurred = manual override if set, else auto-derive from negative Q19
    const autoIncurred = taxableIncomeBeforeAdj < 0
        ? Math.abs(toInt(taxableIncomeBeforeAdj))
        : 0;
    const incurredCurrentPeriod = schedule.incurredCurrentPeriodManuallyOverridden
        ? toInt(schedule.incurredCurrentPeriod)
        : autoIncurred;

    const currentProfit = Math.max(0, toInt(taxableIncomeBeforeAdj));

    const availableLossBeforeUtilisation =
        broughtForward
        + receivedFromRestructuring
        + otherAdjustmentsIncrease
        - transferredFromRestructuring
        - limitedDueToOwnershipChange
        - otherAdjustmentsDecrease;

    const maxSetoff = Math.round(currentProfit * 0.75);
    const utilisedCurrentPeriod = Math.min(
        Math.max(0, availableLossBeforeUtilisation),
        maxSetoff
    );

    const remainingPriorLoss = Math.max(0, availableLossBeforeUtilisation - utilisedCurrentPeriod);
    const carriedForwardAvailable = remainingPriorLoss + incurredCurrentPeriod;

    return {
        broughtForward,
        incurredCurrentPeriod,
        receivedFromRestructuring,
        transferredFromRestructuring,
        limitedDueToOwnershipChange,
        utilisedCurrentPeriod,
        otherAdjustmentsIncrease,
        otherAdjustmentsDecrease,
        carriedForwardAvailable,
        broughtForwardManuallyOverridden: schedule.broughtForwardManuallyOverridden,
        incurredCurrentPeriodManuallyOverridden: schedule.incurredCurrentPeriodManuallyOverridden,
    };
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    schedule: TaxLossesSchedule;
    onChange: (next: TaxLossesSchedule) => void;
    taxableIncomeBeforeAdj: number;
    currency?: string;
    onAutoLoadPreviousYear?: () => void;
    autoLoadStatus?: 'idle' | 'loading' | 'loaded' | 'no_prior';
    autoLoadHint?: string;
    isReadOnly?: boolean;
}

export const TaxLossesScheduleModal: React.FC<Props> = ({
    isOpen,
    onClose,
    schedule,
    onChange,
    taxableIncomeBeforeAdj,
    currency = 'AED',
    onAutoLoadPreviousYear,
    autoLoadStatus = 'idle',
    autoLoadHint,
    isReadOnly = false,
}) => {
    const computed = useMemo(
        () => computeTaxLossesSchedule(schedule, taxableIncomeBeforeAdj),
        [schedule, taxableIncomeBeforeAdj]
    );

    if (!isOpen) return null;

    const updateField = (key: keyof TaxLossesSchedule, value: number) => {
        const next: TaxLossesSchedule = {
            ...schedule,
            [key]: Math.round(Number(value) || 0),
        };
        if (key === 'broughtForward') {
            next.broughtForwardManuallyOverridden = true;
        }
        if (key === 'incurredCurrentPeriod') {
            next.incurredCurrentPeriodManuallyOverridden = true;
        }
        // Recompute derived fields
        onChange(computeTaxLossesSchedule(next, taxableIncomeBeforeAdj));
    };

    const formatNum = (n: number) => Math.round(n).toLocaleString();

    const rows: Array<{
        label: string;
        key: keyof TaxLossesSchedule;
        editable: boolean;
        info?: string;
    }> = [
        { label: 'Tax Losses brought forward', key: 'broughtForward', editable: true, info: 'Carried forward from prior tax periods (auto-loaded from prior CT filing or P&L previous-year loss)' },
        { label: 'Tax Losses incurred during the Tax Period', key: 'incurredCurrentPeriod', editable: true, info: 'Pre-fills with absolute value of negative Q19; you can override' },
        { label: 'Tax Losses received due to Business Restructuring Relief', key: 'receivedFromRestructuring', editable: true },
        { label: 'Tax Losses transferred due to Business Restructuring Relief', key: 'transferredFromRestructuring', editable: true },
        { label: 'Tax Losses limited (change in ownership / business activity)', key: 'limitedDueToOwnershipChange', editable: true },
        { label: 'Tax Losses utilised in current Tax Period', key: 'utilisedCurrentPeriod', editable: false, info: 'Capped at 75% of current period profit (FTA Article 37)' },
        { label: 'Other adjustments which increase the Tax Losses', key: 'otherAdjustmentsIncrease', editable: true },
        { label: 'Other adjustments which decrease the Tax Losses', key: 'otherAdjustmentsDecrease', editable: true },
        { label: 'Tax Losses carried forward (available for transfer)', key: 'carriedForwardAvailable', editable: false, info: 'Remaining loss available for future periods' },
    ];

    const currentProfit = Math.max(0, Math.round(taxableIncomeBeforeAdj));
    const maxSetoffCap = Math.round(currentProfit * 0.75);

    return createPortal(
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-border bg-muted/40 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-foreground uppercase tracking-tight">Tax Losses Schedule</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            FTA Article 37 — set-off prior-year losses against current period profit (max 75%).
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Close"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-4">
                    <div className="grid grid-cols-2 gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current Period (Q19)</div>
                            <div className={`text-lg font-mono font-bold ${currentProfit > 0 ? 'text-status-success' : 'text-status-warning'}`}>
                                {taxableIncomeBeforeAdj < 0 ? '(' : ''}{formatNum(Math.abs(taxableIncomeBeforeAdj))}{taxableIncomeBeforeAdj < 0 ? ')' : ''} {currency}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                {taxableIncomeBeforeAdj > 0 ? 'Profit — set-off allowed' : 'Loss — no set-off this period'}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Max Set-off (75%)</div>
                            <div className="text-lg font-mono font-bold text-primary">{formatNum(maxSetoffCap)} {currency}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">Cap on Q20</div>
                        </div>
                    </div>

                    {onAutoLoadPreviousYear && (
                        <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg">
                            <div className="text-xs text-muted-foreground">
                                {autoLoadStatus === 'loaded' && (autoLoadHint || 'Brought-forward auto-loaded from previous year filing.')}
                                {autoLoadStatus === 'no_prior' && 'No previous year filing found in the system.'}
                                {autoLoadStatus === 'loading' && 'Loading previous year carry-forward...'}
                                {autoLoadStatus === 'idle' && 'Auto-load brought-forward from the previous year filing if available.'}
                            </div>
                            <button
                                disabled={isReadOnly || autoLoadStatus === 'loading'}
                                onClick={onAutoLoadPreviousYear}
                                className="px-3 py-1.5 text-xs font-bold uppercase rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <RefreshIcon className={`w-3 h-3 ${autoLoadStatus === 'loading' ? 'animate-spin' : ''}`} />
                                Auto-load
                            </button>
                        </div>
                    )}

                    <div className="space-y-2">
                        {rows.map((row) => {
                            const value = row.key === 'utilisedCurrentPeriod' || row.key === 'carriedForwardAvailable' || row.key === 'incurredCurrentPeriod'
                                ? computed[row.key] as number
                                : (schedule[row.key] as number) ?? 0;
                            const isComputed = !row.editable;
                            return (
                                <div
                                    key={row.key}
                                    className={`flex items-center justify-between p-3 rounded-lg border ${isComputed ? 'bg-muted/40 border-border' : 'bg-background border-border'}`}
                                >
                                    <div className="flex items-center gap-2 flex-1 pr-4">
                                        <span className="text-xs font-semibold text-foreground">{row.label}</span>
                                        {row.info && (
                                            <span className="group relative">
                                                <InformationCircleIcon className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                                <span className="hidden group-hover:block absolute left-5 top-0 z-10 w-56 p-2 bg-foreground text-background text-[10px] rounded shadow-lg">
                                                    {row.info}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            disabled={isComputed || isReadOnly}
                                            value={Number.isFinite(value) ? Math.round(value as number) : 0}
                                            onChange={(e) => updateField(row.key, parseFloat(e.target.value) || 0)}
                                            className={`font-mono font-bold text-sm text-right outline-none w-44 px-2 py-1 rounded ${
                                                isComputed
                                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                                    : 'bg-transparent border-b border-border focus:border-primary text-foreground'
                                            }`}
                                        />
                                        <span className="text-[10px] opacity-60">{currency}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-4 bg-status-success-soft border border-status-success rounded-xl space-y-1">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase tracking-widest text-status-success">Q20 — Tax Losses Utilised</span>
                            <span className="font-mono text-base font-bold text-status-success">
                                {formatNum(computed.utilisedCurrentPeriod)} {currency}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] uppercase text-muted-foreground">Carried forward to next year</span>
                            <span className="font-mono text-xs font-semibold text-foreground">
                                {formatNum(computed.carriedForwardAvailable)} {currency}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-muted/40 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-sm transition-colors shadow-lg"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
