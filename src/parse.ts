import Lexer, {TokenType} from './lexer';

type NumLiteral = {
    type: 'number',
    value: number
};

type Variable = {
    type: 'variable',
    value: string
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

type LetExpression = {
    type: 'let',
    variable: string,
    value: Expression,
    body: Expression
};

type IfExpression = {
    type: 'if',
    condition: Expression,
    trueBranch: Expression,
    falseBranch: Expression
};

type UnitExpression = {
    type: 'unit'
};

type FunctionDefinition = {
    type: 'defun',
    argument: string,
    body: Expression
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
ArrayExpression |
LetExpression |
IfExpression |
UnitExpression |
FunctionDefinition |
ApplyExpression |
NumLiteral |
Variable;

const sexpr = (expr: Expression): string => {
    switch (expr.type) {
        case 'variable': return expr.value;
        case 'number': return expr.value.toString();
        case 'array': return `(array ${expr.elements.map(elem => sexpr(elem)).join(' ')})`;
        case 'let': return `(let ${expr.variable} ${sexpr(expr.value)} in ${sexpr(expr.body)})`;
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
    if (inner === null) {
        lexer.next();
        return {type: 'unit'};
    }
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
    [TokenType.AT]: 1,
    [TokenType.LET]: 1,
    [TokenType.IF]: 3
};

const parsePrefix = (lexer: Lexer): FunctionDefinition | LetExpression | IfExpression | null => {
    const next = lexer.peek();
    const rbp = prefixBindingPower[next.type];
    if (!rbp) return null;
    switch (next.type) {
        case TokenType.AT: {
            lexer.next();
            if (lexer.peek().type !== TokenType.NAME) throw new Error('Expected argument name');
            const argName = lexer.next().value;
            const body = parseExpression(lexer, rbp);
            if (body === null) throw new Error('Expected expression');
            return {type: 'defun', argument: argName, body};
        }
        case TokenType.LET: {
            lexer.next();
            if (lexer.peek().type !== TokenType.NAME) throw new Error('Expected variable name');
            const varName = lexer.next().value;
            const value = parseExpression(lexer, rbp);
            if (value === null) throw new Error('Expected expression');
            if (lexer.next().type !== TokenType.IN) throw new Error('Expected \'in\'');
            const body = parseExpression(lexer, rbp);
            if (body === null) throw new Error('Expected expression');
            return {type: 'let', variable: varName, value, body: body};
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
            return {type: 'if', condition, trueBranch, falseBranch};
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
    const lhs: Variable = {type: 'variable', value: builtinName};
    lexer.next();
    const rhs = parseExpression(lexer, 0);
    if (rhs === null) return lhs;
    return {type: 'apply', lhs, rhs};
};

const infixBindingPower: Partial<Record<TokenType, [number, number]>> = {
    [TokenType.LT]: [5, 6],
    [TokenType.LE]: [5, 6],
    [TokenType.GT]: [5, 6],
    [TokenType.GE]: [5, 6],
    [TokenType.EQ]: [7, 8],
    [TokenType.NE]: [7, 8],
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
    if (lhs === null) lhs = parsePrefix(lexer);
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
            op.type === TokenType.IN ||
            op.type === TokenType.THEN ||
            op.type === TokenType.ELSE ||
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

export {sexpr};

export type {NumLiteral, Variable, Expression};
