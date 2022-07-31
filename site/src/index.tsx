import 'normalize.css';
import './colors.scss';

import {render} from 'preact';

import CodeEditor from './components/CodeEditor/CodeEditor';

render(<div>
    <CodeEditor />
</div>, document.body);
