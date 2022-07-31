import style from './style.scss';

import type {JSX} from 'preact';
import {useRef, useEffect} from 'preact/hooks';

import {EditorState} from '@codemirror/state';
import {EditorView, keymap} from '@codemirror/view';
import {defaultKeymap, history, historyKeymap} from '@codemirror/commands';
import {
    syntaxHighlighting,
    foldGutter,
    HighlightStyle,
    indentOnInput,
    bracketMatching
} from '@codemirror/language';
import {autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap} from '@codemirror/autocomplete';
import {tags as t} from '@lezer/highlight';

import eurydice, {tags as eurydiceTags} from '../../lang-support/language';

const debugStyle = HighlightStyle.define([
    {tag: t.name, color: 'var(--magenta-light)'},
    {tag: eurydiceTags.argumentName, color: 'var(--red-light)'},
    {tag: t.number, color: 'var(--magenta-dark)'},
    {tag: t.string, color: 'var(--orange)'},
    {tag: t.operator, color: 'var(--blue-dark)'},
    {tag: t.keyword, color: 'var(--blue)'},
    {tag: t.comment, color: 'var(--grey)'},
    {tag: t.bracket, color: 'var(--grey-dark)'}
]);

const theme = EditorView.theme({
    '&': {
        padding: '1rem'
    },
    '&.cm-editor.cm-focused': {
        outline: 'none'
    }
});

const CodeEditor = (): JSX.Element => {
    const editorRef = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView>();

    useEffect(() => {
        const v = new EditorView({state: EditorState.create({
            extensions: [
                keymap.of([
                    ...closeBracketsKeymap,
                    ...defaultKeymap,
                    ...completionKeymap,
                    ...historyKeymap
                ]),
                history(),
                foldGutter(),
                indentOnInput(),
                bracketMatching(),
                closeBrackets(),
                autocompletion(),
                syntaxHighlighting(debugStyle),
                theme,
                eurydice()
            ]
        })});
        view.current = v;
        editorRef.current!.appendChild(v.dom);
    }, []);

    return (
        <div className={style['code-editor-wrapper']} ref={editorRef}></div>
    );
};

export default CodeEditor;
