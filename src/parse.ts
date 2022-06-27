import Lexer, {TokenType} from './lexer';

type NumLiteral = {
    type: 'number',
    value: number
};

type Variable = {
    type: 'variable',
    value: string
};

type CallExpression = {
    type: 'call',
    callee: Expression,
    arguments: Expression[]
};

enum UnaryOpType {
    NEGATIVE,
    POSITIVE,
    NOT,
    SUM
}

enum BinaryOpType {
    ADD,
    SUBTRACT,
    MULTIPLY,
    DIVIDE,
    MODULO,
    POWER,

    AND,
    OR,

    LT,
    LE,
    GT,
    GE,
    EQ,
    NE,

    HIGHEST,
    LOWEST,

    CONS
}

type UnaryExpression = {
    type: 'unary',
    op: UnaryOpType,
    rhs: Expression
};

type BinaryExpression = {
    type: 'binary',
    op: BinaryOpType,
    lhs: Expression,
    rhs: Expression
};

type ArrayExpression = {
    type: 'array',
    elements: Expression[]
};

type FunctionDefinition = {
    type: 'defun',
    arguments: Variable[],
    body: Expression
};

const tokenTypeToUnaryOp: Partial<Record<TokenType, UnaryOpType>> = {
    [TokenType.PLUS]: UnaryOpType.POSITIVE,
    [TokenType.MINUS]: UnaryOpType.NEGATIVE,
    [TokenType.BANG]: UnaryOpType.NOT,
    [TokenType.SUM]: UnaryOpType.SUM
};

const tokenTypeToBinaryOp: Partial<Record<TokenType, BinaryOpType>> = {
    [TokenType.PLUS]: BinaryOpType.ADD,
    [TokenType.MINUS]: BinaryOpType.SUBTRACT,
    [TokenType.MULTIPLY]: BinaryOpType.MULTIPLY,
    [TokenType.DIVIDE]: BinaryOpType.DIVIDE,
    [TokenType.MODULO]: BinaryOpType.MODULO,
    [TokenType.POWER]: BinaryOpType.POWER,

    [TokenType.OR]: BinaryOpType.OR,
    [TokenType.AND]: BinaryOpType.AND,

    [TokenType.LT]: BinaryOpType.LT,
    [TokenType.LE]: BinaryOpType.LE,
    [TokenType.GT]: BinaryOpType.GT,
    [TokenType.GE]: BinaryOpType.GE,
    [TokenType.EQ]: BinaryOpType.EQ,
    [TokenType.NE]: BinaryOpType.NE,

    [TokenType.HIGHEST]: BinaryOpType.HIGHEST,
    [TokenType.LOWEST]: BinaryOpType.LOWEST
};

type Expression =
UnaryExpression |
ArrayExpression |
FunctionDefinition |
CallExpression |
BinaryExpression |
NumLiteral |
Variable;

const unaryOpTypeToOpString: Record<UnaryOpType, string> = {
    [UnaryOpType.POSITIVE]: '+',
    [UnaryOpType.NEGATIVE]: '-',
    [UnaryOpType.NOT]: '!',
    [UnaryOpType.SUM]: '...'
};

const binaryOpTypeToOpString: Record<BinaryOpType, string> = {
    [BinaryOpType.ADD]: '+',
    [BinaryOpType.SUBTRACT]: '-',
    [BinaryOpType.MULTIPLY]: '*',
    [BinaryOpType.DIVIDE]: '/',
    [BinaryOpType.MODULO]: '%',
    [BinaryOpType.POWER]: '**',
    [BinaryOpType.OR]: '|',
    [BinaryOpType.AND]: '&',
    [BinaryOpType.LT]: '<',
    [BinaryOpType.LE]: '<=',
    [BinaryOpType.GT]: '>',
    [BinaryOpType.GE]: '>=',
    [BinaryOpType.EQ]: '=',
    [BinaryOpType.NE]: '!=',
    [BinaryOpType.HIGHEST]: 'hi',
    [BinaryOpType.LOWEST]: 'lo',
    [BinaryOpType.CONS]: 'cons'
};

const sexpr = (expr: Expression): string => {
    switch (expr.type) {
        case 'variable': return expr.value;
        case 'number': return expr.value.toString();
        case 'unary': return `(${unaryOpTypeToOpString[expr.op]} ${sexpr(expr.rhs)})`;
        case 'call': return `(call ${sexpr(expr.callee)} ${expr.arguments.map(arg => sexpr(arg)).join(' ')})`;
        case 'array': return `(array ${expr.elements.map(elem => sexpr(elem)).join(' ')})`;
        case 'binary': return `(${binaryOpTypeToOpString[expr.op]} ${sexpr(expr.lhs)} ${sexpr(expr.rhs)})`;
        case 'defun': return `(fun (${expr.arguments.map(elem => sexpr(elem)).join(' ')}) ${sexpr(expr.body)})`;
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
            const parsedExpr = parseExpression(lexer, 0);
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
    [TokenType.PLUS]: 19,
    [TokenType.MINUS]: 19,
    [TokenType.BANG]: 19,
    [TokenType.SUM]: 19,
    [TokenType.AT]: 1
};

const parseUnary = (lexer: Lexer): UnaryExpression | FunctionDefinition | null => {
    const next = lexer.peek();
    const rbp = prefixBindingPower[next.type];
    if (!rbp) return null;
    if (next.type === TokenType.AT) {
        lexer.next();
        const argNames = [];
        if (lexer.peek().type !== TokenType.ARROW) {
            for (;;) {
                const parsedArgName = parseName(lexer);
                if (parsedArgName === null) throw new Error('Expected argument name');
                argNames.push(parsedArgName);
                if (lexer.peek().type === TokenType.ARROW) break;
            }
        }
        if (lexer.next().type !== TokenType.ARROW) {
            throw new Error('Expected arrow');
        }
        const body = parseExpression(lexer, rbp);
        if (body === null) throw new Error('Expected expression');
        return {type: 'defun', arguments: argNames, body};
    }
    const opType = tokenTypeToUnaryOp[next.type];
    if (typeof opType !== 'number') throw new Error(`Missing unary op type for ${next.value}`);
    lexer.next();
    const rhs = parseExpression(lexer, rbp);
    if (rhs === null) throw new Error('Expected expression');
    return {type: 'unary', op: opType, rhs};
};

const infixBindingPower: Partial<Record<TokenType, [number, number]>> = {
    [TokenType.LT]: [3, 4],
    [TokenType.LE]: [3, 4],
    [TokenType.GT]: [3, 4],
    [TokenType.GE]: [3, 4],
    [TokenType.EQ]: [5, 6],
    [TokenType.NE]: [5, 6],
    [TokenType.OR]: [7, 8],
    [TokenType.HIGHEST]: [9, 10],
    [TokenType.LOWEST]: [9, 10],
    [TokenType.AND]: [11, 12],
    [TokenType.PLUS]: [13, 14],
    [TokenType.MINUS]: [13, 14],
    [TokenType.MULTIPLY]: [15, 16],
    [TokenType.DIVIDE]: [15, 16],
    [TokenType.MODULO]: [15, 16],
    [TokenType.POWER]: [17, 18],
    [TokenType.PAREN_L]: [21, 22]
};

const emptyBindingPower = [24, 23];

const parseExpression = (lexer: Lexer, minBP: number): Expression | null => {
    let lhs: Expression | null = parseNumber(lexer);
    if (lhs === null) lhs = parseParenthesized(lexer);
    if (lhs === null) lhs = parseArray(lexer);
    if (lhs === null) lhs = parseUnary(lexer);
    if (lhs === null) lhs = parseName(lexer);
    if (lhs === null) return null;

    for (;;) {
        const op = lexer.peek();
        if (
            op.type === TokenType.EOF ||
            op.type === TokenType.COMMA ||
            op.type === TokenType.PAREN_R ||
            op.type === TokenType.BRACKET_R
        ) break;

        const bindingPowers = infixBindingPower[op.type];

        // Two expressions in a row. Evaluate these as `cons`.
        // Used for easier function calls and whatnot (e.g. in "d20", "d" can be a function and "20" its argument).
        if (!bindingPowers) {
            const [lbp, rbp] = emptyBindingPower;
            if (lbp < minBP) break;
            const rhs = parseExpression(lexer, rbp);
            if (rhs === null) throw new Error('Expected expression');
            lhs = {type: 'binary', op: BinaryOpType.CONS, lhs, rhs};
            continue;
        }
        const [lbp, rbp] = bindingPowers;
        if (lbp < minBP) break;
        lexer.next();
        // Left parenthesis in infix position--it's a function call
        if (op.type === TokenType.PAREN_L) {
            const args: Expression[] = [];
            if (lexer.peek().type !== TokenType.PAREN_R) {
                for (;;) {
                    const parsedExpr = parseExpression(lexer, 0);
                    if (parsedExpr === null) throw new Error('Expected expression');
                    args.push(parsedExpr);
                    if (lexer.peek().type !== TokenType.COMMA) break;
                    lexer.next();
                }
            }
            if (lexer.peek().type !== TokenType.PAREN_R) {
                throw new Error(`Expected right parenthesis`);
            }
            lhs = {type: 'call', callee: lhs, arguments: args};
        } else {
            const rhs = parseExpression(lexer, rbp);
            if (rhs === null) throw new Error('Expected expression');
            const opType = tokenTypeToBinaryOp[op.type];
            if (typeof opType !== 'number') throw new Error(`Missing binary op type for ${op.value}`);
            lhs = {type: 'binary', op: opType, lhs, rhs};
        }
    }

    return lhs;
};

export default parse;

export {UnaryOpType, BinaryOpType, sexpr};

export type {NumLiteral, Variable, CallExpression, UnaryExpression, BinaryExpression, Expression};
