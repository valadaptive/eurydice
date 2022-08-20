module.exports = {
    plugins: [
        '@typescript-eslint'
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    env: {
        es6: true,
        node: true
    },
    globals: {

    },
    overrides: [
        {
            files: ['src/**/*'],
            parserOptions: {
                'project': './tsconfig.json'
            },
            extends: [
                'plugin:@typescript-eslint/recommended-requiring-type-checking'
            ],
            env: {
                browser: true,
                commonjs: true,
                node: false
            },
            rules: {
                '@typescript-eslint/no-var-requires': 'error',
                '@typescript-eslint/ban-types': 'off',
                '@typescript-eslint/unbound-method': 'off',
                '@typescript-eslint/no-unnecessary-condition': 'error'
            }
        },
        {
            files: ['*.ts', '*.tsx'],
            rules: {
                '@typescript-eslint/explicit-function-return-type': ['error'],
                '@typescript-eslint/no-non-null-assertion': 'off'
            }
        }
    ],
    rules: {
        'no-prototype-builtins': 'off',
        '@typescript-eslint/no-unused-vars': ['error', {'args': 'after-used', 'argsIgnorePattern': '_.*$'}],
        'no-constant-condition': ['error', {'checkLoops': false}],

        'array-bracket-spacing': ['error', 'never'],
        'block-spacing': ['error', 'always'],
        'camelcase': ['error', {
            properties: 'never'
        }],
        'comma-dangle': ['error', 'never'],
        'comma-spacing': ['error'],
        'comma-style': ['error'],
        'eol-last': ['error', 'always'],
        'eqeqeq': ['warn'],
        'func-call-spacing': ['error', 'never'],
        '@typescript-eslint/indent': ['error', 4, {'SwitchCase': 1}],
        'key-spacing': ['error', {
            beforeColon: false,
            afterColon: true,
            mode: 'strict'
        }],
        'keyword-spacing': ['error', {
            before: true,
            after: true
        }],
        'linebreak-style': ['error', 'unix'],
        'max-len': [1, {
            code: 120,
            tabWidth: 4,
            ignoreUrls: true,
            ignoreTemplateLiterals: true
        }],
        'new-parens': ['error'],
        'newline-per-chained-call': ['error'],
        'no-console': ['error'],
        'no-mixed-operators': ['error'],
        'no-multiple-empty-lines': ['error', {
            max: 2,
            maxBOF: 0,
            maxEOF: 0
        }],
        'no-throw-literal': ['error'],
        'no-trailing-spaces': ['error', {skipBlankLines: true}],
        'no-unneeded-ternary': ['error'],
        '@typescript-eslint/no-var-requires': 'off',
        'object-curly-spacing': ['error'],
        'object-property-newline': ['error', {
            allowMultiplePropertiesPerLine: true
        }],
        'operator-linebreak': ['error', 'after'],
        'prefer-const': ['error'],
        'quotes': ['error', 'single', {
            allowTemplateLiterals: true,
            avoidEscape: true
        }],
        '@typescript-eslint/semi': ['error', 'always'],
        'semi-spacing': ['error'],
        'space-before-function-paren': ['error', 'always'],
        'space-in-parens': ['error'],
        'space-infix-ops': ['error'],
        'space-unary-ops': ['error']
    },
    parserOptions: {
        'ecmaVersion': 11,
        'sourceType': 'module',
        'parser': '@typescript-eslint/parser',
        'tsconfigRootDir': __dirname
    },
    ignorePatterns: [
        'build',
        'generated'
    ]
};
