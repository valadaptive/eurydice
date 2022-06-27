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
    POSITIVE
}

enum BinaryOpType {
    ADD,
    SUBTRACT,
    MULTIPLY,
    DIVIDE,
    MODULO,
    POWER,
    DICE
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

const tokenTypeToUnaryOp: Partial<Record<TokenType, UnaryOpType>> = {
    [TokenType.PLUS]: UnaryOpType.POSITIVE,
    [TokenType.MINUS]: UnaryOpType.NEGATIVE
};

const tokenTypeToBinaryOp: Partial<Record<TokenType, BinaryOpType>> = {
    [TokenType.PLUS]: BinaryOpType.ADD,
    [TokenType.MINUS]: BinaryOpType.SUBTRACT,
    [TokenType.MULTIPLY]: BinaryOpType.MULTIPLY,
    [TokenType.DIVIDE]: BinaryOpType.DIVIDE,
    [TokenType.MODULO]: BinaryOpType.MODULO,
    [TokenType.POWER]: BinaryOpType.POWER,
    [TokenType.DICE]: BinaryOpType.DICE
};

type Expression = UnaryExpression | CallExpression | BinaryExpression | NumLiteral | Variable;

const unaryOpTypeToOpString: Record<UnaryOpType, string> = {
    [UnaryOpType.POSITIVE]: '+',
    [UnaryOpType.NEGATIVE]: '-'
};

const binaryOpTypeToOpString: Record<BinaryOpType, string> = {
    [BinaryOpType.ADD]: '+',
    [BinaryOpType.SUBTRACT]: '-',
    [BinaryOpType.MULTIPLY]: '*',
    [BinaryOpType.DIVIDE]: '/',
    [BinaryOpType.MODULO]: '%',
    [BinaryOpType.POWER]: '**',
    [BinaryOpType.DICE]: 'd'
};

const sexpr = (expr: Expression): string => {
    switch (expr.type) {
        case 'variable': return expr.value;
        case 'number': return expr.value.toString();
        case 'unary': return `(${unaryOpTypeToOpString[expr.op]} ${sexpr(expr.rhs)})`;
        case 'call': return `(call ${sexpr(expr.callee)} ${expr.arguments.map(arg => sexpr(arg)).join(' ')})`;
        case 'binary': return `(${binaryOpTypeToOpString[expr.op]} ${sexpr(expr.lhs)} ${sexpr(expr.rhs)})`;
    }
};

const parse = (input: string): Expression => {
    const lexer = new Lexer(input);
    let parsed;
    try {
        parsed = parseExpression(lexer, 0);
    } catch (err) {
        let newMessage = `Parse error: ${(err as Error).message}\n`;
        newMessage += input + '\n';
        const lexPosition = lexer.index();
        newMessage += '-'.repeat(lexPosition - 1) + '^';
        throw new Error(newMessage);
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

const parseName = (lexer: Lexer): Variable | null => {
    const next = lexer.peek();
    if (next.type !== TokenType.NAME) return null;
    lexer.next();
    return {type: 'variable', value: next.value};
};

const prefixBindingPower: Partial<Record<TokenType, number>> = {
    [TokenType.PLUS]: 7,
    [TokenType.MINUS]: 7
};

const parseUnary = (lexer: Lexer): UnaryExpression | null => {
    const next = lexer.peek();
    const rbp = prefixBindingPower[next.type];
    if (!rbp) return null;
    const opType = tokenTypeToUnaryOp[next.type];
    if (typeof opType !== 'number') throw new Error(`Missing unary op type for ${next.value}`);
    lexer.next();
    const rhs = parseExpression(lexer, rbp);
    return {type: 'unary', op: opType, rhs};
};

const infixBindingPower: Partial<Record<TokenType, [number, number]>> = {
    [TokenType.PLUS]: [1, 2],
    [TokenType.MINUS]: [1, 2],
    [TokenType.MULTIPLY]: [3, 4],
    [TokenType.DIVIDE]: [3, 4],
    [TokenType.MODULO]: [3, 4],
    [TokenType.POWER]: [5, 6],
    [TokenType.DICE]: [9, 10],
    [TokenType.PAREN_L]: [11, 12]
};

const parseExpression = (lexer: Lexer, minBP: number): Expression => {
    let lhs: Expression | null = parseNumber(lexer);
    if (lhs === null) lhs = parseParenthesized(lexer);
    if (lhs === null) lhs = parseUnary(lexer);
    if (lhs === null) lhs = parseName(lexer);
    if (lhs === null) {
        throw new Error(`Unexpected token: ${lexer.peek().value}`);
    }

    for (;;) {
        const op = lexer.peek();
        if (op.type === TokenType.EOF) break;
        if (!(
            op.type === TokenType.PLUS ||
            op.type === TokenType.MINUS ||
            op.type === TokenType.MULTIPLY ||
            op.type === TokenType.DIVIDE ||
            op.type === TokenType.MODULO ||
            op.type === TokenType.POWER ||
            op.type === TokenType.DICE ||
            op.type === TokenType.PAREN_L ||
            op.type === TokenType.PAREN_R ||
            op.type === TokenType.COMMA
        )) {
            throw new Error(`Unexpected token: ${op.value}`);
        }

        const bindingPowers = infixBindingPower[op.type];
        if (bindingPowers) {
            const [lbp, rbp] = bindingPowers;
            if (lbp < minBP) break;
            lexer.next();
            // Left parenthesis in infix position--it's a function call
            if (op.type === TokenType.PAREN_L) {
                const args: Expression[] = [];
                if (lexer.peek().type !== TokenType.PAREN_R) {
                    for (;;) {
                        args.push(parseExpression(lexer, 0));
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
                const opType = tokenTypeToBinaryOp[op.type];
                if (typeof opType !== 'number') throw new Error(`Missing binary op type for ${op.value}`);
                lhs = {type: 'binary', op: opType, lhs, rhs};
            }
            continue;
        }

        break;
    }

    return lhs;
};

export default parse;

export {UnaryOpType, BinaryOpType, sexpr};

export type {NumLiteral, Variable, CallExpression, UnaryExpression, BinaryExpression, Expression};
