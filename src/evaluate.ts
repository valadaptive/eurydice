import {BinaryOpType, UnaryOpType, Expression} from './parse';

type ExpressionResult = number | ExprFunc | ExpressionResult[];

type ExprFunc = (...args: ExpressionResult[]) => ExpressionResult;

const typecheckBuiltin = (inFunc: (n: number) => number): ExprFunc => {
    return (n: ExpressionResult): number => {
        if (typeof n !== 'number') throw new TypeError('Expected number');
        return inFunc(n);
    };
};

const builtins: Partial<Record<string, ExprFunc>> = {
    floor: typecheckBuiltin(Math.floor),
    ceil: typecheckBuiltin(Math.ceil),
    round: typecheckBuiltin(Math.round),
    abs: typecheckBuiltin(Math.abs),
    // You can specify a number (to roll a die from 1 to that number inclusive),
    // or an array of face values, possibly nested.
    // For instance, a d[1, [2, 3]] has a 50% chance of rolling a 1, 25% of rolling a 2, and 25% of rolling a 3.
    d: (n: ExpressionResult): number => {
        if (typeof n === 'number') return Math.floor(Math.random() * Math.round(n)) + 1;
        if (typeof n === 'object') {
            let currentArray: ExpressionResult[] = n;
            for (;;) {
                const choice = currentArray[Math.floor(Math.random() * currentArray.length)];
                if (typeof choice === 'number') return choice;
                if (typeof choice === 'object') {
                    currentArray = choice;
                    continue;
                }
                throw new Error('Expected number or array of numbers');
            }
        }
        throw new Error('Expected number or array of numbers');
    },
    dF: (): number => {
        return [-1, 0, 1][Math.floor(Math.random() * 3)];
    },
    sort: (arr: ExpressionResult): ExpressionResult[] => {
        const sorted = expectArrayOfNumbers(arr)
            .slice(0)
            .sort((a: ExpressionResult, b: ExpressionResult) => (a as number) - (b as number));
        return sorted;
    },
    len: (arr: ExpressionResult): number => {
        return expectArray(arr).length;
    }
};

// Deep equality check (for functions, arrays, and numbers).
const equals = (a: ExpressionResult, b: ExpressionResult): boolean => {
    if (typeof a !== typeof b) return false;
    if (typeof a === 'object' && typeof b === 'object') {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!equals(a[i], b[i])) return false;
        }
        return true;
    }
    return a === b;
};

const expectNumber = (input: ExpressionResult): number => {
    if (typeof input !== 'number') throw new TypeError('Expected number');
    return input;
};

const expectArray = (input: ExpressionResult): ExpressionResult[] => {
    if (typeof input !== 'object') throw new TypeError('Expected array');
    return input;
};

const expectArrayOfNumbers = (input: ExpressionResult): number[] => {
    input = expectArray(input);
    for (const elem of input) {
        expectNumber(elem);
    }
    return input as number[];
};

const mapN = (repeat: number, expr: Expression, variables?: Record<string, ExpressionResult>): ExpressionResult[] => {
    const results = [];
    for (let i = 0; i < repeat; i++) {
        let result = evaluate(expr, variables);
        // If it's a function, evaluate it.
        // TODO: is this desirable? Right now I've just done it to implement fudge dice.
        // This number-prefix stuff is already pretty automagic though.
        if (typeof result === 'function') result = result();
        results.push(result);
    }
    return results;
};

const keepHighest = (items: number[], n: number): number[] => {
    return items
        .slice(0)
        .sort((a, b) => a - b)
        .slice(items.length - n);
};

const keepLowest = (items: number[], n: number): number[] => {
    return items
        .slice(0)
        .sort((a, b) => b - a)
        .slice(items.length - n);
};

const evaluate = (expr: Expression, variables?: Record<string, ExpressionResult>): ExpressionResult => {
    switch (expr.type) {
        case 'number': return expr.value;
        case 'array': return expr.elements.map(elem => evaluate(elem, variables));
        case 'variable': {
            const varFromLookup = variables?.[expr.value];
            if (varFromLookup) return varFromLookup;
            const builtin = builtins[expr.value];
            if (builtin) return builtin;
            throw new Error(`Undefined variable: ${expr.value}`);
        }
        case 'binary': {
            let lhs = evaluate(expr.lhs, variables);
            if (expr.op === BinaryOpType.CONS) {
                switch (typeof lhs) {
                    // Eagerly evaluate right-hand side and pass into function
                    case 'function': return lhs(evaluate(expr.rhs, variables));
                    // Evaluate right-hand side n times
                    case 'number': return mapN(lhs, expr.rhs, variables);
                    case 'object': {
                        // The only allowed objects are arrays currently. Index into the array.
                        const rhs = Math.round(expectNumber(evaluate(expr.rhs, variables)));
                        if (rhs < 0 || rhs >= lhs.length) throw new Error(`Array index ${rhs} out of bounds`);
                        return lhs[rhs];
                    }
                }
            }
            let rhs = evaluate(expr.rhs, variables);
            switch (expr.op) {
                case BinaryOpType.ADD: {
                    // Concatenate arrays
                    if (typeof lhs === 'object' && typeof rhs === 'object') {
                        return [...lhs, ...rhs];
                    }
                    // Append to array
                    if (typeof lhs === 'object' && typeof rhs === 'number') {
                        return [...lhs, rhs];
                    }
                    // Prepend to array
                    if (typeof lhs === 'number' && typeof rhs === 'object') {
                        return [lhs, ...rhs];
                    }
                    // Add numbers
                    if (typeof lhs === 'number' && typeof rhs === 'number') {
                        return lhs + rhs;
                    }
                    throw new TypeError('Expected number or array');
                }
                case BinaryOpType.EQ: return Number(equals(lhs, rhs));
                case BinaryOpType.NE: return Number(!equals(lhs, rhs));
                case BinaryOpType.HIGHEST: return keepHighest(expectArrayOfNumbers(lhs), expectNumber(rhs));
                case BinaryOpType.LOWEST: return keepLowest(expectArrayOfNumbers(lhs), expectNumber(rhs));
            }
            lhs = expectNumber(lhs);
            rhs = expectNumber(rhs);
            switch (expr.op) {
                case BinaryOpType.SUBTRACT: return lhs - rhs;
                case BinaryOpType.MULTIPLY: return lhs * rhs;
                case BinaryOpType.DIVIDE: return lhs / rhs;
                case BinaryOpType.MODULO: return ((lhs % rhs) + rhs) % rhs;
                case BinaryOpType.POWER: return Math.pow(lhs, rhs);
                case BinaryOpType.LT: return Number(lhs < rhs);
                case BinaryOpType.LE: return Number(lhs <= rhs);
                case BinaryOpType.GT: return Number(lhs > rhs);
                case BinaryOpType.GE: return Number(lhs >= rhs);
                case BinaryOpType.OR: return Math.max(lhs, rhs);
                case BinaryOpType.AND: return Math.min(lhs, rhs);
            }
            break;
        }
        case 'unary': {
            const rhs = evaluate(expr.rhs, variables);
            switch (expr.op) {
                case UnaryOpType.POSITIVE: return expectNumber(rhs);
                case UnaryOpType.NEGATIVE: return -expectNumber(rhs);
                case UnaryOpType.NOT: return 1 - expectNumber(rhs);
                case UnaryOpType.SUM: return expectArray(rhs)
                    .reduce((prev: number, cur) => prev + expectNumber(cur), 0);
            }
            break;
        }
        case 'call': {
            const callee = evaluate(expr.callee, variables);
            if (typeof callee === 'number') {
                if (expr.arguments.length !== 1) throw new Error('Cannot call a number like a function');
                return mapN(callee, expr.arguments[0], variables);
            }
            if (typeof callee !== 'function') throw new TypeError('Expected function or number');
            return callee(...expr.arguments.map(arg => evaluate(arg, variables)));
        }
    }
};

export default evaluate;
