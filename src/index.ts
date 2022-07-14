/* eslint-disable no-console */
import parse, {sexpr} from './parse';
import evaluate, {EvaluationError} from './evaluate';
import formatError from './util/format-error';
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

const parsedInput = parse(input);
console.log(sexpr(parsedInput));
try {
    console.log(evaluate(parsedInput));
} catch (err) {
    if (err instanceof EvaluationError) throw formatError(err as Error, input, err.expr.start, err.expr.end + 1);
    throw err;
}
