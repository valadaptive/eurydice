import style from './style.scss';

import type {JSX, ComponentChildren} from 'preact';

const FlexHorizontal = (props: {
    children: ComponentChildren,
    style?: string,
    class?: string
}): JSX.Element => (
    <div class={props.class + ' ' + style.flexh} style={props.style}>
        {props.children}
    </div>
);

const FlexHorizontalMobile = (props: {
    children: ComponentChildren,
    style?: string,
    class?: string
}): JSX.Element => (
    <div className={props.class + ' ' + style.flexhm} style={props.style}>
        {props.children}
    </div>
);

const FlexVertical = (props: {
    children: ComponentChildren,
    style?: string,
    class?: string
}): JSX.Element => (
    <div className={props.class + ' ' + style.flexv} style={props.style}>
        {props.children}
    </div>
);

const FlexFill = (props: {
    children: ComponentChildren,
    style?: string,
    class?: string
}): JSX.Element => (
    <div className={props.class + ' ' + style.flexf} style={props.style}>
        {props.children}
    </div>
);

export {FlexHorizontal, FlexHorizontalMobile, FlexVertical, FlexFill};
