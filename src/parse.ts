import Lexer, {TokenType} from './lexer';
import formatError from './util/format-error';

type Span = {
    start: number,
    end: number
};

type NumLiteral = {
    type: 'number',
    value: number
} & Span;

type StringLiteral = {
    type: 'string',
    value: string
} & Span;

type Variable = {
    type: 'variable',
    value: string
} & Span;

type ApplyExpression = {
    type: 'apply',
    lhs: Expression,
    rhs: Expression
} & Span;

type ArrayExpression = {
    type: 'array',
    elements: Expression[]
} & Span;

type PerformExpression = {
    type: 'perform',
    value: string
} & Span;

type LetExpression = {
    type: 'let',
    variables: {
        name: string,
        value: Expression
    }[],
    body: Expression
} & Span;

type HandleExpression = {
    type: 'handle',
    handlers: {
        name: string,
        value: Expression
    }[],
    body: Expression
} & Span;

type IfExpression = {
    type: 'if',
    condition: Expression,
    trueBranch: Expression,
    falseBranch: Expression
} & Span;

type UnitExpression = {
    type: 'unit'
} & Span;

type FunctionDefinition = {
    type: 'defun',
    argument: string,
    body: Expression
} & Span;

const infixToBuiltin: Partial<Record<TokenType, string>> = {
    [TokenType.PLUS]: '+',
    [TokenType.MINUS]: '-',
    [TokenType.MULTIPLY]: '*',
    [TokenType.DIVIDE]: '/',
    [TokenType.MODULO]: '%',
    [TokenType.POWER]: '**',

    [TokenType.OR]: '|',
    [TokenType.AND]: '&',

    [TokenType.LT]: '<',
    [TokenType.LE]: '<=',
    [TokenType.GT]: '>',
    [TokenType.GE]: '>=',
    [TokenType.EQ]: '=',
    [TokenType.NE]: '!='
};

type Expression =
ArrayExpression |
LetExpression |
HandleExpression |
IfExpression |
UnitExpression |
FunctionDefinition |
ApplyExpression |
PerformExpression |
NumLiteral |
StringLiteral |
Variable;

const sexpr = (expr: Expression): string => {
    switch (expr.type) {
        case 'variable': return expr.value;
        case 'perform': return `(perform ${expr.value})`;
        case 'number': return expr.value.toString();
        case 'string': return JSON.stringify(expr.value);
        case 'array': return `(array ${expr.elements.map(elem => sexpr(elem)).join(' ')})`;
        case 'let': return `(let ${expr.variables.map(({name, value}) => `${name} ${sexpr(value)}`).join(' and ')} in ${sexpr(expr.body)})`;
        case 'handle': return `(handle ${expr.handlers.map(({name, value}) => `${name} ${sexpr(value)}`).join(' and ')} in ${sexpr(expr.body)})`;
        case 'if': return `(if ${sexpr(expr.condition)} then ${sexpr(expr.trueBranch)} else ${sexpr(expr.falseBranch)})`;
        case 'apply': return `(apply ${sexpr(expr.lhs)} ${sexpr(expr.rhs)})`;
        case 'unit': return `()`;
        case 'defun': return `(fun ${expr.argument} ${sexpr(expr.body)})`;
    }
};

const parse = (input: string): Expression => {
    const lexer = new Lexer(input);
    let parsed;
    try {
        parsed = parseExpression(lexer, 0);
        if (parsed === null) throw new Error('Expected expression');
        if (lexer.next().type !== TokenType.EOF) throw new Error('Expected EOF');
    } catch (err) {
        const start = lexer._curToken?.start ?? 0;
        const end = start + (lexer._curToken?.value.length ?? 1);
        throw formatError(err as Error, input, start, end);
    }
    return parsed;
};

const parseNumber = (lexer: Lexer): NumLiteral | null => {
    const num = lexer.peek();
    if (num.type !== TokenType.NUMBER) return null;
    lexer.next();
    return {
        type: 'number',
        value: Number(num.value),
        start: num.start,
        end: num.start + num.value.length
    };
};

const parseString = (lexer: Lexer): StringLiteral | null => {
    const str = lexer.peek();
    if (str.type !== TokenType.STRING) return null;
    lexer.next();
    return {
        type: 'string',
        // Just use the JSON string parser
        value: JSON.parse(str.value) as string,
        start: str.start,
        end: str.start + str.value.length
    };
};

const parseParenthesized = (lexer: Lexer): Expression | null => {
    const next = lexer.peek();
    if (next.type !== TokenType.PAREN_L) return null;
    lexer.next();
    const inner = parseExpression(lexer, 0);
    if (inner === null) {
        lexer.next();
        return {
            type: 'unit',
            start: next.start,
            end: next.start + next.value.length
        };
    }
    if (lexer.next().type !== TokenType.PAREN_R) {
        throw new Error(`Expected closing parenthesis`);
    }
    return inner;
};

const parseArray = (lexer: Lexer): Expression | null => {
    const next = lexer.peek();
    if (next.type !== TokenType.BRACKET_L) return null;
    lexer.next();
    const elements: Expression[] = [];
    if (lexer.peek().type !== TokenType.BRACKET_R) {
        for (;;) {
            const parsedExpr = parseExpression(lexer, 0);
            if (parsedExpr === null) throw new Error('Expected expression');
            elements.push(parsedExpr);
            if (lexer.peek().type !== TokenType.DOT) break;
            lexer.next();
        }
    }
    const endBracket = lexer.next();
    if (endBracket.type !== TokenType.BRACKET_R) {
        throw new Error(`Expected closing bracket`);
    }
    return {
        type: 'array',
        elements,
        start: next.start,
        end: endBracket.start + endBracket.value.length
    };
};

const parseName = (lexer: Lexer): Variable | null => {
    const next = lexer.peek();
    if (next.type !== TokenType.NAME) return null;
    lexer.next();
    return {
        type: 'variable',
        value: next.value,
        start: next.start,
        end: next.start + next.value.length
    };
};

const prefixBindingPower: Partial<Record<TokenType, number>> = {
    [TokenType.AT]: 1,
    [TokenType.TILDE]: 1,
    [TokenType.LET]: 1,
    [TokenType.HANDLE]: 1,
    [TokenType.IF]: 3,
    [TokenType.MINUS]: 19,
    [TokenType.NOT]: 19
};

const prefixToBuiltin = {
    [TokenType.MINUS]: 'negate',
    [TokenType.NOT]: '!'
};

const parsePrefix = (lexer: Lexer):
FunctionDefinition |
LetExpression |
HandleExpression |
IfExpression |
ApplyExpression |
PerformExpression |
null => {
    const next = lexer.peek();
    const rbp = prefixBindingPower[next.type];
    if (!rbp) return null;
    switch (next.type) {
        case TokenType.AT: {
            lexer.next();
            const nextToken = lexer.next();
            if (nextToken.type !== TokenType.NAME) throw new Error('Expected argument name');
            const argName = nextToken.value;
            const body = parseExpression(lexer, rbp);
            if (body === null) throw new Error('Expected expression');
            return {
                type: 'defun',
                argument: argName,
                body,
                start: next.start,
                end: body.end
            };
        }
        case TokenType.LET: {
            lexer.next();
            const variables = [];
            for (;;) {
                const nextToken = lexer.next();
                if (nextToken.type !== TokenType.NAME) throw new Error('Expected variable name');
                const varName = nextToken.value;
                const value = parseExpression(lexer, rbp);
                if (value === null) throw new Error('Expected expression');
                variables.push({name: varName, value});
                if (lexer.peek().type !== TokenType.LET_AND) break;
                lexer.next();
            }
            if (lexer.next().type !== TokenType.IN) throw new Error('Expected \'in\'');
            const body = parseExpression(lexer, rbp);
            if (body === null) throw new Error('Expected expression');
            return {
                type: 'let',
                variables,
                body,
                start: next.start,
                end: body.end
            };
        }
        case TokenType.HANDLE: {
            lexer.next();
            const handlers = [];
            for (;;) {
                const nextToken = lexer.next();
                if (nextToken.type !== TokenType.NAME) throw new Error('Expected effect name');
                const effectName = nextToken.value;
                const value = parseExpression(lexer, rbp);
                if (value === null) throw new Error('Expected expression');
                handlers.push({name: effectName, value});
                if (lexer.peek().type !== TokenType.LET_AND) break;
                lexer.next();
            }
            if (lexer.next().type !== TokenType.IN) throw new Error('Expected \'in\'');
            const body = parseExpression(lexer, rbp);
            if (body === null) throw new Error('Expected expression');
            return {
                type: 'handle',
                handlers,
                body,
                start: next.start,
                end: body.end
            };
        }
        case TokenType.IF: {
            lexer.next();
            const condition = parseExpression(lexer, rbp);
            if (condition === null) throw new Error('Expected expression');
            if (lexer.next().type !== TokenType.THEN) throw new Error('Expected \'then\'');
            const trueBranch = parseExpression(lexer, rbp);
            if (trueBranch === null) throw new Error('Expected expression');
            if (lexer.next().type !== TokenType.ELSE) throw new Error('Expected \'else\'');
            const falseBranch = parseExpression(lexer, rbp);
            if (falseBranch === null) throw new Error('Expected expression');
            return {
                type: 'if',
                condition,
                trueBranch,
                falseBranch,
                start: next.start,
                end: falseBranch.end
            };
        }
        case TokenType.NOT:
        case TokenType.MINUS: {
            lexer.next();
            const operand = parseExpression(lexer, rbp);
            if (operand === null) throw new Error('Expected expression');
            return {
                type: 'apply',
                lhs: {
                    type: 'variable',
                    value: prefixToBuiltin[next.type],
                    start: next.start,
                    end: next.start + next.value.length
                },
                rhs: operand,
                start: next.start,
                end: operand.end
            };
        }
        case TokenType.TILDE: {
            lexer.next();
            const nextToken = lexer.next();
            if (nextToken.type !== TokenType.NAME) throw new Error('Expected effect name');
            return {
                type: 'perform',
                value: nextToken.value,
                start: next.start,
                end: nextToken.start + nextToken.value.length
            };
        }
    }
    return null;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const parseUnmatchedInfix = (lexer: Lexer): ApplyExpression | Variable | null => {
    const next = lexer.peek();
    const bindingPower = infixBindingPower[next.type];
    if (!bindingPower) return null;
    const builtinName = infixToBuiltin[next.type];
    if (!builtinName) throw new Error(`Missing builtin for ${next.value}`);
    const lhs: Variable = {
        type: 'variable',
        value: builtinName,
        start: next.start,
        end: next.start + next.value.length
    };
    lexer.next();
    const rhs = parseExpression(lexer, 0);
    if (rhs === null) return lhs;
    return {
        type: 'apply',
        lhs,
        rhs,
        start: lhs.start,
        end: rhs.end
    };
};

const infixBindingPower: Partial<Record<TokenType, [number, number]>> = {
    [TokenType.EQ]: [5, 6],
    [TokenType.NE]: [5, 6],
    [TokenType.LT]: [7, 8],
    [TokenType.LE]: [7, 8],
    [TokenType.GT]: [7, 8],
    [TokenType.GE]: [7, 8],
    [TokenType.OR]: [9, 10],
    [TokenType.AND]: [11, 12],
    [TokenType.PLUS]: [13, 14],
    [TokenType.MINUS]: [13, 14],
    [TokenType.MULTIPLY]: [15, 16],
    [TokenType.DIVIDE]: [15, 16],
    [TokenType.MODULO]: [15, 16],
    [TokenType.POWER]: [17, 18]
};

const emptyBindingPower = [24, 23];

// Commas, when not in array literals, act as "left-associateify" tokens.
const postfixBindingPower: Partial<Record<TokenType, number>> = {
    [TokenType.COMMA]: 21
};

const parseExpression = (
    lexer: Lexer,
    minBP: number): Expression | null => {
    let lhs: Expression | null = parseNumber(lexer);
    if (lhs === null) lhs = parseParenthesized(lexer);
    if (lhs === null) lhs = parseArray(lexer);
    if (lhs === null) lhs = parsePrefix(lexer);
    if (lhs === null) lhs = parseName(lexer);
    if (lhs === null) lhs = parseString(lexer);
    // TODO: re-enable? There's a lot of footgun potential since it binds the left side first but the expression appears
    // to the right of the unmatched infix operator.
    // if (lhs === null) lhs = parseUnmatchedInfix(lexer);
    if (lhs === null) return null;

    for (;;) {
        const op = lexer.peek();
        if (
            op.type === TokenType.EOF ||
            op.type === TokenType.PAREN_R ||
            op.type === TokenType.BRACKET_R ||
            op.type === TokenType.IN ||
            op.type === TokenType.THEN ||
            op.type === TokenType.ELSE ||
            op.type === TokenType.LET_AND ||
            op.type === TokenType.DOT
        ) break;

        const postfixPowers = postfixBindingPower[op.type];
        if (postfixPowers) {
            const lbp = postfixPowers;
            if (lbp < minBP) break;
            lexer.next();
            continue;
        }

        const bindingPowers = infixBindingPower[op.type];

        // Two expressions in a row. Evaluate these as `cons`.
        // Used for easier function calls and whatnot (e.g. in "d20", "d" can be a function and "20" its argument).
        if (!bindingPowers) {
            const [lbp, rbp] = emptyBindingPower;
            if (lbp < minBP) break;
            const rhs = parseExpression(lexer, rbp);
            if (rhs === null) throw new Error('Expected expression');
            lhs = {
                type: 'apply',
                lhs,
                rhs,
                start: lhs.start,
                end: rhs.end
            };
            continue;
        }
        const [lbp, rbp] = bindingPowers;
        if (lbp < minBP) break;
        lexer.next();
        const rhs = parseExpression(lexer, rbp);
        if (rhs === null) throw new Error('Expected expression');
        const builtinName = infixToBuiltin[op.type];
        if (!builtinName) throw new Error(`Missing builtin for ${op.value}`);
        // Infix operators are shortcuts for builtin functions
        lhs = {
            type: 'apply',
            lhs: {
                type: 'apply',
                lhs: {
                    type: 'variable',
                    value: builtinName,
                    start: op.start,
                    end: op.start + op.value.length
                },
                rhs: lhs,
                // the span of the inner apply op is that of the first argument and the op
                // so for example, for "2 - 2" the span would include "2 -"
                start: lhs.start,
                end: op.start + op.value.length
            },
            rhs,
            start: lhs.start,
            end: rhs.start + rhs.end
        };
    }

    return lhs;
};

export default parse;

export {sexpr};

export type {NumLiteral, Variable, Expression};
