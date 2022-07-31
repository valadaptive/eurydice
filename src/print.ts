import type {Value} from './evaluate';

const printValue = (value: Value): string => {
    switch (typeof value) {
        case 'number': return value.toString();
        case 'string': return JSON.stringify(value);
        case 'object': {
            if (value === null) return '()';
            return `[${value.join('. ')}]`;
        }
        // TODO: store debug info for functions and map back to source
        case 'function': return '[function]';
    }
};

export default printValue;
