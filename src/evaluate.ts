import {BinaryOpType, UnaryOpType, Expression} from './parse';

type ExpressionResult = number | ExprFunc | ExpressionResult[];

type ExprFunc = (...args: ExpressionResult[]) => ExpressionResult;

const truthy = (value: number): boolean => value > 0;

const MAX_REROLLS = 100;

const builtins: Partial<Record<string, ExprFunc>> = {
    /** Round a number down. */
    floor: n => Math.floor(expectNumber(n)),
    /** Round a number up. */
    ceil: n => Math.ceil(expectNumber(n)),
    /** Round a number to the nearest whole number. */
    round: n => Math.round(expectNumber(n)),
    /** Take the absolute value of a number. */
    abs: n => Math.abs(expectNumber(n)),
    /**
     * Roll a die.
     * You can specify a number (to roll a die from 1 to that number inclusive),
     * or an array of face values, possibly nested.
     * For instance, a d[1, [2, 3]] has a 50% chance of rolling a 1, 25% of rolling a 2, and 25% of rolling a 3.
     */
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
    /** Roll a FATE/FUDGE die (-1, 0, or 1). */
    dF: (): number => {
        return [-1, 0, 1][Math.floor(Math.random() * 3)];
    },
    /** Sort an array from lowest to highest. */
    sort: (arr: ExpressionResult): ExpressionResult[] => {
        const sorted = expectArrayOfNumbers(arr)
            .slice(0)
            .sort((a: ExpressionResult, b: ExpressionResult) => (a as number) - (b as number));
        return sorted;
    },
    /** Get the length of an array. */
    len: (arr: ExpressionResult): number => {
        return expectArray(arr).length;
    },
    /** Run a "reducer" function over an array. */
    reduce: (arr: ExpressionResult, reducer: ExpressionResult, initialValue: ExpressionResult): ExpressionResult => {
        const reducerFunc = expectFunction(reducer);
        return expectArray(arr).reduce(
            (prev: ExpressionResult, cur: ExpressionResult) => reducerFunc(prev, cur), initialValue);
    },
    /** Reroll a die (using the first argument function) until the second argument function returns a truthy value. */
    reroll: (rollFunc: ExpressionResult, condFunc: ExpressionResult): number => {
        rollFunc = expectFunction(rollFunc);
        condFunc = expectFunction(condFunc);
        for (let i = 0; i < MAX_REROLLS; i++) {
            const roll = expectNumber(rollFunc());
            const isGood = truthy(expectNumber(condFunc(roll)));
            if (isGood) return roll;
        }
        throw new Error('Maximum rerolls exceeded');
    },
    /**
     * Exploding dice!
     * Roll n dice, and every time one comes up truthy (according to the third argument), you can reroll it.
     * If that reroll comes up truthy again, keep rerolling. */
    explode: (numRolls: ExpressionResult, rollFunc: ExpressionResult, condFunc: ExpressionResult): number[] => {
        numRolls = expectNumber(numRolls);
        rollFunc = expectFunction(rollFunc);
        condFunc = expectFunction(condFunc);
        const rolls = [];
        for (let i = 0; i < numRolls; i++) {
            let roll = expectNumber(rollFunc());
            rolls.push(roll);
            while (truthy(expectNumber(condFunc(roll)))) {
                roll = expectNumber(rollFunc());
                rolls.push(roll);
            }
        }
        return rolls;
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
    if (typeof input !== 'number') throw new TypeError(`Expected number, got ${typeof input}`);
    return input;
};

const expectArray = (input: ExpressionResult): ExpressionResult[] => {
    if (typeof input !== 'object') throw new TypeError(`Expected array, got ${typeof input}`);
    return input;
};

const expectFunction = (input: ExpressionResult): ExprFunc => {
    if (typeof input !== 'function') throw new TypeError(`Expected function, got ${typeof input}`);
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
            if (typeof varFromLookup !== 'undefined') return varFromLookup;
            const builtin = builtins[expr.value];
            if (typeof builtin !== 'undefined') return builtin;
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
        case 'defun': {
            return (...args: ExpressionResult[]): ExpressionResult => {
                // console.log(args, expr.arguments);
                if (args.length !== expr.arguments.length) {
                    throw new TypeError(`Function expected ${expr.arguments.length} arguments, got ${args.length}`);
                }
                const combinedVars = Object.assign({}, variables);
                for (let i = 0; i < args.length; i++) {
                    combinedVars[expr.arguments[i].value] = args[i];
                }
                return evaluate(expr.body, combinedVars);
            };
        }
    }
};

export default evaluate;
