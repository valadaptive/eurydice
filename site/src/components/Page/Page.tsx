import style from './style.scss';

import type {JSX, ComponentChildren} from 'preact';

import Header from '../Header/Header';

const Page = (props: {children: ComponentChildren}): JSX.Element => (
    <>
        <Header />
        <div className={style.page}>
            {props.children}
        </div>
    </>
);

export default Page;
