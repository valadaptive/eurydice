module.exports = function (browsers) {
    return {
        presets: [
            [
                '@babel/preset-env',
                {
                    bugfixes: true,
                    modules: false,
                    targets: {
                        browsers
                    },
                    exclude: ['transform-regenerator']
                }
            ]
        ],
        plugins: [
            'babel-plugin-macros',
            [
                '@babel/plugin-transform-react-jsx',
                {pragma: 'h', pragmaFrag: 'Fragment'}
            ]
        ].filter(Boolean),
        overrides: [
            // Transforms to apply only to first-party code:
            {
                exclude: '**/node_modules/**',
                presets: [
                    ['@babel/preset-typescript', {jsxPragma: 'h'}]
                ]
            }
        ]
    };
};
