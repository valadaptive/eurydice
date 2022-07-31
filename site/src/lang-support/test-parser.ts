import {SyntaxNode, Tree} from '@lezer/common';
import {Text} from '@codemirror/state';
import {parser} from './language';

const printNode = (node: Tree | SyntaxNode, src: string | Text): string => {
    const tree = (node instanceof Tree) ? node : node.toTree();
    let out = '';
    tree.iterate({
        enter: node => {
            if (node.node.firstChild) {
                out += '(' + node.type.name + ' ';
            } else {
                const stringSlice = src instanceof Text ?
                    src.sliceString(node.from, node.to) :
                    src.slice(node.from, node.to);
                out += stringSlice + ' ';
            }
            return true;
        },
        leave: node => {
            if (node.node.firstChild) out += ')';
        }
    });
    return out;
};

// used to make sure the Lezer grammar works properly
const testParseString = (str: string): string => {
    return printNode(parser.parse(str), str);
};

export default testParseString;
