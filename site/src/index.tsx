import 'normalize.css';
import './global.module.scss';
import './fonts.scss';

import {render, JSX} from 'preact';
import {Router, Route} from 'preact-router';

import MainPage from './components/MainPage/MainPage';

const Main = (): JSX.Element => (
    <Router>
        <Route path="/" component={MainPage} />
    </Router>
);

render(<Main />, document.body);
