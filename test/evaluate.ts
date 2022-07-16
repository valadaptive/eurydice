import evaluate, {wrapFunction, expectNull, Value, EnvValue} from '../src/evaluate';
import parse from '../src/parse';
import {expect} from 'chai';

const evaluateString = (str: string, environment?: Partial<Record<string, EnvValue>>): Value =>
    evaluate(parse(str), environment);

suite('interpreter', () => {
    suite('builtins', () => {
        suite('operators', () => {
            test('+', () => {
                const result = evaluateString('3 + 2');
                expect(result).equals(5);
            });

            test('-', () => {
                const result = evaluateString('3 - 2');
                expect(result).equals(1);
            });

            test('*', () => {
                const result = evaluateString('3 * 2');
                expect(result).equals(6);
            });

            test('/', () => {
                const result = evaluateString('3 / 2');
                expect(result).equals(1.5);
            });

            test('**', () => {
                const result = evaluateString('3 ** 2');
                expect(result).equals(9);
            });

            test('%', () => {
                expect(evaluateString('3 % 2')).equals(1);
                expect(evaluateString('(0 - 3) % 2')).equals(1);
            });

            test('<', () => {
                expect(evaluateString('3 < 2')).equals(0);
                expect(evaluateString('2 < 3')).equals(1);
                expect(evaluateString('3 < 3')).equals(0);
            });

            test('<=', () => {
                expect(evaluateString('3 <= 2')).equals(0);
                expect(evaluateString('2 <= 3')).equals(1);
                expect(evaluateString('3 <= 3')).equals(1);
            });

            test('>', () => {
                expect(evaluateString('3 > 2')).equals(1);
                expect(evaluateString('2 > 3')).equals(0);
                expect(evaluateString('3 > 3')).equals(0);
            });

            test('>=', () => {
                expect(evaluateString('3 >= 2')).equals(1);
                expect(evaluateString('2 >= 3')).equals(0);
                expect(evaluateString('3 >= 3')).equals(1);
            });

            test('=', () => {
                expect(evaluateString('3 = 2')).equals(0);
                expect(evaluateString('3 = 3')).equals(1);
                expect(evaluateString('(1 + 2) = 3')).equals(1);
            });

            test('!=', () => {
                expect(evaluateString('3 != 2')).equals(1);
                expect(evaluateString('3 != 3')).equals(0);
                expect(evaluateString('(1 + 2) != 3')).equals(0);
            });

            test('|', () => {
                expect(evaluateString('1 | 0')).equals(1);
                expect(evaluateString('1 | 1')).equals(1);
                expect(evaluateString('0 | 0')).equals(0);
                expect(evaluateString('3 | 2')).equals(3);
            });

            test('&', () => {
                expect(evaluateString('1 & 0')).equals(0);
                expect(evaluateString('1 & 1')).equals(1);
                expect(evaluateString('0 & 0')).equals(0);
                expect(evaluateString('3 & 2')).equals(2);
            });

            test('!', () => {
                expect(evaluateString('!1')).equals(0);
                expect(evaluateString('!0')).equals(1);
                expect(evaluateString('!!0')).equals(0);
                expect(evaluateString('!2')).equals(-1);
            });

            test('...', () => {
                expect(evaluateString('...[1. 2. 3]')).equals(6);
            });
        });

        test('floor', () => {
            expect(evaluateString('floor 1.2')).equals(1);
            expect(evaluateString('floor 1.7')).equals(1);
            expect(evaluateString('floor 1')).equals(1);
            expect(evaluateString('floor (0 - 1.2)')).equals(-2);
            expect(evaluateString('floor (0 - 1.7)')).equals(-2);
        });

        test('ceil', () => {
            expect(evaluateString('ceil 1.2')).equals(2);
            expect(evaluateString('ceil 1.7')).equals(2);
            expect(evaluateString('ceil 1')).equals(1);
            expect(evaluateString('ceil (0 - 1.2)')).equals(-1);
            expect(evaluateString('ceil (0 - 1.7)')).equals(-1);
        });

        test('round', () => {
            expect(evaluateString('round 1.2')).equals(1);
            expect(evaluateString('round 1.7')).equals(2);
            expect(evaluateString('round 1')).equals(1);
            expect(evaluateString('round (0 - 1.2)')).equals(-1);
            expect(evaluateString('round (0 - 1.7)')).equals(-2);
        });

        test('abs', () => {
            expect(evaluateString('abs (0 - 3)')).equals(3);
            expect(evaluateString('abs 3')).equals(3);
        });

        test('sort', () => {
            expect(evaluateString('sort [1. 11. 5. 23. 4]')).eql([1, 4, 5, 11, 23]);
        });

        test('len', () => {
            expect(evaluateString('len [1. 11. 5. 23. 4]')).equals(5);
        });

        test('map', () => {
            expect(evaluateString('map [1. 11. 5. 23. 4], (@x x * 2)')).eql([2, 22, 10, 46, 8]);
        });

        test('reduce', () => {
            expect(evaluateString('reduce [1. 11. 5. 23. 4], (@prev @cur (cur * 2) + prev), 2')).equals(90);
        });

        test('reroll', () => {
            const sequence = [1, 7, 4, 15, 2, 3];
            let i = 0;
            const seq = wrapFunction((_) => {
                return sequence[i++];
            }, [expectNull]);
            expect(evaluateString('reroll (@_ seq()), (@x x > 10)', {
                seq
            })).equals(15);
        });

        test('explode', () => {
            const sequence = [7, 1, 6, 15, 2, 3];
            let i = 0;
            const seq = wrapFunction((_) => {
                return sequence[i++];
            }, [expectNull]);
            expect(evaluateString('explode 2, (@_ seq()), (@x x > 5)', {
                seq
            })).eql([7, 1, 6, 15, 2]);
        });

        test('drop', () => {
            expect(evaluateString('drop (@_ [7. 2. 2]), [3. 7. 9. 2. 15. 4. 5. 7]')).eql([3, 9, 15, 4, 5, 7]);
        });

        test('highest', () => {
            expect(evaluateString('highest 3, [3. 7. 9. 2. 15. 4. 5. 7]')).members([7, 9, 15]);
        });

        test('lowest', () => {
            expect(evaluateString('lowest 3, [3. 7. 9. 2. 15. 4. 5. 7]')).members([2, 3, 4]);
        });

        test('min', () => {
            expect(evaluateString('min [3. 7. 9. 2. 15. 4. 5. 7]')).equals(2);
        });

        test('max', () => {
            expect(evaluateString('max [3. 7. 9. 2. 15. 4. 5. 7]')).equals(15);
        });
    });

    test('mathematical operator precedence', () => {
        expect(evaluateString('1 + 2 * 6 % 4 + 3 ** 3 / 9')).equals(4);
    });

    test('logical operator precedence', () => {
        expect(evaluateString('1 < 2 = 3 > 2')).equals(1);
    });

    test('numeric apply', () => {
        expect(evaluateString('5 (2 + 2)')).eql([4, 4, 4, 4, 4]);
    });

    test('let bindings', () => {
        expect(evaluateString('let x 5 in [x. x]')).eql([5, 5]);
    });

    test('multi-variable let bindings', () => {
        expect(evaluateString('let x 5 and y 3 in [x. y. x. y]')).eql([5, 3, 5, 3]);
    });

    test('self-referential let bindings', () => {
        expect(() => evaluateString('let x 5 and y x + 1 in [x. y. x. y]')).throws();
    });

    test('parameter binding scope', () => {
        expect(evaluateString('(@x [x. (@x x * 2) 3. x]) 2, 2')).equals(2);
    });

    test('closed-over variables', () => {
        expect(evaluateString('let x 5 in (let closure @x @y [x. y] in closure 3), 2')).eql([3, 2]);
    });

    test('if/else', () => {
        expect(evaluateString('map [0. 2. 4. 1. 3], (@x if x > 2 then 5 else 2)')).eql([2, 2, 5, 2, 5]);
    });
});
