import style from './style.scss';
import variables from '../../global.module.scss';
import pkg from '/package.json';

import type {JSX} from 'preact';
import {Component} from 'preact';
import classNames from 'classnames';

import Logo from '../Logo/Logo.svg';
import Icon from '../Icon/Icon';
import {FlexHorizontal, FlexVertical} from '../Flex/Flex';

const items = (
    <><a href="https://github.com/valadaptive/eurydice">Source</a></>
);

interface IState {
    hidden: boolean,
    width: number;
    atPageTop: boolean;
}

class Header extends Component {
    state: IState;

    constructor () {
        super();
        this.state = {
            hidden: true,
            width: document.body.clientWidth,
            atPageTop: window.pageYOffset === 0
        };

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
            (this.state.atPageTop !== nextState.atPageTop)
        );
    }

    render (): JSX.Element {
        return (
            <div className={classNames(style.header, {[style.headerScrolled]: !this.state.atPageTop})}>
                <FlexHorizontal class={style.logoDiv}>
                    <Logo height="100%" width="100%" style="width: 1.15rem; height: 1.15rem;"/>
                    <a href="/">eurydice <sup>v{pkg.version}</sup></a>
                </FlexHorizontal>
                {
                    (Number(variables.mobileWidth) >= this.state.width) ?
                        <FlexVertical style="align-self: center; align-items: end;">
                            <a href="javascript:void(0)"
                                onClick={(): void => {
                                    this.setState({hidden: !this.state.hidden});
                                }}>
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
