import {
    LRLanguage,
    LanguageSupport,
    indentNodeProp,
    continuedIndent,
    foldNodeProp,
    foldInside
} from '@codemirror/language';
import {completeFromList} from '@codemirror/autocomplete';
import {styleTags, tags as t, Tag} from '@lezer/highlight';
import {LRParser} from '@lezer/lr';
import {SyntaxNode} from '@lezer/common';

import {parser as _parser} from './generated/parser';

const parser = _parser as LRParser;

const foldLast = (node: SyntaxNode): {from: number, to: number} | null => {
    const first = node.firstChild;
    const last = node.lastChild;
    if (!first || !last) return null;
    return {from: first.to, to: last.to};
};

const argumentName = Tag.define(t.name);

const tags = {argumentName} as const;

const parserWithMetadata = parser.configure({
    props: [
        styleTags({
            OpenParen: t.paren,
            CloseParen: t.paren,

            OpenBracket: t.bracket,
            CloseBracket: t.bracket,

            Variable: t.variableName,
            Number: t.number,
            String: t.string,
            Comma: t.separator,
            Dot: t.separator,
            UnitExpression: t.unit,

            Power: t.arithmeticOperator,
            Multiply: t.arithmeticOperator,
            Divide: t.arithmeticOperator,
            Modulo: t.arithmeticOperator,
            Plus: t.arithmeticOperator,
            Minus: t.arithmeticOperator,
            And: t.logicOperator,
            Or: t.logicOperator,
            Greater: t.compareOperator,
            GreaterEq: t.compareOperator,
            Less: t.compareOperator,
            LessEq: t.compareOperator,
            Eq: t.compareOperator,
            NotEq: t.compareOperator,

            Let: t.definitionKeyword,
            In: t.definitionKeyword,
            LetAnd: t.definitionKeyword,

            If: t.controlKeyword,
            Then: t.controlKeyword,
            Else: t.controlKeyword,

            FunctionParameter: argumentName,

            Comment: t.comment
        }),
        indentNodeProp.add({
            LetExpression: continuedIndent(),
            IfExpression: continuedIndent(),
            ArrayExpression: continuedIndent(),
            FunctionExpression: continuedIndent()
        }),
        foldNodeProp.add({
            ArrayExpression: foldInside,
            FunctionExpression: foldLast,
            LetDef: foldLast
        })
    ]
});

const eurydiceLanguage = LRLanguage.define({
    parser: parserWithMetadata,
    languageData: {
        closeBrackets: {brackets: ['(', '[']}
    }
});

const completion = eurydiceLanguage.data.of({
    autocomplete: completeFromList([
        {label: 'let', type: 'keyword'},
        {label: 'in', type: 'keyword'},
        {label: 'and', type: 'keyword'},
        {label: 'if', type: 'keyword'},
        {label: 'then', type: 'keyword'},
        {label: 'else', type: 'keyword'}
    ])
});

export default (): LanguageSupport => new LanguageSupport(eurydiceLanguage, [completion]);
export {parser, tags};
