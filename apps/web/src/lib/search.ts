import type { Product } from '@/types';

// ---- 1. normalizeText ----
export function normalizeText(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase();
}

// ---- 2. parseMoney ----
export function parseMoney(raw: string): number | null {
    const trimmed = raw.trim();
    const match = trimmed.match(/^([\d.,]+)\s*(k|nghin|ngan)?$/i);
    if (!match) return null;

    const numPart = match[1];
    const unit = match[2]?.toLowerCase();

    // "30.000k" — có cả dấu phân cách VÀ đơn vị cùng lúc → không hợp lệ
    if (unit && /[.,]/.test(numPart)) return null;

    const digitsOnly = numPart.replace(/[.,]/g, '');
    if (!digitsOnly) return null;

    const value = parseInt(digitsOnly, 10);
    if (isNaN(value)) return null;

    return unit ? value * 1000 : value;
}

// ---- 3. Types giữ nguyên semantics của operator ----
export interface PriceBound {
    value: number;
    inclusive: boolean;
}
export interface PriceCondition {
    min?: PriceBound;
    max?: PriceBound;
    exact?: number;
}

// ---- 4. Regex patterns ----
const MONEY_TOKEN = '([\\d.,]+\\s*(?:k|nghin|ngan)?)\\b';
const GIA_PREFIX = '(?:gia\\s*)?';

const RANGE_PATTERN = new RegExp(
    `${GIA_PREFIX}(?:tu\\s*)?${MONEY_TOKEN}\\s*(?:den|toi|-)\\s*${MONEY_TOKEN}`,
    'i',
);

// Thứ tự các alternative quan trọng:
//  - gte phải trước gt để ">=" không bị ">" ăn mất dấu "="
//  - lte phải trước lt để "<=" không bị "<" ăn mất dấu "="
const OPERATORS = {
    gte: '>=|\\btu\\b',
    gt: '>|\\btren\\b|\\blon\\s+hon\\b|\\bcao\\s+hon\\b',
    lte: '<=',
    lt: '<|\\bduoi\\b|\\bthap\\s+hon\\b|\\bnho\\s+hon\\b',
    eq: '=|\\bbang\\b',
} as const;

function buildExtractor(opPattern: string): RegExp {
    return new RegExp(`${GIA_PREFIX}(?:${opPattern})\\s*${MONEY_TOKEN}`, 'i');
}

// ---- 5. spliceOut ----
function spliceOut(text: string, start: number, length: number): string {
    const end = start + length;
    return (text.slice(0, start) + ' ' + text.slice(end)).replace(/\s+/g, ' ').trim();
}

// ---- 6. extractRange ----
function extractRange(text: string) {
    const m = RANGE_PATTERN.exec(text);
    if (!m) return null;
    const min = parseMoney(m[1]);
    const max = parseMoney(m[2]);
    if (min === null || max === null) return null;
    return { min, max, rest: spliceOut(text, m.index, m[0].length) };
}

// ---- 7. extractClause ----
function extractClause(text: string, re: RegExp) {
    const m = re.exec(text);
    if (!m) return { value: undefined as number | undefined, rest: text };
    const value = parseMoney(m[1]);
    if (value === null) return { value: undefined, rest: text };
    return { value, rest: spliceOut(text, m.index, m[0].length) };
}

// ---- 8. parsePriceCondition ----
export function parsePriceCondition(
    text: string,
): { condition?: PriceCondition; rest: string } {
    const range = extractRange(text);
    if (range) {
        return {
            condition: {
                min: { value: range.min, inclusive: true },
                max: { value: range.max, inclusive: true },
            },
            rest: range.rest,
        };
    }

    const condition: PriceCondition = {};
    let rest = text;
    let matchedAny = false;

    const gte = extractClause(rest, buildExtractor(OPERATORS.gte));
    if (gte.value !== undefined) {
        condition.min = { value: gte.value, inclusive: true };
        rest = gte.rest;
        matchedAny = true;
    }

    const gt = extractClause(rest, buildExtractor(OPERATORS.gt));
    if (gt.value !== undefined) {
        condition.min = { value: gt.value, inclusive: false };
        rest = gt.rest;
        matchedAny = true;
    }

    const lte = extractClause(rest, buildExtractor(OPERATORS.lte));
    if (lte.value !== undefined) {
        condition.max = { value: lte.value, inclusive: true };
        rest = lte.rest;
        matchedAny = true;
    }

    const lt = extractClause(rest, buildExtractor(OPERATORS.lt));
    if (lt.value !== undefined) {
        condition.max = { value: lt.value, inclusive: false };
        rest = lt.rest;
        matchedAny = true;
    }

    const eq = extractClause(rest, buildExtractor(OPERATORS.eq));
    if (eq.value !== undefined) {
        condition.exact = eq.value;
        rest = eq.rest;
        matchedAny = true;
    }

    // Fallback: query chỉ là 1 con số trần → exact price
    if (!matchedAny) {
        const bare = rest.trim().match(/^[\d.,]+\s*(?:k|nghin|ngan)?$/i);
        if (bare) {
            const value = parseMoney(bare[0]);
            if (value !== null) {
                condition.exact = value;
                rest = '';
                matchedAny = true;
            }
        }
    }

    return { condition: matchedAny ? condition : undefined, rest };
}

// ---- 9. parseSearchTerms ----
export function parseSearchTerms(text: string): string[][] {
    return text
        .split(/,|\bva\b|\bhoac\b/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part.split(/\s+/).filter(Boolean));
}

// ---- 10. parseSearchQuery ----
export interface ParsedSearch {
    price?: PriceCondition;
    orTerms: string[][];
}

export function parseSearchQuery(raw: string): ParsedSearch {
    const normalized = normalizeText(raw);
    const { condition, rest } = parsePriceCondition(normalized);
    return { price: condition, orTerms: parseSearchTerms(rest) };
}

// ---- 11. Robust price coercion (ĐIỂM FIX CHÍNH) ----
// Backend có thể trả price dưới dạng:
//   - number:           29000
//   - string số sạch:   "29000"
//   - string có dấu:    "29,000" / "29.000" / "29 000" / "29,000đ" / "29.000 VNĐ"
// Tất cả đều phải coerce về 29000. Trước đây dùng Number() nên "29,000" → NaN
// → mọi price condition fail → search trả rỗng.
function toNumericPrice(raw: unknown): number {
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
        const cleaned = raw.replace(/[^\d]/g, '');
        return cleaned ? parseInt(cleaned, 10) : NaN;
    }
    return NaN;
}

function matchesPrice(rawPrice: unknown, condition?: PriceCondition): boolean {
    if (!condition) return true;

    const price = toNumericPrice(rawPrice);
    if (isNaN(price)) return false;

    if (condition.exact !== undefined && price !== condition.exact) return false;

    if (condition.min) {
        const ok = condition.min.inclusive
            ? price >= condition.min.value
            : price > condition.min.value;
        if (!ok) return false;
    }

    if (condition.max) {
        const ok = condition.max.inclusive
            ? price <= condition.max.value
            : price < condition.max.value;
        if (!ok) return false;
    }

    return true;
}

// ---- 12. matchesProduct ----
export function matchesProduct(product: Product, parsed: ParsedSearch): boolean {
    if (!matchesPrice(product.price, parsed.price)) return false;
    if (parsed.orTerms.length === 0) return true;

    const haystack = normalizeText(`${product.name} ${product.category ?? ''}`);
    return parsed.orTerms.some((tokens) =>
        tokens.every((t) => haystack.includes(t)),
    );
}