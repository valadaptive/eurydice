import evaluate from '../../../../src/evaluate';
import printValue from '../../../../src/print';
import parse from '../../../../src/parse';

self.onmessage = ({data: {prog}}): void => {
    try {
        const evaluated = evaluate(parse(prog));
        self.postMessage({
            success: true,
            output: printValue(evaluated)
        });
    } catch (err) {
        self.postMessage({
            success: false,
            output: (err as Error).message
        });
    }
};
