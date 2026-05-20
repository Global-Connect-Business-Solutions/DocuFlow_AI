// Safe arithmetic evaluator for spreadsheet-style `=expr` cell values.
// Supports + - * / ( ) and decimal numbers. Rejects everything else.
// Returns a number rounded to 2 decimals, or throws on invalid input.

type Token =
    | { type: 'num'; value: number }
    | { type: 'op'; value: '+' | '-' | '*' | '/' }
    | { type: 'lparen' }
    | { type: 'rparen' };

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

const tokenize = (input: string): Token[] => {
    const tokens: Token[] = [];
    let i = 0;
    while (i < input.length) {
        const ch = input[i];
        if (ch === ' ' || ch === '\t') { i++; continue; }
        if (ch === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
        if (ch === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
        if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
            tokens.push({ type: 'op', value: ch });
            i++; continue;
        }
        if ((ch >= '0' && ch <= '9') || ch === '.') {
            let j = i;
            while (j < input.length && ((input[j] >= '0' && input[j] <= '9') || input[j] === '.')) j++;
            const numStr = input.slice(i, j);
            const num = Number(numStr);
            if (!Number.isFinite(num)) throw new Error(`Invalid number: ${numStr}`);
            tokens.push({ type: 'num', value: num });
            i = j;
            continue;
        }
        throw new Error(`Unexpected character: ${ch}`);
    }
    return tokens;
};

// Handle unary minus by converting "-x" at start or after op/lparen into "(0 - x)".
const normalizeUnary = (tokens: Token[]): Token[] => {
    const out: Token[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const tk = tokens[i];
        const prev = out[out.length - 1];
        const isUnary =
            tk.type === 'op' &&
            (tk.value === '-' || tk.value === '+') &&
            (!prev || prev.type === 'op' || prev.type === 'lparen');
        if (isUnary) {
            out.push({ type: 'num', value: 0 });
        }
        out.push(tk);
    }
    return out;
};

const toRPN = (tokens: Token[]): Token[] => {
    const output: Token[] = [];
    const ops: Token[] = [];
    for (const tk of tokens) {
        if (tk.type === 'num') {
            output.push(tk);
        } else if (tk.type === 'op') {
            while (ops.length) {
                const top = ops[ops.length - 1];
                if (top.type === 'op' && PRECEDENCE[top.value] >= PRECEDENCE[tk.value]) {
                    output.push(ops.pop()!);
                } else break;
            }
            ops.push(tk);
        } else if (tk.type === 'lparen') {
            ops.push(tk);
        } else if (tk.type === 'rparen') {
            while (ops.length && ops[ops.length - 1].type !== 'lparen') {
                output.push(ops.pop()!);
            }
            if (!ops.length) throw new Error('Mismatched parentheses');
            ops.pop();
        }
    }
    while (ops.length) {
        const top = ops.pop()!;
        if (top.type === 'lparen' || top.type === 'rparen') throw new Error('Mismatched parentheses');
        output.push(top);
    }
    return output;
};

const evalRPN = (rpn: Token[]): number => {
    const stack: number[] = [];
    for (const tk of rpn) {
        if (tk.type === 'num') {
            stack.push(tk.value);
        } else if (tk.type === 'op') {
            if (stack.length < 2) throw new Error('Invalid expression');
            const b = stack.pop()!;
            const a = stack.pop()!;
            switch (tk.value) {
                case '+': stack.push(a + b); break;
                case '-': stack.push(a - b); break;
                case '*': stack.push(a * b); break;
                case '/':
                    if (b === 0) throw new Error('Division by zero');
                    stack.push(a / b);
                    break;
            }
        }
    }
    if (stack.length !== 1) throw new Error('Invalid expression');
    return stack[0];
};

export const evaluateFormula = (raw: string): number => {
    const trimmed = raw.trim().replace(/^=/, '').trim();
    if (!trimmed) throw new Error('Empty expression');
    const tokens = normalizeUnary(tokenize(trimmed));
    const rpn = toRPN(tokens);
    const result = evalRPN(rpn);
    if (!Number.isFinite(result)) throw new Error('Non-finite result');
    return Math.round(result * 100) / 100;
};

export const isFormula = (raw: string): boolean => raw.trim().startsWith('=');
