import style from './style.scss';

import type {JSX} from 'preact';
import {useRef, useEffect, useLayoutEffect, useMemo} from 'preact/hooks';

import {EditorState, Text, Extension, StateEffect} from '@codemirror/state';
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

interface ICodeEditorProps {
    doc?: Text | string,
    readonly: boolean,
    highlight: boolean,
    onUpdate?: (doc: Text) => void;
}

const makeExtensionConfig = (readonly: boolean, highlight: boolean, onUpdate?: (doc: Text) => void): Extension => [
    keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...completionKeymap,
        ...historyKeymap
    ]),
    readonly ? [
        EditorView.contentAttributes.of({contenteditable: 'false'})
    ] : [
        indentOnInput(),
        history(),
        closeBrackets(),
        autocompletion(),
        highlightActiveLine()
    ],
    highlight ? [
        syntaxHighlighting(debugStyle),
        eurydice()
    ] : [],
    foldGutter(),
    bracketMatching(),
    lineNumbers(),
    theme,
    EditorView.lineWrapping,
    EditorView.updateListener.of((e) => {
        if (!e.docChanged) return;
        if (onUpdate !== undefined) {
            onUpdate(e.state.doc);
        }
    })
];

const CodeView = ({doc, readonly, highlight, onUpdate}: ICodeEditorProps): JSX.Element => {
    const editorViewRef = useRef<EditorView>();
    const editorRef = useRef<HTMLDivElement>(null);

    // Update the list of extensions when props that affect those extensions change
    const extensions = useMemo(
        () => makeExtensionConfig(readonly, highlight, onUpdate),
        [readonly, highlight, onUpdate]
    );

    // Initialize editor state
    useLayoutEffect(() => {
        const editorState = EditorState.create({
            extensions,
            doc
        });

        editorViewRef.current = new EditorView({
            state: editorState,
            parent: editorRef?.current ?? undefined
        });
    }, []);

    const editorView = editorViewRef.current;

    // If the extensions change (or on first run), update the editor view
    useEffect(() => {
        editorView?.dispatch({effects: StateEffect.reconfigure.of(extensions)});
    }, [extensions]);

    // If the doc changes, update the editor view
    // TODO: there's a potential infinite loop here if onUpdate keeps setting doc to something else
    useEffect(() => {
        if (editorView?.state.doc === doc) return;
        // Compare strings as fallback
        if (editorView?.state.doc.toString() === doc) return;
        editorView?.dispatch({
            changes: {
                from: 0,
                to: editorView.state.doc.length,
                insert: doc
            }
        });
    }, [doc]);

    // The rendered component doesn't depend on any props or anything; we update the editor state itself based on props
    // via useEffect. That means we can just never recompute the returned component.
    return useMemo(() => <div className={style['code-editor-wrapper']} ref={editorRef}></div>, undefined);
};

export default CodeView;
