// Validation for the "Final Return" deregistration scenario in the CT Filing
// Tax Computation step PDF download. UAE rule: a final return implies the
// company is winding down — all assets and all liabilities should be 0.
// Equity items (share capital, retained earnings, SCA) are excluded; the
// deregistration transfer of retained earnings to the shareholder's current
// account is handled separately.

export type BsStructureItem = {
    id: string;
    label: string;
    type: 'header' | 'subheader' | 'item' | 'total' | 'grand_total';
};

export type FinalReturnViolation = {
    id: string;
    label: string;
    section: 'asset' | 'liability';
    currentYear: number;
};

type BsRawValue = number | { currentYear?: number; previousYear?: number } | undefined | null;

const ASSETS_HEADER_IDS = new Set(['assets_header']);
const EQUITY_LIABILITIES_HEADER_IDS = new Set(['equity_liabilities_header']);
const EQUITY_SUBHEADER_IDS = new Set(['equity_header']);
const LIABILITY_SUBHEADER_IDS = new Set(['non_current_liabilities_header', 'current_liabilities_header']);

const toCurrentValue = (raw: BsRawValue): number => {
    if (raw == null) return 0;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    if (typeof raw === 'object' && 'currentYear' in raw) {
        const v = Number((raw as { currentYear?: number }).currentYear);
        return Number.isFinite(v) ? v : 0;
    }
    return 0;
};

export const findFinalReturnViolations = (
    bsStructure: BsStructureItem[],
    bsValues: Record<string, BsRawValue>
): FinalReturnViolation[] => {
    const violations: FinalReturnViolation[] = [];
    let section: 'asset' | 'equity' | 'liability' | null = null;

    for (const item of bsStructure || []) {
        if (item.type === 'header') {
            if (ASSETS_HEADER_IDS.has(item.id)) section = 'asset';
            else if (EQUITY_LIABILITIES_HEADER_IDS.has(item.id)) section = null;
            else section = null;
            continue;
        }
        if (item.type === 'subheader') {
            if (EQUITY_SUBHEADER_IDS.has(item.id)) section = 'equity';
            else if (LIABILITY_SUBHEADER_IDS.has(item.id)) section = 'liability';
            continue;
        }
        if (item.type !== 'item') continue;
        if (section !== 'asset' && section !== 'liability') continue;

        const currentYear = Math.round(toCurrentValue(bsValues?.[item.id]));
        if (Math.abs(currentYear) > 0) {
            violations.push({
                id: item.id,
                label: item.label,
                section,
                currentYear
            });
        }
    }

    return violations;
};
