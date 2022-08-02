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

class Header extends Component<Record<string, never>, IState> {
    resizeListener: () => void;
    scrollListener: () => void;

    constructor () {
        super();
        this.state = {
            hidden: true,
            width: document.body.clientWidth,
            atPageTop: window.scrollY === 0
        };

        this.resizeListener = this.onResize.bind(this);
        this.scrollListener = this.onScroll.bind(this);

        window.addEventListener('resize', this.resizeListener);
        window.addEventListener('scroll', this.scrollListener);
    }

    onResize (): void {
        this.setState({width: document.body.clientWidth});
    }

    onScroll (): void {
        this.setState({atPageTop: window.scrollY === 0});
    }

    componentWillUnmount (): void {
        window.removeEventListener('resize', this.resizeListener);
        window.removeEventListener('scroll', this.scrollListener);
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
