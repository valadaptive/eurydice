import {BinaryOpType, UnaryOpType, Expression} from './parse';

type ExpressionResult = number | ExprFunc;

type ExprFunc = (...args: ExpressionResult[]) => ExpressionResult;

const typecheckBuiltin = (inFunc: (n: number) => number): ExprFunc => {
    return (n: ExpressionResult): number => {
        if (typeof n !== 'number') throw new Error('Expected number');
        return inFunc(n);
    };
};

const builtins: Partial<Record<string, ExprFunc>> = {
    floor: typecheckBuiltin(Math.floor),
    ceil: typecheckBuiltin(Math.ceil),
    round: typecheckBuiltin(Math.round),
    abs: typecheckBuiltin(Math.abs)
};

const evaluate = (expr: Expression, variables?: Record<string, ExpressionResult>): ExpressionResult => {
    switch (expr.type) {
        case 'number': return expr.value;
        case 'variable': {
            const varFromLookup = variables?.[expr.value];
            if (varFromLookup) return varFromLookup;
            const builtin = builtins[expr.value];
            if (builtin) return builtin;
            throw new Error(`Undefined variable: ${expr.value}`);
        }
        case 'binary': {
            const lhs = evaluate(expr.lhs, variables);
            const rhs = evaluate(expr.rhs, variables);
            if (typeof lhs !== 'number') throw new TypeError('Expected number');
            if (typeof rhs !== 'number') throw new TypeError('Expected number');
            switch (expr.op) {
                case BinaryOpType.ADD: return lhs + rhs;
                case BinaryOpType.SUBTRACT: return lhs - rhs;
                case BinaryOpType.MULTIPLY: return lhs * rhs;
                case BinaryOpType.DIVIDE: return lhs / rhs;
                case BinaryOpType.MODULO: return ((lhs % rhs) + rhs) % rhs;
                case BinaryOpType.POWER: return Math.pow(lhs, rhs);
                case BinaryOpType.DICE: {
                    let sum = 0;
                    for (let i = 0; i < Math.round(lhs); i++) {
                        const roll = Math.floor(Math.random() * Math.round(rhs)) + 1;
                        sum += roll;
                    }
                    return sum;
                }
            }
            break;
        }
        case 'unary': {
            const rhs = evaluate(expr.rhs, variables);
            switch (expr.op) {
                case UnaryOpType.POSITIVE: return rhs;
                case UnaryOpType.NEGATIVE: return -rhs;
            }
            break;
        }
        case 'call': {
            const callee = evaluate(expr.callee, variables);
            if (typeof callee !== 'function') throw new TypeError('Expected function');
            return callee(...expr.arguments.map(arg => evaluate(arg, variables)));
        }
    }
};

export default evaluate;
