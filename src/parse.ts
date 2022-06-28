import Lexer, {TokenType} from './lexer';

type NumLiteral = {
    type: 'number',
    value: number
};

type Variable = {
    type: 'variable',
    value: string
};

enum UnaryOpType {
    NEGATIVE,
    POSITIVE,
    NOT,
    SUM
}

type UnaryExpression = {
    type: 'unary',
    op: UnaryOpType,
    rhs: Expression
};

type ApplyExpression = {
    type: 'apply',
    lhs: Expression,
    rhs: Expression
};

type ArrayExpression = {
    type: 'array',
    elements: Expression[]
};

type FunctionDefinition = {
    type: 'defun',
    argument: Variable,
    body: Expression
};

const tokenTypeToUnaryOp: Partial<Record<TokenType, UnaryOpType>> = {
    [TokenType.PLUS]: UnaryOpType.POSITIVE,
    [TokenType.MINUS]: UnaryOpType.NEGATIVE,
    [TokenType.BANG]: UnaryOpType.NOT,
    [TokenType.SUM]: UnaryOpType.SUM
};

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
UnaryExpression |
ArrayExpression |
FunctionDefinition |
ApplyExpression |
NumLiteral |
Variable;

const unaryOpTypeToOpString: Record<UnaryOpType, string> = {
    [UnaryOpType.POSITIVE]: '+',
    [UnaryOpType.NEGATIVE]: '-',
    [UnaryOpType.NOT]: '!',
    [UnaryOpType.SUM]: '...'
};

const sexpr = (expr: Expression): string => {
    switch (expr.type) {
        case 'variable': return expr.value;
        case 'number': return expr.value.toString();
        case 'unary': return `(${unaryOpTypeToOpString[expr.op]} ${sexpr(expr.rhs)})`;
        case 'array': return `(array ${expr.elements.map(elem => sexpr(elem)).join(' ')})`;
        case 'apply': return `(apply ${sexpr(expr.lhs)} ${sexpr(expr.rhs)})`;
        case 'defun': return `(fun ${sexpr(expr.argument)} ${sexpr(expr.body)})`;
    }
};

const parse = (input: string): Expression => {
    const lexer = new Lexer(input);
    let parsed;
    try {
        parsed = parseExpression(lexer, 0);
        if (parsed === null) throw new Error('Expected expression');
    } catch (err) {
        const error = err as Error;
        let newMessage = `Parse error: ${error.message}\n`;
        newMessage += input + '\n';
        const lexPosition = lexer.index();
        newMessage += '-'.repeat(lexPosition - 1) + '^';
        error.message = newMessage;
        throw error;
    }
    return parsed;
};

const parseNumber = (lexer: Lexer): NumLiteral | null => {
    const num = lexer.peek();
    if (num.type !== TokenType.NUMBER) return null;
    lexer.next();
    return {
        type: 'number',
        value: Number(num.value)
    };
};

const parseParenthesized = (lexer: Lexer): Expression | null => {
    const next = lexer.peek();
    if (next.type !== TokenType.PAREN_L) return null;
    lexer.next();
    const inner = parseExpression(lexer, 0);
    if (lexer.peek().type !== TokenType.PAREN_R) {
        throw new Error(`Expected closing parenthesis`);
    }
    lexer.next();
    return inner;
};

const parseArray = (lexer: Lexer): Expression | null => {
    const next = lexer.peek();
    if (next.type !== TokenType.BRACKET_L) return null;
    lexer.next();
    const elements: Expression[] = [];
    if (lexer.peek().type !== TokenType.BRACKET_R) {
        for (;;) {
            const parsedExpr = parseExpression(lexer, 0, ExpressionMode.ARRAY_ELEMENT);
            if (parsedExpr === null) throw new Error('Expected expression');
            elements.push(parsedExpr);
            if (lexer.peek().type !== TokenType.COMMA) break;
            lexer.next();
        }
    }
    if (lexer.peek().type !== TokenType.BRACKET_R) {
        throw new Error(`Expected closing bracket`);
    }
    lexer.next();
    return {type: 'array', elements};
};

const parseName = (lexer: Lexer): Variable | null => {
    const next = lexer.peek();
    if (next.type !== TokenType.NAME) return null;
    lexer.next();
    return {type: 'variable', value: next.value};
};

const prefixBindingPower: Partial<Record<TokenType, number>> = {
    [TokenType.SUM]: 19,
    [TokenType.AT]: 1
};

const parseUnary = (lexer: Lexer): UnaryExpression | FunctionDefinition | null => {
    const next = lexer.peek();
    const rbp = prefixBindingPower[next.type];
    if (!rbp) return null;
    if (next.type === TokenType.AT) {
        lexer.next();
        const argName = parseName(lexer);
        if (argName === null) throw new Error('Expected argument name');
        const body = parseExpression(lexer, rbp);
        if (body === null) throw new Error('Expected expression');
        return {type: 'defun', argument: argName, body};
    }
    const opType = tokenTypeToUnaryOp[next.type];
    if (typeof opType !== 'number') throw new Error(`Missing unary op type for ${next.value}`);
    lexer.next();
    const rhs = parseExpression(lexer, rbp);
    if (rhs === null) throw new Error('Expected expression');
    return {type: 'unary', op: opType, rhs};
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const parseUnmatchedInfix = (lexer: Lexer): ApplyExpression | Variable | null => {
    const next = lexer.peek();
    const bindingPower = infixBindingPower[next.type];
    if (!bindingPower) return null;
    const builtinName = infixToBuiltin[next.type];
    if (!builtinName) throw new Error(`Missing builtin for ${next.value}`);
    const lhs: Variable = {type: 'variable', value: builtinName};
    lexer.next();
    const rhs = parseExpression(lexer, 0);
    if (rhs === null) return lhs;
    return {type: 'apply', lhs, rhs};
};

const infixBindingPower: Partial<Record<TokenType, [number, number]>> = {
    [TokenType.LT]: [3, 4],
    [TokenType.LE]: [3, 4],
    [TokenType.GT]: [3, 4],
    [TokenType.GE]: [3, 4],
    [TokenType.EQ]: [5, 6],
    [TokenType.NE]: [5, 6],
    [TokenType.OR]: [7, 8],
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

enum ExpressionMode {
    NORMAL,
    /** Break out early on commas. */
    ARRAY_ELEMENT
}

const parseExpression = (
    lexer: Lexer,
    minBP: number,
    mode: ExpressionMode = ExpressionMode.NORMAL): Expression | null => {
    let lhs: Expression | null = parseNumber(lexer);
    if (lhs === null) lhs = parseParenthesized(lexer);
    if (lhs === null) lhs = parseArray(lexer);
    if (lhs === null) lhs = parseUnary(lexer);
    if (lhs === null) lhs = parseName(lexer);
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
            (op.type === TokenType.COMMA && mode === ExpressionMode.ARRAY_ELEMENT)
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
            lhs = {type: 'apply', lhs, rhs};
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
                lhs: {type: 'variable', value: builtinName},
                rhs: lhs
            },
            rhs
        };
    }

    return lhs;
};

export default parse;

export {UnaryOpType, sexpr};

export type {NumLiteral, Variable, UnaryExpression, ApplyExpression, Expression};
