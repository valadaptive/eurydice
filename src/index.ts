/* eslint-disable no-console */
import parse, {sexpr} from './parse';
import evaluate from './evaluate';

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
const input = process.argv[2] as string;

console.log(evaluate(parse(input)));
console.log(sexpr(parse(input)));
