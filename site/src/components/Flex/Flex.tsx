import style from './style.scss';

import type {JSX, ComponentChildren} from 'preact';

const FlexHorizontal = (props: {
    children: ComponentChildren,
    style?: string,
    class?: string
}): JSX.Element => (
    <div class={style.flexh + ' ' + props.class} style={props.style}>
        {props.children}
    </div>
);

const FlexHorizontalMobile = (props: {
    children: ComponentChildren,
    style?: string,
    class?: string
}): JSX.Element => (
    <div className={style.flexhm + ' ' + props.class} style={props.style}>
        {props.children}
    </div>
);

const FlexVertical = (props: {
    children: ComponentChildren,
    style?: string,
    class?: string
}): JSX.Element => (
    <div className={style.flexv + ' ' + props.class} style={props.style}>
        {props.children}
    </div>
);

const FlexFill = (props: {
    children: ComponentChildren,
    style?: string,
    class?: string
}): JSX.Element => (
    <div className={style.flexf + ' ' + props.class} style={props.style}>
        {props.children}
    </div>
);

export {FlexHorizontal, FlexHorizontalMobile, FlexVertical, FlexFill};
