import style from './style.scss';

import type {JSX} from 'preact';
import {useRef, useEffect} from 'preact/hooks';

import {EditorState} from '@codemirror/state';
import {EditorView, highlightActiveLine, keymap, lineNumbers} from '@codemirror/view';
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
    const outputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const worker = new Worker(new URL('./worker.ts', import.meta.url));

        const outputView = new EditorView({
            state: EditorState.create({
                extensions: [
                    foldGutter(),
                    EditorView.lineWrapping,
                    theme,
                    EditorView.editable.of(false)
                ]
            })
        });

        worker.addEventListener('message', (event) => {
            if (event.data.output) {
                outputView.dispatch({changes: {from: 0, to: outputView.state.doc.length, insert: event.data.output}});
            }
        });

        const editorView = new EditorView({
            state: EditorState.create({
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
                    lineNumbers(),
                    EditorView.lineWrapping,
                    closeBrackets(),
                    autocompletion(),
                    syntaxHighlighting(debugStyle),
                    highlightActiveLine(),
                    theme,
                    eurydice(),
                    EditorView.updateListener.of((e) => {
                        worker.postMessage({prog: e.state.doc.toString()});
                        outputView.dispatch({changes: {from: 0, to: outputView.state.doc.length}});
                    })
                ]
            })
        });
        editorRef.current!.appendChild(editorView.dom);
        outputRef.current!.appendChild(outputView.dom);

        return () => {
            worker.terminate();
        };
    }, []);

    return (
        <>
            <div className={style['code-editor-wrapper']} ref={editorRef}></div>
            <div className={style['code-editor-wrapper']} ref={outputRef}></div>
        </>
    );
};

export default CodeEditor;
