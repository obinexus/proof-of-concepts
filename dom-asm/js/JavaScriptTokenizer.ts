import { JavaScriptToken, JavaScriptTokenType, JavaScriptTokenValue } from './JavaScriptToken';

export class JavaScriptTokenizerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JavaScriptTokenizerError';
    super.stack = (<any>new Error()).stack;
  }
}

export class JavaScriptTokenizer {
  private keywords = new Set(['const', 'let', 'var', 'if', 'else', 'function', 'return']);
  private operators = new Set(['=', '+', '-', '*', '/', '%', '===', '!==', '<', '>', '==', '!=']);
  private delimiters = new Set(['(', ')', '{', '}', '[', ']']);

  public tokenize(input: string): JavaScriptToken[] {
    const tokens: JavaScriptToken[] = [];
    let current = 0;

    const addToken = (type: JavaScriptTokenType, value: string) => {
      tokens.push(new JavaScriptToken(type, new JavaScriptTokenValue(value)));
    };

    input = input.trim();

    while (current < input.length) {
      const char = input[current];

      if (this.delimiters.has(char)) {
        addToken(JavaScriptTokenType.PUNCTUATOR, char);
        current++;
        continue;
      }

      if (/\s/.test(char)) {
        current++;
        continue;
      }

      if (char === ';') {
        addToken(JavaScriptTokenType.PUNCTUATOR, char);
        current++;
        continue;
      }

      if (/[a-zA-Z_$]/.test(char)) {
        let value = '';
        while (current < input.length && /[a-zA-Z0-9_$]/.test(input[current])) {
          value += input[current++];
        }
        if (this.keywords.has(value)) {
          addToken(JavaScriptTokenType.KEYWORD, value);
        } else {
          addToken(JavaScriptTokenType.IDENTIFIER, value);
        }
        continue;
      }

      if (/[0-9]/.test(char)) {
        let value = '';
        while (current < input.length && /[0-9.]/.test(input[current])) {
          value += input[current++];
        }
        addToken(JavaScriptTokenType.LITERAL, value);
        continue;
      }

      const multiCharOp = this.matchMultiCharOperator(input.slice(current));
      if (multiCharOp) {
        addToken(JavaScriptTokenType.OPERATOR, multiCharOp);
        current += multiCharOp.length;
        continue;
      }

      if (this.operators.has(char)) {
        addToken(JavaScriptTokenType.OPERATOR, char);
        current++;
        continue;
      }

      throw new JavaScriptTokenizerError(`Unexpected character: ${char}`);
    }

    addToken(JavaScriptTokenType.PUNCTUATOR, 'EOF');
    return tokens;
  }

  private matchMultiCharOperator(input: string): string | null {
    const multiCharOperators = ['===', '!==', '==', '!='];
    return multiCharOperators.find(op => input.startsWith(op)) || null;
  }
}

export { JavaScriptToken, JavaScriptTokenType, JavaScriptTokenValue };