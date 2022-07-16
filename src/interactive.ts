import parse from './parse';
import evaluate from './evaluate';
import printValue from './print';

import * as readline from 'readline';
const rl = readline.createInterface({input: process.stdin, output: process.stdout, prompt: '> '});
rl.prompt();
rl.on('line', text => {
    try {
        const evaluated = evaluate(parse(text));
        process.stdout.write(printValue(evaluated) + '\n');
    } catch (err) {
        process.stdout.write((err as Error).message + '\n');
    }
    rl.prompt();
});
