import type {JSX, VNode} from 'preact';
import {Component} from 'preact';
import {Text} from '@codemirror/state';
import CodeView from '../CodeView/CodeView';
import {FlexVertical} from '../Flex/Flex';

interface ICodeEditorProps {
    doc?: string,
    readonly?: boolean,
    onUpdate?: (doc: Text) => void;
}

interface ICodeEditorState {
    doc: string,
    output: string,
    worker: Worker
}

class CodeEditor extends Component<ICodeEditorProps, ICodeEditorState> {
    state: ICodeEditorState;

    constructor (props: ICodeEditorProps) {
        super(props);

        this.state = {
            doc: props.doc || '',
            output: '',
            worker: new Worker(new URL('./worker.ts', import.meta.url))
        };

        if (props.doc) {
            this.onUpdate(props.doc);
        }

        this.state.worker.addEventListener('message', this.onExec.bind(this));
    }

    onUpdate (doc: Text | string): void {
        this.setState({doc: doc.toString()});
        this.state.worker.postMessage(doc.toString());
    }

    onExec ({data: {success: _success, output}}: { data: { success: boolean, output: string } }): void {
        this.setState({output: output});
    }

    render (): JSX.Element {
        return <>
            <FlexVertical>
                <CodeView readonly={this.props.readonly || false} highlight={true} onUpdate={this.onUpdate.bind(this)}
                    doc={this.state.doc}/>
                <CodeView readonly={true} highlight={false} doc={this.state.output}/>
            </FlexVertical>
        </>;
    }
}

export default CodeEditor;
