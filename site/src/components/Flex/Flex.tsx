import style from './style.scss';

import type {JSX, ComponentChildren} from 'preact';
import classNames from 'classnames';

const FlexHorizontal = (props: {
    children: ComponentChildren,
    style?: string,
    class?: string
}): JSX.Element => (
    <div class={classNames(style.flexh, props.class)} style={props.style}>
        {props.children}
    </div>
);

const FlexHorizontalMobile = (props: {
    children: ComponentChildren,
    style?: string,
    class?: string
}): JSX.Element => (
    <div className={classNames(style.flexhm, props.class)} style={props.style}>
        {props.children}
    </div>
);

const FlexVertical = (props: {
    children: ComponentChildren,
    style?: string,
    class?: string
}): JSX.Element => (
    <div className={classNames(style.flexv, props.class)} style={props.style}>
        {props.children}
    </div>
);

const FlexFill = (props: {
    children: ComponentChildren,
    style?: string,
    class?: string
}): JSX.Element => (
    <div className={classNames(style.flexf, props.class)} style={props.style}>
        {props.children}
    </div>
);

export {FlexHorizontal, FlexHorizontalMobile, FlexVertical, FlexFill};
