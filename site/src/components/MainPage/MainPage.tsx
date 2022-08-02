import style from './style.scss';

import type {JSX} from 'preact';

import Page from '../Page/Page';
import Logo from '../Logo/Logo.svg';
import {FlexHorizontal, FlexHorizontalMobile, FlexVertical} from '../Flex/Flex';
import CodeEditor from '../CodeEditor/CodeEditor';

const MainPage = (): JSX.Element => (
    <Page>
        <FlexVertical style="gap: 32px;">
            {/* logo */}
            <FlexHorizontalMobile class={style.logo}>
                <Logo width="100%" height="100%" style="height: 6rem; width: 6rem;"/>
                <FlexHorizontal class={style.logoTextDiv}>
                    <h1 className={style.logoText}>eurydice</h1>
                </FlexHorizontal>
            </FlexHorizontalMobile>

            {/* description */}
            <h2 className={style.description}>Half-baked programming language disguised as a dice engine</h2>

            {/* buttons */}
            <FlexHorizontal>
                <a class={style.button} href="https://github.com/valadaptive/eurydice">View source</a>
            </FlexHorizontal>
        </FlexVertical>

        {/* cards
        <FlexHorizontalMobile style="width: 100%;">
            <FlexFill class={style.card}>
                <FlexVertical>
                    <h2>Card 1</h2>
                    <p>safsdfsdgdfgsdf</p>
                </FlexVertical>
            </FlexFill>
            <FlexFill class={style.card}>
                <FlexVertical>
                    <h2>Card 2</h2>
                    <p>a asfhdsf sdjfskd as ddfs </p>
                    <a class={style.link}>See more</a>
                </FlexVertical>
            </FlexFill>
            <FlexFill class={style.card}>
                <FlexVertical>
                    <h2>Card 3</h2>
                    <p>uwu owo uwu owo uwu owo uwu owo uwu</p>
                </FlexVertical>
            </FlexFill>
        </FlexHorizontalMobile>
        */}

        {/* try */}
        <FlexVertical>
            <h2 style="font-size: 2rem;" class={style.nomargin}>Try eurydice</h2>
            <CodeEditor/>
        </FlexVertical>
    </Page>
);

export default MainPage;
