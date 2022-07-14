const getLineIndices = (str: string, index: number): {
    line: number,
    column: number,
    lineStartIndex: number,
    lineEndIndex: number
} => {
    let line = 0;
    let column = 0;
    let lineStartIndex = 0;
    let lineEndIndex = 0;
    let i = 0;
    for (; i < index; i++) {
        if (str[i] === '\n') {
            line++;
            column = 0;
            lineStartIndex = i + 1;
        }
        column++;
    }
    for (; i <= str.length; i++) {
        lineEndIndex = i;
        if (str[i] === '\n') {
            break;
        }
    }
    return {line, column, lineStartIndex, lineEndIndex};
};

const formatError = <T extends Error>(error: T, source: string, start: number, end: number): T => {
    const {line, column, lineStartIndex, lineEndIndex} =
        getLineIndices(source, start);
    let newMessage = `Line ${line + 1} column ${column}: ${error.message}\n`;
    newMessage += source.slice(lineStartIndex, lineEndIndex) + '\n';
    newMessage += '-'.repeat(column - 1) + '^'.repeat(end - start);
    error.message = newMessage;
    throw error;
};

export default formatError;
