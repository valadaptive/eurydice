enum TokenType {
    PLUS,
    MINUS,
    MULTIPLY,
    DIVIDE,
    MODULO,
    POWER,

    LT,
    LE,
    GT,
    GE,
    EQ,
    NE,

    OR,
    AND,

    PAREN_L,
    PAREN_R,
    BRACKET_L,
    BRACKET_R,
    COMMA,
    DOT,

    AT,
    ARROW,

    LET,
    LET_AND,
    IN,
    IF,
    THEN,
    ELSE,

    NUMBER,
    NAME,

    EOF
}

type Token = {
    type: TokenType,
    value: string,
    start: number
};

const staticTokenToType: Partial<Record<string, TokenType>> = {
    '+': TokenType.PLUS,
    '-': TokenType.MINUS,
    '*': TokenType.MULTIPLY,
    '/': TokenType.DIVIDE,
    '%': TokenType.MODULO,
    '**': TokenType.POWER,
    '<': TokenType.LT,
    '<=': TokenType.LE,
    '>': TokenType.GT,
    '>=': TokenType.GE,
    '=': TokenType.EQ,
    '!=': TokenType.NE,
    '|': TokenType.OR,
    '&': TokenType.AND,
    '(': TokenType.PAREN_L,
    ')': TokenType.PAREN_R,
    '[': TokenType.BRACKET_L,
    ']': TokenType.BRACKET_R,
    ',': TokenType.COMMA,
    '.': TokenType.DOT,
    '@': TokenType.AT,
    'let': TokenType.LET,
    'and': TokenType.LET_AND,
    'in': TokenType.IN,
    'if': TokenType.IF,
    'then': TokenType.THEN,
    'else': TokenType.ELSE
};

class Lexer {
    _str: string;
    _regex: RegExp;
    _curToken: Token | null;
    _nextToken: Token;
    constructor (str: string) {
        this._str = str;
        this._regex = new RegExp(String.raw`(\+|-|\*\*?|\/|%|<=|<|>=|>|=|!=|\||&|\(|\)|\[|\]|,|\.(?!\.\.)|@)|((?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]\d+)?)|([a-zA-Z_]+|\.\.\.|!)|(\s+)`, 'y');
        this._curToken = null;
        this._nextToken = this._advance();
    }

    _advance (): Token {
        for (;;) {
            if (this._regex.lastIndex === this._str.length) {
                return {type: TokenType.EOF, value: '<EOF>', start: this._str.length};
            }
            const match = this._regex.exec(this._str);
            if (!match) throw new Error(`Unexpected character`);
            // Operators, parens (anything static)
            if (typeof match[1] === 'string') {
                const tokenType = staticTokenToType[match[1]];
                if (typeof tokenType !== 'number') throw new Error(`Unhandled static token ${match[1]}`);
                return {type: tokenType, value: match[1], start: match.index};
            }
            // Numbers
            if (typeof match[2] === 'string') {
                return {type: TokenType.NUMBER, value: match[2], start: match.index};
            }
            // Names
            if (typeof match[3] === 'string') {
                // Also check for static tokens
                const tokenType = staticTokenToType[match[3]];
                if (typeof tokenType === 'number') return {type: tokenType, value: match[3], start: match.index};
                return {type: TokenType.NAME, value: match[3], start: match.index};
            }
            // Whitespace
            if (typeof match[4] === 'string') continue;
        }
    }

    peek (): Token {
        return this._nextToken;
    }

    next (): Token {
        const curToken = this._nextToken;
        this._curToken = curToken;
        this._nextToken = this._advance();
        return curToken;
    }
}

export {Token, TokenType};

export default Lexer;
