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
    [TokenType.NE]: BinaryOpType.NE
};

type Expression = UnaryExpression | ArrayExpression | CallExpression | BinaryExpression | NumLiteral | Variable;

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
    [TokenType.PLUS]: 15,
    [TokenType.MINUS]: 15,
    [TokenType.BANG]: 15,
    [TokenType.SUM]: 15
};

const parseUnary = (lexer: Lexer): UnaryExpression | null => {
    const next = lexer.peek();
    const rbp = prefixBindingPower[next.type];
    if (!rbp) return null;
    const opType = tokenTypeToUnaryOp[next.type];
    if (typeof opType !== 'number') throw new Error(`Missing unary op type for ${next.value}`);
    lexer.next();
    const rhs = parseExpression(lexer, rbp);
    if (rhs === null) throw new Error('Expected expression');
    return {type: 'unary', op: opType, rhs};
};

const infixBindingPower: Partial<Record<TokenType, [number, number]>> = {
    [TokenType.LT]: [1, 2],
    [TokenType.LE]: [1, 2],
    [TokenType.GT]: [1, 2],
    [TokenType.GE]: [1, 2],
    [TokenType.EQ]: [3, 4],
    [TokenType.NE]: [3, 4],
    [TokenType.OR]: [5, 6],
    [TokenType.AND]: [7, 8],
    [TokenType.PLUS]: [9, 10],
    [TokenType.MINUS]: [9, 10],
    [TokenType.MULTIPLY]: [11, 12],
    [TokenType.DIVIDE]: [11, 12],
    [TokenType.MODULO]: [11, 12],
    [TokenType.POWER]: [13, 14],
    [TokenType.PAREN_L]: [17, 18]
};

const emptyBindingPower = [20, 19];

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
