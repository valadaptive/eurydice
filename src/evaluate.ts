import {Expression} from './parse';

type ExprFunc = (arg: ExpressionResult) => void;
type ExpressionResult = number | ExprFunc | ExpressionResult[] | null;

const truthy = (value: number): boolean => value > 0;

const MAX_REROLLS = 100;

const expectAny = (input: ExpressionResult): ExpressionResult => input;

const expectNull = (input: ExpressionResult): null => {
    if (input !== null) throw new TypeError(`Expected null, got ${String(input)}`);
    return input;
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

const expectArrayOf = <T extends ExpressionResult>(
    elemTypeCheck: (input: ExpressionResult) => T): (input: ExpressionResult) => T[] => {
    return (input: ExpressionResult) => {
        input = expectArray(input);
        for (const elem of input) {
            elemTypeCheck(elem);
        }
        return input as T[];
    };
};

const expectArrayOfNumbers = expectArrayOf(expectNumber);

type Continuation = (result: ExpressionResult) => void;
type WrappedBuiltin = (stack: Expression[], continuations: Continuation[]) => ExprFunc;
type ParamGuard<T extends ExpressionResult> = ((input: ExpressionResult) => T);

type WrappedArgs<Guards extends readonly ParamGuard<ExpressionResult>[]> = {
    [i in keyof Guards]: Guards[i] extends ParamGuard<infer T> ? T : never
};

// TODO: this doesn't require the argument to be inferred as a tuple
type Wrapped<Guards extends readonly ParamGuard<ExpressionResult>[]> =
    (...args: WrappedArgs<Guards>) => ExpressionResult;

type WrappedWithReport<Guards extends readonly ParamGuard<ExpressionResult>[]> =
    (report: (value: ExpressionResult) => void,
        call: (input: ExprFunc, arg: ExpressionResult, continuation: Continuation) => void,
        ...args: WrappedArgs<Guards>) => void;

const wrapBuiltin = <G extends readonly ParamGuard<ExpressionResult>[]>(
    builtin: Wrapped<G>, paramGuards: G): WrappedBuiltin => {
    return (stack, continuations) => {
        if (builtin.length !== paramGuards.length) throw new Error('Arity mismatch');
        if (builtin.length < 1) throw new Error(
            'Functions in Eurydice need at least one argument. ' +
            'Consider taking a null argument and discarding it.');
        const curried = (func: Wrapped<G>, guardIdx: number): (arg: ExpressionResult) => void => {
            const typedFunc = func as unknown as (...args: ExpressionResult[]) => ExpressionResult;
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
const wrapDeferred = <G extends readonly ParamGuard<ExpressionResult>[]>(
    unboundBuiltin: WrappedWithReport<G>, paramGuards: G): WrappedBuiltin => {
    return (stack, continuations) => {
        const report = (result: ExpressionResult): void => {
            continuations.pop()!(result);
        };
        const call = (input: ExprFunc, arg: ExpressionResult, continuation: Continuation): void => {
            input(arg);
            continuations.push(continuation);
        };
        const builtin: Wrapped<G> = (unboundBuiltin as Function).bind(null, report, call) as Wrapped<G>;
        if (builtin.length !== paramGuards.length) throw new Error('Arity mismatch');
        if (builtin.length < 1) throw new Error(
            'Functions in Eurydice need at least one argument. ' +
            'Consider taking a null argument and discarding it.');
        const curried = (func: Wrapped<G>, guardIdx: number): (arg: ExpressionResult) => void => {
            const typedFunc = func as unknown as (...args: ExpressionResult[]) => void;
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

const builtins: Record<string, WrappedBuiltin> = {
    /** Round a number down. */
    floor: wrapBuiltin(Math.floor, [expectNumber]),
    /** Round a number up. */
    ceil: wrapBuiltin(Math.ceil, [expectNumber]),
    /** Round a number to the nearest whole number. */
    round: wrapBuiltin(Math.round, [expectNumber]),
    /** Take the absolute value of a number. */
    abs: wrapBuiltin(Math.abs, [expectNumber]),
    /**
     * Roll a die.
     * You can specify a number (to roll a die from 1 to that number inclusive),
     * or an array of face values, possibly nested.
     * For instance, a d[1, [2, 3]] has a 50% chance of rolling a 1, 25% of rolling a 2, and 25% of rolling a 3.
     */
    d: wrapBuiltin((n: ExpressionResult): number => {
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
    }, [expectAny]),
    /** Roll a FATE/FUDGE die (-1, 0, or 1). */
    dF: wrapBuiltin((_: null): number => [-1, 0, 1][Math.floor(Math.random() * 3)], [expectNull]),
    /** Sort an array from lowest to highest. */
    sort: wrapBuiltin((arr: number[]): ExpressionResult[] => arr
        .slice(0)
        .sort((a: ExpressionResult, b: ExpressionResult) => (a as number) - (b as number)),
    [expectArrayOfNumbers]),
    /** Get the length of an array. */
    len: wrapBuiltin((arr: ExpressionResult[]): number => arr.length, [expectArray]),
    map: wrapDeferred((report, call, arr: ExpressionResult[], mapper: ExprFunc): void => {
        const results: ExpressionResult[] = [];
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
        report, call, arr: ExpressionResult[], reducer: ExprFunc, initialValue: ExpressionResult): void => {
        let i = 0;
        let prev = initialValue;
        const evalNext = (): void => {
            call(reducer, prev, innerReducer => {
                const innerReducerFunc = expectFunction(innerReducer);
                call(innerReducerFunc, arr[i], result => {
                    prev = result;
                    i++;
                    if (i === arr.length) {
                        report(prev);
                    } else {
                        evalNext();
                    }
                });
            });
        };
        if (arr.length > 0) {
            evalNext();
        } else {
            report(initialValue);
        }
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
        const rolls: ExpressionResult[] = [];
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
    highest: wrapBuiltin((n: number): ExprFunc => {
        const numToKeep = expectNumber(n);
        return (rolls: ExpressionResult) => keepHighest(expectArrayOfNumbers(rolls), numToKeep);
    }, [expectNumber]),
    lowest: wrapBuiltin((n: ExpressionResult): ExprFunc => {
        const numToKeep = expectNumber(n);
        return (rolls: ExpressionResult) => keepLowest(expectArrayOfNumbers(rolls), numToKeep);
    }, [expectNumber]),

    '+': wrapBuiltin((lhs: ExpressionResult, rhs: ExpressionResult) => {
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
    }, [expectAny, expectAny]),
    '-': wrapBuiltin((lhs: number, rhs: number): number => lhs - rhs, [expectNumber, expectNumber]),
    '*': wrapBuiltin((lhs: number, rhs: number): number => lhs * rhs, [expectNumber, expectNumber]),
    '/': wrapBuiltin((lhs: number, rhs: number): number => lhs / rhs, [expectNumber, expectNumber]),
    '%': wrapBuiltin((lhs: number, rhs: number): number =>
        ((lhs % rhs) + rhs) % rhs,
    [expectNumber, expectNumber]),
    '**': wrapBuiltin((lhs: number, rhs: number): number => Math.pow(lhs, rhs), [expectNumber, expectNumber]),
    '<': wrapBuiltin((lhs: number, rhs: number): number => Number(lhs < rhs), [expectNumber, expectNumber]),
    '<=': wrapBuiltin((lhs: number, rhs: number): number => Number(lhs <= rhs), [expectNumber, expectNumber]),
    '>': wrapBuiltin((lhs: number, rhs: number): number => Number(lhs > rhs), [expectNumber, expectNumber]),
    '>=': wrapBuiltin((lhs: number, rhs: number): number => Number(lhs >= rhs), [expectNumber, expectNumber]),
    '=': wrapBuiltin((lhs: ExpressionResult, rhs: ExpressionResult): number =>
        Number(equals(lhs, rhs)),
    [expectNumber, expectNumber]),
    '!=': wrapBuiltin((lhs: ExpressionResult, rhs: ExpressionResult): number =>
        Number(equals(lhs, rhs)),
    [expectNumber, expectNumber]),
    '|': wrapBuiltin((lhs: number, rhs: number): number => Math.max(lhs, rhs), [expectNumber, expectNumber]),
    '&': wrapBuiltin((lhs: number, rhs: number): number => Math.min(lhs, rhs), [expectNumber, expectNumber]),
    '!': wrapBuiltin((rhs: number) => 1 - rhs, [expectNumber]),
    '...': wrapBuiltin((values: number[]) =>
        values.reduce((prev, cur) => prev + cur, 0),
    [expectArrayOfNumbers])
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

const evaluate = (expr: Expression): ExpressionResult => {
    let finalResult: ExpressionResult;
    const stack: Expression[] = [];
    const continuations: Continuation[] = [(result): void => {
        finalResult = result;
    }];
    const variables = Object.create(null) as Partial<Record<string, ExpressionResult>>;
    for (const [builtinName, wrapper] of Object.entries(builtins)) {
        variables[builtinName] = wrapper(stack, continuations);
    }
    stack.push(expr);
    while (stack.length > 0) {
        const expr = stack.pop()!;
        switch (expr.type) {
            case 'number': {
                continuations.pop()!(expr.value);
                break;
            }
            case 'array': {
                const evaluatedElements: ExpressionResult[] = [];
                let elemIndex = 0;
                const evalNext = (): void => {
                    stack.push(expr.elements[elemIndex]);
                    continuations.push(elem => {
                        evaluatedElements.push(elem);
                        elemIndex++;
                        if (elemIndex === expr.elements.length) {
                            continuations.pop()!(evaluatedElements);
                        } else {
                            evalNext();
                        }
                    });
                };
                if (expr.elements.length) evalNext();
                break;
            }
            case 'variable': {
                const varValue = variables[expr.value];
                if (typeof varValue === 'undefined') {
                    throw new Error(`Undefined variable: ${expr.value}`);
                }
                continuations.pop()!(varValue);
                break;
            }
            case 'apply': {
                stack.push(expr.lhs);
                continuations.push(lhs => {
                    switch (typeof lhs) {
                        // Eagerly evaluate right-hand side and pass into function
                        case 'function': {
                            stack.push(expr.rhs);
                            continuations.push(rhs => {
                                lhs(rhs);
                            });
                            break;
                        }
                        // Evaluate right-hand side n times
                        case 'number': {
                            const evaluatedElements: ExpressionResult[] = [];
                            let numRemaining = lhs;
                            const evalNext = (): void => {
                                stack.push(expr.rhs);
                                continuations.push(elem => {
                                    evaluatedElements.push(elem);
                                    numRemaining--;
                                    if (numRemaining === 0) {
                                        continuations.pop()!(evaluatedElements);
                                    } else {
                                        evalNext();
                                    }
                                });
                            };
                            if (numRemaining > 0) evalNext();
                            break;
                        }
                        case 'object': {
                            const arr = expectArray(lhs);

                            stack.push(expr.rhs);
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
                continuations.pop()!((arg: ExpressionResult): void => {
                    const isShadowed = argName in variables;
                    let shadowed: ExpressionResult | undefined;
                    if (isShadowed) {
                        shadowed = variables[argName];
                    }
                    variables[argName] = arg;
                    stack.push(expr.body);
                    continuations.push(result => {
                        if (isShadowed) {
                            variables[argName] = shadowed;
                        }
                        continuations.pop()!(result);
                    });
                });
            }
        }
    }
    return finalResult!;
};

export default evaluate;
