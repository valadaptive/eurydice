import {Expression} from './parse';
import printValue from './print';

type ExprFunc = (arg: Value) => void;
type Value = number | string | ExprFunc | Value[] | null;
type EnvValue = number | string | WrappedFunction | Value[] | null;

const truthy = (value: number): boolean => value > 0;

const MAX_REROLLS = 100;

const expectAny = (input: Value): Value => input;

const expectNull = (input: Value): null => {
    if (input !== null) throw new TypeError(`Expected null, got ${printValue(input)}`);
    return input;
};

const expectNumber = (input: Value): number => {
    if (typeof input !== 'number') throw new TypeError(`Expected number, got ${printValue(input)}`);
    return input;
};

const expectArray = (input: Value): Value[] => {
    if (typeof input !== 'object' || input === null) throw new TypeError(`Expected array, got ${printValue(input)}`);
    return input;
};

const expectFunction = (input: Value): ExprFunc => {
    if (typeof input !== 'function') throw new TypeError(`Expected function, got ${printValue(input)}`);
    return input;
};

const expectArrayOf = <T extends Value>(
    elemTypeCheck: (input: Value) => T): (input: Value) => T[] => {
    return (input: Value) => {
        input = expectArray(input);
        for (const elem of input) {
            elemTypeCheck(elem);
        }
        return input as T[];
    };
};

const expectArrayOfNumbers = expectArrayOf(expectNumber);

type Environment = {
    variables: Partial<Record<string, Value>>,
    parent: Environment | null
};
type StackFrame = {
    expr: Expression,
    environment: Environment
};
type Continuation = (result: Value) => void;
type WrappedFunction = (continuations: Continuation[]) => ExprFunc;
type ParamGuard<T extends Value> = ((input: Value) => T);

type WrappedArgs<Guards extends readonly ParamGuard<Value>[]> = {
    [i in keyof Guards]: Guards[i] extends ParamGuard<infer T> ? T : never
};

// TODO: this doesn't require the argument to be inferred as a tuple
type Wrapped<Guards extends readonly ParamGuard<Value>[]> =
    (...args: WrappedArgs<Guards>) => Value;

type WrappedWithReport<Guards extends readonly ParamGuard<Value>[]> =
    (report: (value: Value) => void,
        call: (input: ExprFunc, arg: Value, continuation: Continuation) => void,
        ...args: WrappedArgs<Guards>) => void;

const wrapFunction = <G extends readonly ParamGuard<Value>[]>(
    builtin: Wrapped<G>, paramGuards: G): WrappedFunction => {
    return continuations => {
        if (builtin.length !== paramGuards.length) throw new Error('Arity mismatch');
        if (builtin.length < 1) throw new Error(
            'Functions in Eurydice need at least one argument. ' +
            'Consider taking a null argument and discarding it.');
        const curried = (func: Wrapped<G>, guardIdx: number): (arg: Value) => void => {
            const typedFunc = func as unknown as (...args: Value[]) => Value;
            const guard = paramGuards[guardIdx];
            if (func.length <= 1) return arg => {
                const result = typedFunc(guard(arg));
                continuations.pop()!(result);
            };
            return arg => {
                const result = curried(
                    typedFunc.bind(null, guard(arg)) as unknown as Wrapped<G>,
                    guardIdx + 1);
                continuations.pop()!(result);
            };
        };
        return curried(builtin, 0);
    };
};

// TODO: try to deduplicate with wrapBuiltin?
const wrapDeferred = <G extends readonly ParamGuard<Value>[]>(
    unboundBuiltin: WrappedWithReport<G>, paramGuards: G): WrappedFunction => {
    return continuations => {
        const report = (result: Value): void => {
            continuations.pop()!(result);
        };
        const call = (input: ExprFunc, arg: Value, continuation: Continuation): void => {
            input(arg);
            continuations.push(continuation);
        };
        const builtin: Wrapped<G> = (unboundBuiltin as Function).bind(null, report, call) as Wrapped<G>;
        if (builtin.length !== paramGuards.length) throw new Error('Arity mismatch');
        if (builtin.length < 1) throw new Error(
            'Functions in Eurydice need at least one argument. ' +
            'Consider taking a null argument and discarding it.');
        const curried = (func: Wrapped<G>, guardIdx: number): (arg: Value) => void => {
            const typedFunc = func as unknown as (...args: Value[]) => void;
            const guard = paramGuards[guardIdx];
            if (func.length <= 1) return arg => {
                typedFunc(guard(arg));
            };
            return arg => {
                const result = curried(
                    typedFunc.bind(null, guard(arg)) as unknown as Wrapped<G>,
                    guardIdx + 1);
                continuations.pop()!(result);
            };
        };
        return curried(builtin, 0);
    };
};

const builtins: Record<string, WrappedFunction> = {
    /** Round a number down. */
    floor: wrapFunction(Math.floor, [expectNumber]),
    /** Round a number up. */
    ceil: wrapFunction(Math.ceil, [expectNumber]),
    /** Round a number to the nearest whole number. */
    round: wrapFunction(Math.round, [expectNumber]),
    /** Take the absolute value of a number. */
    abs: wrapFunction(Math.abs, [expectNumber]),
    /**
     * Roll a die.
     * You can specify a number (to roll a die from 1 to that number inclusive),
     * or an array of face values, possibly nested.
     * For instance, a d[1, [2, 3]] has a 50% chance of rolling a 1, 25% of rolling a 2, and 25% of rolling a 3.
     */
    d: wrapFunction((n: Value): number | string => {
        if (typeof n === 'number') return Math.floor(Math.random() * Math.round(n)) + 1;
        if (typeof n === 'object' && n !== null) {
            let currentArray: Value[] = n;
            for (;;) {
                const choice = currentArray[Math.floor(Math.random() * currentArray.length)];
                if (typeof choice === 'number' || typeof choice === 'string') return choice;
                if (typeof choice === 'object' && choice !== null) {
                    currentArray = choice;
                    continue;
                }
                throw new Error('Expected number or array of numbers');
            }
        }
        throw new Error('Expected number or array of numbers');
    }, [expectAny]),
    /** Roll a FATE/FUDGE die (-1, 0, or 1). */
    dF: wrapFunction((_: null): number => [-1, 0, 1][Math.floor(Math.random() * 3)], [expectNull]),
    /** Sort an array from lowest to highest. */
    sort: wrapFunction((arr: number[]): Value[] => arr
        .slice(0)
        .sort((a: Value, b: Value) => (a as number) - (b as number)),
    [expectArrayOfNumbers]),
    /** Get the length of an array or string. */
    len: wrapFunction((value: Value): number => {
        if ((typeof value === 'object' && value !== null) || typeof value === 'string') return value.length;
        throw new Error('Expected array or string');
    }, [expectAny]),
    map: wrapDeferred((report, call, arr: Value[], mapper: ExprFunc): void => {
        const results: Value[] = [];
        let i = 0;
        const evalNext = (): void => {
            call(mapper, arr[i], mappedValue => {
                results.push(mappedValue);
                i++;
                if (i === arr.length) {
                    report(results);
                } else {
                    evalNext();
                }
            });
        };
        if (arr.length > 0) {
            evalNext();
        } else {
            report([]);
        }
    }, [expectArray, expectFunction] as const),
    reduce: wrapDeferred((
        report, call, arr: Value[], reducer: ExprFunc, initialValue: Value): void => {
        let i = 0;
        let prev = initialValue;
        const evalNext = (): void => {
            if (i === arr.length) {
                report(prev);
                return;
            }
            call(reducer, prev, innerReducer => {
                const innerReducerFunc = expectFunction(innerReducer);
                call(innerReducerFunc, arr[i], result => {
                    prev = result;
                    i++;
                    evalNext();
                });
            });
        };
        evalNext();
    }, [expectArray, expectFunction, expectAny] as const),
    reroll: wrapDeferred((report, call, roll, cond) => {
        let i = 0;
        const evalNext = (): void => {
            call(roll, null, rollResult => {
                call(cond, rollResult, condResult => {
                    i++;
                    // TODO: Match roll20 and reroll when this is falsy
                    if (truthy(expectNumber(condResult)) || i > MAX_REROLLS) {
                        report(rollResult);
                    } else {
                        evalNext();
                    }
                });
            });
        };
        evalNext();
    }, [expectFunction, expectFunction]),
    /**
     * Exploding dice!
     * Roll n dice, and every time one comes up truthy (according to the third argument), you can reroll it.
     * If that reroll comes up truthy again, keep rerolling. */
    explode: wrapDeferred((report, call, numRolls, roll, cond) => {
        const rolls: Value[] = [];
        let i = 0;
        const evalNext = (): void => {
            call(roll, null, rollResult => {
                rolls.push(rollResult);
                call(cond, rollResult, condResult => {
                    if (truthy(expectNumber(condResult))) {
                        evalNext();
                    } else {
                        i++;
                        if (i === numRolls) {
                            report(rolls);
                        } else {
                            evalNext();
                        }
                    }
                });
            });
        };
        evalNext();
    }, [expectNumber, expectFunction, expectFunction] as const),
    /** Drop elements in the given array by passing them to a function that returns which elements should be dropped. */
    drop: wrapDeferred((report, call, dropFunc, rollsArr) => {
        call(dropFunc, rollsArr, dropResult => {
            // Count number of occurrences of each element to drop
            const elementsToDrop = expectArrayOfNumbers(dropResult);
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
            report(results);
        });
    }, [expectFunction, expectArrayOfNumbers] as const),
    highest: wrapFunction((n: number, rolls: number[]) =>
        keepHighest(rolls, n), [expectNumber, expectArrayOfNumbers] as const),
    lowest: wrapFunction((n: number, rolls: number[]) =>
        keepLowest(rolls, n), [expectNumber, expectArrayOfNumbers] as const),
    min: wrapFunction((nums: number[]): number => Math.min(...nums), [expectArrayOfNumbers]),
    max: wrapFunction((nums: number[]): number => Math.max(...nums), [expectArrayOfNumbers]),

    '+': wrapFunction((lhs: Value, rhs: Value) => {
        // Concatenate arrays
        if (typeof lhs === 'object' && typeof rhs === 'object' && lhs !== null && rhs !== null) {
            return [...lhs, ...rhs];
        }
        // Append to array
        if (typeof lhs === 'object' && (typeof rhs !== 'object' || rhs === null) && lhs !== null) {
            return [...lhs, rhs];
        }
        // Prepend to array
        if ((typeof lhs !== 'object' || lhs === null) && typeof rhs === 'object' && rhs !== null) {
            return [lhs, ...rhs];
        }
        // Add numbers
        if (typeof lhs === 'number' && typeof rhs === 'number') {
            return lhs + rhs;
        }
        // Concatenate strings (in a separate if block so TypeScript is okay with it)
        if (typeof lhs === 'string' && typeof rhs === 'string') {
            return lhs + rhs;
        }
        throw new TypeError('Expected number, string, or array');
    }, [expectAny, expectAny]),
    '-': wrapFunction((lhs: number, rhs: number): number => lhs - rhs, [expectNumber, expectNumber]),
    '*': wrapFunction((lhs: number, rhs: number): number => lhs * rhs, [expectNumber, expectNumber]),
    '/': wrapFunction((lhs: number, rhs: number): number => lhs / rhs, [expectNumber, expectNumber]),
    '%': wrapFunction((lhs: number, rhs: number): number =>
        ((lhs % rhs) + rhs) % rhs,
    [expectNumber, expectNumber]),
    '**': wrapFunction((lhs: number, rhs: number): number => Math.pow(lhs, rhs), [expectNumber, expectNumber]),
    '<': wrapFunction((lhs: number, rhs: number): number => Number(lhs < rhs), [expectNumber, expectNumber]),
    '<=': wrapFunction((lhs: number, rhs: number): number => Number(lhs <= rhs), [expectNumber, expectNumber]),
    '>': wrapFunction((lhs: number, rhs: number): number => Number(lhs > rhs), [expectNumber, expectNumber]),
    '>=': wrapFunction((lhs: number, rhs: number): number => Number(lhs >= rhs), [expectNumber, expectNumber]),
    '=': wrapFunction((lhs: Value, rhs: Value): number =>
        Number(equals(lhs, rhs)),
    [expectAny, expectAny]),
    '!=': wrapFunction((lhs: Value, rhs: Value): number =>
        Number(!equals(lhs, rhs)),
    [expectNumber, expectNumber]),
    '|': wrapFunction((lhs: number, rhs: number): number => Math.max(lhs, rhs), [expectNumber, expectNumber]),
    '&': wrapFunction((lhs: number, rhs: number): number => Math.min(lhs, rhs), [expectNumber, expectNumber]),
    '!': wrapFunction((rhs: number) => 1 - rhs, [expectNumber]),
    '...': wrapFunction((values: number[]) =>
        values.reduce((prev, cur) => prev + cur, 0),
    [expectArrayOfNumbers]),
    negate: wrapFunction((rhs: number): number => -rhs, [expectNumber])
};

// Deep equality check (for functions, arrays, and numbers).
const equals = (a: Value, b: Value): boolean => {
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

const EMPTY_ENV = Object.create(null) as Partial<Record<string, Value>>;

class EvaluationError extends Error {
    expr: Expression;

    constructor (message: string, expr: Expression) {
        super(message);
        this.expr = expr;
    }
}

const evaluate = (expr: Expression, environment?: Partial<Record<string, EnvValue>>): Value => {
    let finalResult: Value;
    const continuations: Continuation[] = [(result): void => {
        finalResult = result;
    }];
    const rootEnvironment: Environment = {
        variables: Object.create(null) as Partial<Record<string, Value>>,
        parent: null
    };
    for (const [builtinName, wrapper] of Object.entries(builtins)) {
        rootEnvironment.variables[builtinName] = wrapper(continuations);
    }
    if (environment) {
        for (const [varName, value] of Object.entries(environment)) {
            if (typeof value === 'function') {
                rootEnvironment.variables[varName] = value(continuations);
            } else {
                rootEnvironment.variables[varName] = value;
            }
        }
    }
    let next: StackFrame | null = {expr, environment: rootEnvironment};
    let currentExpr: Expression = expr;
    try {
        while (next !== null) {
            const {expr, environment}: StackFrame = next;
            next = null;
            currentExpr = expr;
            switch (expr.type) {
                case 'unit': {
                    continuations.pop()!(null);
                    break;
                }
                case 'number':
                case 'string': {
                    continuations.pop()!(expr.value);
                    break;
                }
                case 'array': {
                    const evaluatedElements: Value[] = [];
                    let elemIndex = 0;
                    const evalNext = (): void => {
                        if (elemIndex === expr.elements.length) {
                            continuations.pop()!(evaluatedElements);
                            return;
                        }
                        next = {expr: expr.elements[elemIndex], environment};
                        continuations.push(elem => {
                            evaluatedElements.push(elem);
                            elemIndex++;
                            evalNext();
                        });
                    };
                    evalNext();
                    break;
                }
                case 'variable': {
                    let currentEnv: Environment | null = environment;
                    let varValue;
                    while (typeof varValue === 'undefined' && currentEnv !== null) {
                        varValue = currentEnv.variables[expr.value];
                        currentEnv = currentEnv.parent;
                    }
                    if (typeof varValue === 'undefined') {
                        throw new Error(`Undefined variable: ${expr.value}`);
                    }
                    continuations.pop()!(varValue);
                    break;
                }
                case 'apply': {
                    next = {expr: expr.lhs, environment};
                    continuations.push(lhs => {
                        switch (typeof lhs) {
                            // Eagerly evaluate right-hand side and pass into function
                            case 'function': {
                                next = {expr: expr.rhs, environment};
                                continuations.push(rhs => {
                                    lhs(rhs);
                                });
                                break;
                            }
                            // Evaluate right-hand side n times
                            case 'number': {
                                const evaluatedElements: Value[] = [];
                                let numRemaining = lhs;
                                const evalNext = (): void => {
                                    if (numRemaining <= 0) {
                                        continuations.pop()!(evaluatedElements);
                                        return;
                                    }
                                    next = {expr: expr.rhs, environment};
                                    continuations.push(elem => {
                                        evaluatedElements.push(elem);
                                        numRemaining--;
                                        evalNext();
                                    });
                                };
                                evalNext();
                                break;
                            }
                            case 'object': {
                                const arr = expectArray(lhs);

                                next = {expr: expr.rhs, environment};
                                continuations.push(rhs => {
                                    rhs = Math.round(expectNumber(rhs));
                                    if (rhs < 0 || rhs >= arr.length) throw new Error(`Array index ${rhs} out of bounds`);
                                    continuations.pop()!(arr[rhs]);
                                });
                            }
                        }
                    });
                    break;
                }
                case 'defun': {
                    const argName = expr.argument;
                    continuations.pop()!((argValue: Value): void => {
                        // Bind the function argument name to its evaluated value
                        const newVars = Object.create(null) as Partial<Record<string, Value>>;
                        newVars[argName] = argValue;
                        next = {
                            expr: expr.body,
                            environment: {
                                variables: newVars,
                                parent: environment
                            }
                        };
                    });
                    break;
                }
                case 'let': {
                    const newVars = Object.create(null) as Partial<Record<string, Value>>;
                    // Construct a new environment which will eventually hold the new variables.
                    // We only define its variables once they're all evaluated, so e.g "let x 5 and y x + 1" won't work.
                    // This is to avoid accidentally introducing sequential dependencies.
                    const newEnv: Environment = {
                        variables: EMPTY_ENV,
                        parent: environment
                    };
                    // Evaluate the values of the "let" expression
                    const evalNext = (i: number): void => {
                        next = {expr: expr.variables[i].value, environment: newEnv};
                        continuations.push(varValue => {
                            // Add the variable's evaluated value to the environment's (eventual) new variables
                            newVars[expr.variables[i].name] = varValue;
                            if (i === expr.variables.length - 1) {
                                // Fill in the variable values in the environment with what we've evaluated
                                newEnv.variables = newVars;
                                next = {expr: expr.body, environment: newEnv};
                            } else {
                                evalNext(i + 1);
                            }
                        });
                    };
                    evalNext(0);
                    break;
                }
                case 'if': {
                    next = {expr: expr.condition, environment};
                    continuations.push(condValue => {
                        next = {
                            expr: truthy(expectNumber(condValue)) ? expr.trueBranch : expr.falseBranch,
                            environment
                        };
                    });
                }
            }
        }
    } catch (err) {
        throw new EvaluationError((err as Error).message, currentExpr);
    }
    return finalResult!;
};

export default evaluate;
export {
    EvaluationError,

    wrapFunction,
    wrapDeferred,

    expectAny,
    expectArray,
    expectArrayOf,
    expectFunction,
    expectNull,
    expectNumber
};
export type {Value, EnvValue, WrappedFunction};
