import style from './style.scss';

import type {JSX} from 'preact';

const Icon = (props: {children: string, style?: string}): JSX.Element => (
    <div class={style.icon} style={props.style}>
        {props.children}
    </div>
);

export default Icon;
