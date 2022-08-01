import style from './style.scss';

import type {JSX} from 'preact';

import Page from '../Page/Page';
import Logo from '../Logo/Logo.svg';
import {FlexHorizontal, FlexHorizontalMobile, FlexVertical, FlexFill} from '../Flex/Flex';

const MainPage = (): JSX.Element => (
    <Page>
        <FlexVertical style="gap: 32px;">
            {/* logo */}
            <FlexHorizontalMobile class={style.logo}>
                <Logo width="96" height="96" style="flex-shrink: 0;"/>
                <FlexHorizontal class={style.logoTextDiv}>
                    <h1 className={style.logoText}>eurydice</h1>
                    <p>v0.0.1</p>
                </FlexHorizontal>
            </FlexHorizontalMobile>

            {/* description */}
            <h2 className={style.description}>There should probably be a short description here</h2>

            {/* buttons */}
            <FlexHorizontal>
                <a class={style.button}>Get started</a>
                <a class={style.button}>View source</a>
            </FlexHorizontal>
        </FlexVertical>

        {/* cards */}
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

        {/* try */}
        <FlexVertical>
            <h2 style="font-size: 36px;" class={style.nomargin}>Try eurydice</h2>
        </FlexVertical>
    </Page>
);

export default MainPage;
