/* eslint-disable no-console */
import parse, {sexpr} from './parse';
import evaluate from './evaluate';
import {readFileSync} from 'fs';

const parseArgs = (args: string[]): {positional: string[], named: Partial<Record<string, string>>} => {
    const positional: string[] = [];
    const parsedArgs: Partial<Record<string, string>> = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const namedMatch = arg.match(/--([a-zA-Z0-9_-]+)=(.+)/);
        if (namedMatch) {
            parsedArgs[namedMatch[1]] = namedMatch[2];
            continue;
        }
        positional.push(arg);
    }
    return {positional, named: parsedArgs};
};

const args = parseArgs(process.argv.slice(2));
const input = ('evaluate' in args.named) ? args.named.evaluate! : readFileSync(args.positional[0], {encoding: 'utf-8'});

console.log(sexpr(parse(input)));
console.log(evaluate(parse(input)));
