// SVGO strips viewboxes by default.
// We need viewboxes for proper icon scaling, so regenerate them if they're missing.
const addViewBox = {
    type: 'visitor',
    name: 'addViewBox',
    active: true,
    description: 'generates a viewBox from SVG width and height',
    fn: () => ({
        element: {
            enter: node => {
                if (node.name === 'svg' &&
                    Number.isFinite(Number(node.attributes.width)) &&
                    Number.isFinite(Number(node.attributes.height)) &&
                    !node.attributes.viewBox) {
                    node.attributes.viewBox = `0 0 ${node.attributes.width} ${node.attributes.height}`;
                }
            }
        }
    })
};

module.exports = {
    plugins: [
        {
            name: 'preset-default',
            params: {
                overrides: {
                    removeViewBox: false
                }
            }
        },
        addViewBox
    ]
};
