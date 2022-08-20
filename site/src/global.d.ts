declare module '*.scss' {
    const content: Record<string, string>;
    export default content;
}

declare module '*.svg' {
    const svg: import('preact').ComponentConstructor<import('preact').JSX.SVGAttributes>;
    export default svg;
}

declare module '*.json' {
    const json: any;
    export default json;
}
