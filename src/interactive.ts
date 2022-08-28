import parse from './parse.ts';
import evaluate from './evaluate.ts';
import printValue from './print.ts';

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
