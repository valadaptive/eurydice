import {Expression} from './parse';

type ExprFunc = (arg: Value) => void;
type Value = number | ExprFunc | Value[] | null;

const truthy = (value: number): boolean => value > 0;

const MAX_REROLLS = 100;

const expectAny = (input: Value): Value => input;

const expectNull = (input: Value): null => {
    if (input !== null) throw new TypeError(`Expected null, got ${String(input)}`);
    return input;
};

const expectNumber = (input: Value): number => {
    if (typeof input !== 'number') throw new TypeError(`Expected number, got ${String(input)}`);
    return input;
};

const expectArray = (input: Value): Value[] => {
    if (typeof input !== 'object' || input === null) throw new TypeError(`Expected array, got ${String(input)}`);
    return input;
};

const expectFunction = (input: Value): ExprFunc => {
    if (typeof input !== 'function') throw new TypeError(`Expected function, got ${String(input)}`);
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
type WrappedBuiltin = (stack: StackFrame[], continuations: Continuation[]) => ExprFunc;
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

const wrapBuiltin = <G extends readonly ParamGuard<Value>[]>(
    builtin: Wrapped<G>, paramGuards: G): WrappedBuiltin => {
    return (stack, continuations) => {
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
    unboundBuiltin: WrappedWithReport<G>, paramGuards: G): WrappedBuiltin => {
    return (stack, continuations) => {
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
    d: wrapBuiltin((n: Value): number => {
        if (typeof n === 'number') return Math.floor(Math.random() * Math.round(n)) + 1;
        if (typeof n === 'object' && n !== null) {
            let currentArray: Value[] = n;
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
    sort: wrapBuiltin((arr: number[]): Value[] => arr
        .slice(0)
        .sort((a: Value, b: Value) => (a as number) - (b as number)),
    [expectArrayOfNumbers]),
    /** Get the length of an array. */
    len: wrapBuiltin((arr: Value[]): number => arr.length, [expectArray]),
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
    highest: wrapBuiltin((n: number): ExprFunc => {
        const numToKeep = expectNumber(n);
        return (rolls: Value) => keepHighest(expectArrayOfNumbers(rolls), numToKeep);
    }, [expectNumber]),
    lowest: wrapBuiltin((n: Value): ExprFunc => {
        const numToKeep = expectNumber(n);
        return (rolls: Value) => keepLowest(expectArrayOfNumbers(rolls), numToKeep);
    }, [expectNumber]),

    '+': wrapBuiltin((lhs: Value, rhs: Value) => {
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
    '=': wrapBuiltin((lhs: Value, rhs: Value): number =>
        Number(equals(lhs, rhs)),
    [expectNumber, expectNumber]),
    '!=': wrapBuiltin((lhs: Value, rhs: Value): number =>
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

const evaluate = (expr: Expression): Value => {
    let finalResult: Value;
    const stack: StackFrame[] = [];
    const continuations: Continuation[] = [(result): void => {
        finalResult = result;
    }];
    const rootEnvironment: Environment = {
        variables: Object.create(null) as Partial<Record<string, Value>>,
        parent: null
    };
    for (const [builtinName, wrapper] of Object.entries(builtins)) {
        rootEnvironment.variables[builtinName] = wrapper(stack, continuations);
    }
    stack.push({expr, environment: rootEnvironment});
    while (stack.length > 0) {
        const {expr, environment} = stack.pop()!;
        switch (expr.type) {
            case 'unit': {
                continuations.pop()!(null);
                break;
            }
            case 'number': {
                continuations.pop()!(expr.value);
                break;
            }
            case 'array': {
                const evaluatedElements: Value[] = [];
                let elemIndex = 0;
                const evalNext = (): void => {
                    stack.push({expr: expr.elements[elemIndex], environment});
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
                if (expr.elements.length) {
                    evalNext();
                } else {
                    continuations.pop()!([]);
                }
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
                stack.push({expr: expr.lhs, environment});
                continuations.push(lhs => {
                    switch (typeof lhs) {
                        // Eagerly evaluate right-hand side and pass into function
                        case 'function': {
                            stack.push({expr: expr.rhs, environment});
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
                                stack.push({expr: expr.rhs, environment});
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

                            stack.push({expr: expr.rhs, environment});
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
                    stack.push({
                        expr: expr.body,
                        // Bind the function argument name to its evaluated value
                        environment: {
                            variables: {[argName]: argValue},
                            parent: environment
                        }
                    });
                });
                break;
            }
            case 'let': {
                const varName = expr.variable;
                // Construct a new environment with the variable in it, currently uninitialized
                const newEnv: Environment = {
                    variables: {[varName]: null},
                    parent: environment
                };
                // Evaluate the value of the "let" expression
                stack.push({expr: expr.value, environment: newEnv});
                continuations.push(varValue => {
                    // Once that's evaluated, backpatch the variable value to it
                    newEnv.variables[varName] = varValue;
                    // Evaluate the expression body
                    stack.push({
                        expr: expr.body,
                        environment: newEnv
                    });
                });
                break;
            }
            case 'if': {
                stack.push({expr: expr.condition, environment});
                continuations.push(condValue => {
                    stack.push({
                        expr: truthy(expectNumber(condValue)) ? expr.trueBranch : expr.falseBranch,
                        environment
                    });
                });
            }
        }
    }
    return finalResult!;
};

export default evaluate;
