const webpack = require('webpack');
const {resolve} = require('path');
const {existsSync} = require('fs');
const autoprefixer = require('autoprefixer');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const RemoveEmptyScriptsPlugin = require('webpack-remove-empty-scripts');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const createBabelConfig = require('./babel-config');
const {merge} = require('webpack-merge');
const SizePlugin = require('size-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const {BundleAnalyzerPlugin} = require('webpack-bundle-analyzer');
const HtmlPlugin = require('html-webpack-plugin');
const svgoConfig = require('./svgo.config.js');

const isProd = process.env.NODE_ENV === 'production';
const cwd = '.';


function baseConfig () {
    const src = 'src';
    const isWatch = !!process.env.WEBPACK_SERVE;
    const source = dir => resolve(src, dir);

    const browsers = 'defaults';
    const postcssPlugins = [autoprefixer({overrideBrowserslist: browsers})];
    const internalStyles = [source('components'), source('routes'), source('icons')];
    const copyPatterns = [
        // copy any static files
        existsSync(source('assets')) && {from: 'assets', to: 'assets'},
        // copy files from static to build directory
        existsSync(source('static')) && {
            from: resolve(source('static')),
            to: '.'
        }
    ].filter(Boolean);

    return {
        entry: source('index.tsx'),

        output: {
            path: resolve(cwd, 'public'),
            publicPath: '',
            filename: isProd ? '[name].[chunkhash:5].js' : '[name].js',
            chunkFilename: '[name].chunk.[chunkhash:5].js'
        },

        resolve: {
            modules: ['node_modules'],
            extensions: [
                '.mjs',
                '.js',
                '.jsx',
                '.ts',
                '.tsx',
                '.json',
                '.pcss',
                '.scss',
                '.sass',
                '.css',
                '.wasm'
            ],
            alias: {
                style: source('style'),
                // preact-compat aliases for supporting React dependencies:
                react: 'preact-compat',
                'react-dom': 'preact-compat',
                'preact-compat': 'preact-compat',
                'react-addons-css-transition-group': 'preact-css-transition-group'
            }
        },

        module: {
            rules: [
                {
                    // ES2015
                    enforce: 'pre',
                    test: /\.m?[jt]sx?$/,
                    resolve: {mainFields: ['module', 'jsnext:main', 'browser', 'main']},
                    type: 'javascript/auto',
                    loader: 'babel-loader',
                    options: Object.assign(
                        {babelrc: false},
                        createBabelConfig(browsers)
                    )
                },
                {
                    // SASS
                    enforce: 'pre',
                    test: /\.s[ac]ss$/,
                    use: [
                        {
                            loader: 'sass-loader',
                            options: {
                                sourceMap: true
                            }
                        }
                    ]
                },
                {
                    // User styles
                    test: /\.(css|s[ac]ss)$/,
                    include: internalStyles,
                    use: [
                        isWatch ?
                            'style-loader' :
                            MiniCssExtractPlugin.loader,
                        {
                            loader: 'css-loader',
                            options: {
                                modules: {
                                    localIdentName: '[local]__[hash:base64:5]'
                                },
                                importLoaders: 1,
                                sourceMap: true
                            }
                        },
                        {
                            loader: 'postcss-loader',
                            options: {
                                sourceMap: true,
                                postcssOptions: {
                                    plugins: postcssPlugins
                                }
                            }
                        }
                    ]
                },
                {
                    // External / `node_module` styles
                    test: /\.(css|s[ac]ss)$/,
                    exclude: internalStyles,
                    use: [
                        isWatch ?
                            'style-loader' :
                            MiniCssExtractPlugin.loader,
                        {
                            loader: 'css-loader',
                            options: {
                                sourceMap: true
                            }
                        },
                        {
                            loader: 'postcss-loader',
                            options: {
                                sourceMap: true,
                                postcssOptions: {
                                    plugins: postcssPlugins
                                }
                            }
                        }
                    ],
                    // Don't consider CSS imports dead code even if the
                    // containing package claims to have no side effects.
                    // Remove this when webpack adds a warning or an error for this.
                    // See https://github.com/webpack/webpack/issues/6571
                    sideEffects: true
                },
                {
                    test: /\.(xml|txt|md)$/,
                    type: 'asset/source'
                },
                {
                    test: /\.svg$/i,
                    issuer: /\.(css|s[ac]ss)$/,
                    type: isProd ? 'asset/resource' : 'asset/inline'
                },
                {
                    test: /\.(woff2?|ttf|eot|jpe?g|png|webp|gif|mp4|mov|ogg|webm)(\?.*)?$/i,
                    type: isProd ? 'asset/resource' : 'asset/inline'
                },
                {
                    test: /\.svg$/i,
                    issuer: /\.[jt]sx?$/,
                    use: [
                        {
                            loader: 'babel-loader',
                            options: Object.assign(
                                {babelrc: false},
                                createBabelConfig(browsers)
                            )
                        },
                        {
                            loader: '@svgr/webpack',
                            options: {
                                babel: false,
                                jsxRuntime: 'automatic',
                                replaceAttrValues: {
                                    '#fff': 'currentColor'
                                },
                                svgo: true,
                                svgoConfig
                            }
                        }
                    ]
                }
            ]
        },

        plugins: [
            new webpack.NoEmitOnErrorsPlugin(),
            new webpack.DefinePlugin(
                Object.keys(process.env)
                    .filter(key => /^PREACT_APP_/.test(key))
                    .reduce(
                        (env, key) => {
                            env[`process.env.${key}`] = JSON.stringify(process.env[key]);
                            return env;
                        },
                        {
                            'process.env.NODE_ENV': JSON.stringify(
                                isProd ? 'production' : 'development'
                            )
                        }
                    )
            ),
            new webpack.ProvidePlugin({
                h: ['preact', 'h'],
                Fragment: ['preact', 'Fragment']
            }),
            // Fix for https://github.com/webpack-contrib/mini-css-extract-plugin/issues/151
            new RemoveEmptyScriptsPlugin(),
            // Extract CSS
            new MiniCssExtractPlugin({
                filename: isProd ? '[name].[contenthash:5].css' : '[name].css',
                chunkFilename: isProd ?
                    '[name].chunk.[contenthash:5].css' :
                    '[name].chunk.css'
            }),
            ProgressBarPlugin({
                format:
                    // eslint-disable-next-line max-len
                    '\u001b[97m\u001b[44m Build \u001b[49m\u001b[39m [:bar] \u001b[32m\u001b[1m:percent\u001b[22m\u001b[39m (:elapseds) \u001b[2m:msg\u001b[22m',
                renderThrottle: 100,
                summary: false,
                clear: true
            }),
            new ForkTsCheckerWebpackPlugin(),
            isProd && new webpack.LoaderOptionsPlugin({minimize: true}),
            isProd && new webpack.optimize.ModuleConcatenationPlugin(),
            new HtmlPlugin({
                template: source('index.html'),
                filename: 'index.html'
            }),
            copyPatterns.length !== 0 &&
                new CopyWebpackPlugin({
                    patterns: copyPatterns
                })
        ].filter(Boolean),

        optimization: {
            splitChunks: {
                minChunks: 3
            },
            moduleIds: isProd ? 'deterministic' : 'named'
        },

        mode: isProd ? 'production' : 'development',

        devtool: isWatch ? 'eval-cheap-module-source-map' : 'source-map',

        node: false
    };
}

function prodConfig () {
    const limit = 200 * 1000; // 200kb
    const prodConfig = {
        performance: {
            hints: 'warning',
            maxAssetSize: limit,
            maxEntrypointSize: limit
        },

        plugins: [
            new SizePlugin()
        ],

        cache: false,

        optimization: {
            minimizer: [
                new TerserPlugin({
                    parallel: true,
                    terserOptions: {
                        output: {comments: false},
                        mangle: true,
                        compress: {
                            keep_fargs: false,
                            pure_getters: true,
                            hoist_funs: true,
                            pure_funcs: [
                                'classCallCheck',
                                '_classCallCheck',
                                '_possibleConstructorReturn',
                                'Object.freeze',
                                'invariant',
                                'warning'
                            ]
                        }
                    },
                    extractComments: false
                }),
                new CssMinimizerPlugin()
            ]
        }
    };

    if (process.env.ANALYZE) {
        prodConfig.plugins.push(new BundleAnalyzerPlugin());
    }

    return prodConfig;
}

function devConfig () {
    return {
        infrastructureLogging: {
            level: 'info'
        },

        devServer: {
            hot: true,
            compress: true,
            https: false,
            port: process.env.PORT,
            host: process.env.HOST || '0.0.0.0',
            historyApiFallback: true
        }
    };
}

module.exports = merge(
    baseConfig(),
    (isProd ? prodConfig : devConfig)()
);
