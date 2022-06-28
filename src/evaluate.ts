import {UnaryOpType, Expression} from './parse';

type ExprFunc = (arg: ExpressionResult) => ExpressionResult;
type ExpressionResult = number | ExprFunc | ExpressionResult[] | null;

type BuiltinFunc = (...args: ExpressionResult[]) => ExpressionResult;

const truthy = (value: number): boolean => value > 0;

const MAX_REROLLS = 100;

const builtins: Partial<Record<string, BuiltinFunc>> = {
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
        if (typeof n === 'object' && n !== null) {
            let currentArray: ExpressionResult[] = n;
            for (;;) {
                const choice = currentArray[Math.floor(Math.random() * currentArray.length)];
                if (typeof choice === 'number') return choice;
                if (typeof choice === 'object' && choice !== null) {
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
    /** Map each array element over a function */
    map: (arr: ExpressionResult, mapper: ExpressionResult) => {
        arr = expectArray(arr);
        const mapperFunc = expectFunction(mapper);
        return arr.map(v => mapperFunc(v));
    },
    /** Run a "reducer" function over an array. */
    reduce: (arr: ExpressionResult, reducer: ExpressionResult, initialValue: ExpressionResult): ExpressionResult => {
        const reducerFunc = expectFunction(reducer);
        return expectArray(arr).reduce(
            (prev: ExpressionResult, cur: ExpressionResult) => expectFunction(reducerFunc(prev))(cur), initialValue);
    },
    /** Reroll a die (using the first argument function) until the second argument function returns a truthy value. */
    reroll: (rollFunc: ExpressionResult, condFunc: ExpressionResult): number => {
        rollFunc = expectFunction(rollFunc);
        condFunc = expectFunction(condFunc);
        for (let i = 0; i < MAX_REROLLS; i++) {
            const roll = expectNumber(rollFunc(null));
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
            let roll = expectNumber(rollFunc(null));
            rolls.push(roll);
            while (truthy(expectNumber(condFunc(roll)))) {
                roll = expectNumber(rollFunc(null));
                rolls.push(roll);
            }
        }
        return rolls;
    },
    /** Drop elements in the given array by passing them to a function that returns which elements should be dropped. */
    drop: (drop: ExpressionResult, rolls: ExpressionResult): number[] => {
        const rollsArr = expectArrayOfNumbers(rolls);
        const dropFunc = expectFunction(drop);

        // Count number of occurrences of each element to drop
        const elementsToDrop = expectArrayOfNumbers(dropFunc(rollsArr));
        const elemCounts = new Map<number, number>();
        for (const elem of elementsToDrop) {
            elemCounts.set(elem, (elemCounts.get(elem) ?? 0) + 1);
        }

        // Drop first n occurrences of those elements then start appending them into the results array
        const results = [];
        for (const roll of rollsArr) {
            // Roll exists in count of elements to drop and is greater than 0
            const rollCount = elemCounts.get(roll);
            if (rollCount) {
                elemCounts.set(roll, rollCount - 1);
                continue;
            }

            // Roll is either not in map of elements to drop or its remaining drop count is 0
            results.push(roll);
        }

        return results;
    },
    highest: (n: ExpressionResult): ExprFunc => {
        const numToKeep = expectNumber(n);
        return (rolls: ExpressionResult) => keepHighest(expectArrayOfNumbers(rolls), numToKeep);
    },
    lowest: (n: ExpressionResult): ExprFunc => {
        const numToKeep = expectNumber(n);
        return (rolls: ExpressionResult) => keepLowest(expectArrayOfNumbers(rolls), numToKeep);
    },

    '+': (lhs: ExpressionResult): ExprFunc => (rhs: ExpressionResult) => {
        // Concatenate arrays
        if (typeof lhs === 'object' && typeof rhs === 'object' && lhs !== null && rhs !== null) {
            return [...lhs, ...rhs];
        }
        // Append to array
        if (typeof lhs === 'object' && typeof rhs === 'number' && lhs !== null) {
            return [...lhs, rhs];
        }
        // Prepend to array
        if (typeof lhs === 'number' && typeof rhs === 'object' && rhs !== null) {
            return [lhs, ...rhs];
        }
        // Add numbers
        if (typeof lhs === 'number' && typeof rhs === 'number') {
            return lhs + rhs;
        }
        throw new TypeError('Expected number or array');
    },
    '-': (lhs: ExpressionResult): ExprFunc => {
        const lhsNum = expectNumber(lhs);
        return (rhs: ExpressionResult) => lhsNum - expectNumber(rhs);
    },
    '*': (lhs: ExpressionResult): ExprFunc => {
        const lhsNum = expectNumber(lhs);
        return (rhs: ExpressionResult) => lhsNum * expectNumber(rhs);
    },
    '/': (lhs: ExpressionResult): ExprFunc => {
        const lhsNum = expectNumber(lhs);
        return (rhs: ExpressionResult) => lhsNum / expectNumber(rhs);
    },
    '%': (lhs: ExpressionResult): ExprFunc => {
        const lhsNum = expectNumber(lhs);
        return (rhs: ExpressionResult) => {
            const rhsNum = expectNumber(rhs);
            return ((lhsNum % rhsNum) + rhsNum) % rhsNum;
        };
    },
    '**': (lhs: ExpressionResult): ExprFunc => {
        const lhsNum = expectNumber(lhs);
        return (rhs: ExpressionResult) => Math.pow(lhsNum, expectNumber(rhs));
    },
    '<': (lhs: ExpressionResult): ExprFunc => {
        const lhsNum = expectNumber(lhs);
        return (rhs: ExpressionResult) => Number(lhsNum < expectNumber(rhs));
    },
    '<=': (lhs: ExpressionResult): ExprFunc => {
        const lhsNum = expectNumber(lhs);
        return (rhs: ExpressionResult) => Number(lhsNum <= expectNumber(rhs));
    },
    '>': (lhs: ExpressionResult): ExprFunc => {
        const lhsNum = expectNumber(lhs);
        return (rhs: ExpressionResult) => Number(lhsNum > expectNumber(rhs));
    },
    '>=': (lhs: ExpressionResult): ExprFunc => {
        const lhsNum = expectNumber(lhs);
        return (rhs: ExpressionResult) => Number(lhsNum >= expectNumber(rhs));
    },
    '=': (lhs: ExpressionResult): ExprFunc => (rhs: ExpressionResult) => Number(equals(lhs, rhs)),
    '!=': (lhs: ExpressionResult): ExprFunc => (rhs: ExpressionResult) => Number(!equals(lhs, rhs)),
    '|': (lhs: ExpressionResult): ExprFunc => {
        const lhsNum = expectNumber(lhs);
        return (rhs: ExpressionResult) => Math.max(lhsNum, expectNumber(rhs));
    },
    '&': (lhs: ExpressionResult): ExprFunc => {
        const lhsNum = expectNumber(lhs);
        return (rhs: ExpressionResult) => Math.min(lhsNum, expectNumber(rhs));
    }
};

// TODO: the performance here could probably be improved
const curry = (f: BuiltinFunc): ExprFunc => {
    const arity = f.length;
    if (arity <= 1) return f as ExprFunc;
    return (arg: ExpressionResult) => curry(f.bind(null, arg));
};

// Deep equality check (for functions, arrays, and numbers).
const equals = (a: ExpressionResult, b: ExpressionResult): boolean => {
    if (typeof a !== typeof b) return false;
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!equals(a[i], b[i])) return false;
        }
        return true;
    }
    return a === b;
};

const expectNumber = (input: ExpressionResult): number => {
    if (typeof input !== 'number') throw new TypeError(`Expected number, got ${String(input)}`);
    return input;
};

const expectArray = (input: ExpressionResult): ExpressionResult[] => {
    if (typeof input !== 'object' || input === null) throw new TypeError(`Expected array, got ${String(input)}`);
    return input;
};

const expectFunction = (input: ExpressionResult): ExprFunc => {
    if (typeof input !== 'function') throw new TypeError(`Expected function, got ${String(input)}`);
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
        if (typeof result === 'function') result = result(null);
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
            if (typeof builtin !== 'undefined') return curry(builtin);
            throw new Error(`Undefined variable: ${expr.value}`);
        }
        case 'apply': {
            const lhs = evaluate(expr.lhs, variables);
            switch (typeof lhs) {
                // Eagerly evaluate right-hand side and pass into function
                case 'function': return lhs(evaluate(expr.rhs, variables));
                // Evaluate right-hand side n times
                case 'number': return mapN(lhs, expr.rhs, variables);
                case 'object': {
                    const arr = expectArray(lhs);
                    const rhs = Math.round(expectNumber(evaluate(expr.rhs, variables)));
                    if (rhs < 0 || rhs >= arr.length) throw new Error(`Array index ${rhs} out of bounds`);
                    return arr[rhs];
                }
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
        case 'defun': {
            return (arg: ExpressionResult): ExpressionResult => {
                const combinedVars = Object.assign({[expr.argument.value]: arg}, variables);
                return evaluate(expr.body, combinedVars);
            };
        }
    }
};

export default evaluate;
