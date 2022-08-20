import type {JSX} from 'preact';
import {useState, useEffect} from 'preact/hooks';
import {Text} from '@codemirror/state';
import CodeView from '../CodeView/CodeView';
import {FlexVertical} from '../Flex/Flex';

interface ICodeEditorProps {
    doc?: string,
    readonly?: boolean,
    onUpdate?: (doc: Text) => void;
}

const CodeEditor = ({doc: initialDoc, readonly, onUpdate: onUpdateProp}: ICodeEditorProps): JSX.Element => {
    const [worker] = useState(() => new Worker(new URL('./worker.ts', import.meta.url)));
    useEffect(() => {
        const onExec = ({data: {success: _success, output}}: { data: { success: boolean, output: string } }): void => {
            setOutput(output);
        };
        worker.addEventListener('message', onExec);
        return () => worker.terminate();
    }, [worker]);

    const [output, setOutput] = useState('');
    const [doc, setDoc] = useState<Text | string>(initialDoc ?? '');

    const onUpdate = (doc: Text): void => {
        setDoc(doc);
        worker.postMessage(doc.toString());
        if (onUpdateProp) onUpdateProp(doc);
    };

    return <FlexVertical>
        <CodeView readonly={!!readonly} highlight={true} onUpdate={onUpdate}
            doc={doc}/>
        <CodeView readonly={true} highlight={false} doc={output}/>
    </FlexVertical>;
};

export default CodeEditor;
