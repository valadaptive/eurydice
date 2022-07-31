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
    NOT,

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
    STRING,
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
    '!': TokenType.NOT,
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

const STATIC_TOKEN = String.raw`\+|-|\*\*?|\/|%|<=|<|>=|>|=|!=|\||&|\(|\)|\[|\]|,|\.(?!\.\.)|@`;
const NUMBER = String.raw`(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]\d+)?`;
const NAME = String.raw`[a-zA-Z_]+|\.\.\.|!`;
const WHITESPACE = String.raw`\s+`;
const COMMENT = String.raw`#[^\n]*`;
const STRING = String.raw`"(?:[^"\\]|(?:\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})))*"`;

const LEXER_REGEX = [STATIC_TOKEN, NUMBER, NAME, WHITESPACE, COMMENT, STRING].map(str => `(${str})`).join('|');

class Lexer {
    _str: string;
    _regex: RegExp;
    _curToken: Token | null;
    _nextToken: Token;
    constructor (str: string) {
        this._str = str;
        this._regex = new RegExp(LEXER_REGEX, 'y');
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
            // Whitespace or comments
            if (typeof match[4] === 'string' || typeof match[5] === 'string') continue;

            // String literals
            if (typeof match[6] === 'string') {
                return {type: TokenType.STRING, value: match[6], start: match.index};
            }
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
