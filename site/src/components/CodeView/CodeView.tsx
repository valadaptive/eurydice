import style from './style.scss';

import type {JSX, RefObject} from 'preact';
import {Component, createRef} from 'preact';

import {EditorState, Text} from '@codemirror/state';
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
    doc?: string,
    readonly: boolean,
    highlight: boolean,
    onUpdate?: (doc: Text) => void;
}

interface ICodeEditorState {
    editorView: EditorView
}

class CodeView extends Component<ICodeEditorProps, ICodeEditorState> {
    state: ICodeEditorState;
    editorRef: RefObject<HTMLDivElement> = createRef<HTMLDivElement>();

    constructor (props: ICodeEditorProps) {
        super();

        console.log(props);

        const editorState = EditorState.create({
            extensions: [
                keymap.of([
                    ...closeBracketsKeymap,
                    ...defaultKeymap,
                    ...completionKeymap,
                    ...historyKeymap
                ]),
                props.readonly ? [
                    EditorView.contentAttributes.of({contenteditable: 'false'})
                ] : [
                    indentOnInput(),
                    history(),
                    closeBrackets(),
                    autocompletion(),
                    highlightActiveLine()
                ],
                !props.highlight ? [] : [
                    syntaxHighlighting(debugStyle),
                    eurydice()
                ],
                foldGutter(),
                bracketMatching(),
                lineNumbers(),
                theme,
                EditorView.lineWrapping,
                EditorView.updateListener.of((e) => {
                    if (!e.docChanged) return;
                    if (props.onUpdate !== undefined) {
                        props.onUpdate(e.state.doc);
                    }
                })
            ],
            doc: props.doc
        });

        props.doc = props.doc || '';

        this.state = {
            editorView: new EditorView({
                state: editorState
            })
        };
    }

    shouldComponentUpdate (nextProps: ICodeEditorProps, _nextState: ICodeEditorState): boolean {
        return (nextProps.doc !== this.props.doc);
    }

    render (): JSX.Element {
        this.state.editorView.dispatch({
            changes: {
                from: 0,
                to: this.state.editorView.state.doc.length,
                insert: this.props.doc
            },
            selection: this.state.editorView.state.selection
        });

        return (
            <>
                <div className={style['code-editor-wrapper']} ref={this.editorRef}></div>
            </>
        );
    }

    componentDidMount (): void {
        this.editorRef.current!.appendChild(this.state.editorView.dom);
    }
}

export default CodeView;
