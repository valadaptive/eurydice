/* eslint-disable no-console */
import parse, {sexpr} from './parse';
import evaluate from './evaluate';

const input = process.argv[2];

console.log(sexpr(parse(input)));
console.log(evaluate(parse(input)));
