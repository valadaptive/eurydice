import style from './style.scss';
import variables from '../../global.module.scss';

import type {JSX} from 'preact';
import {Component} from 'preact';

import Logo from '../Logo/Logo.svg';
import Icon from '../Icon/Icon';
import {FlexHorizontal, FlexVertical} from "../Flex/Flex";

const items = (
    <><a href="/docs/installation">Installation</a><a href="/docs">Documentation</a><a>Source</a></>
);

interface IState {
    hidden: boolean,
    width: number;
    scroll: number;
}

class Header extends Component {
    state: IState;

    constructor () {
        super();
        this.state = {hidden: true, width: document.body.clientWidth, scroll: window.pageYOffset};

        window.addEventListener('resize', this.onResize.bind(this));
        window.addEventListener('scroll', this.onScroll.bind(this));
    }

    onResize (): void {
        this.setState({width: document.body.clientWidth});
    }

    onScroll (): void {
        this.setState({scroll: window.pageYOffset});
    }

    shouldComponentUpdate (_nextProps: Readonly<unknown>, nextState: Readonly<IState>): boolean {
        return (
            (this.state.hidden !== nextState.hidden) ||
            (this.state.width !== nextState.width) ||
            (this.state.scroll !== nextState.scroll)
        );
    }

    render (): JSX.Element {
        // This is probably not how you do it.
        // But ESLint does not complain, so:
        console.log(this.state);

        return (
            <div className={(this.state.scroll === 0) ? style.header : style.header + ' ' + style.headerScrolled}>
                <div className={style.logoDiv}>
                    <Logo height="24" width="24"/>
                    <p>eurydice</p>
                </div>
                {
                    (Number(variables.mobileWidth) >= document.body.clientWidth) ?
                        <FlexVertical style="align-self: center; align-items: end;">
                            <a  href="javascript:void(0)"
                                onClick={(): void => { this.setState({hidden: !this.state.hidden}); }}>
                                <FlexVertical style="justify-content: center; align-items: end; height: 24px;">
                                    <Icon style="width: min-content;">menu</Icon>
                                </FlexVertical>
                            </a>
                            {
                                !this.state.hidden && items
                            }
                        </FlexVertical> :
                        items
                }
            </div>
        );
    }
}

export default Header;
