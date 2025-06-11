import { CSSToken, CSSTokenType } from './CSSToken.js';

export class CSSTokenizer {
  constructor(input, options = {}) {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
    this.options = {
      preserveWhitespace: false,
      recognizeColors: true,
      recognizeFunctions: true,
      ...options
    };
  }

  tokenize() {
    while (this.position < this.input.length) {
      const char = this.peek();
      
      if (this.isWhitespace(char)) {
        this.tokenizeWhitespace();
      } else if (char === '/' && this.peek(1) === '*') {
        this.tokenizeComment();
      } else if (char === '@') {
        this.tokenizeAtKeyword();
      } else if (char === '#') {
        this.tokenizeHash();
      } else if (this.isNumberStart(char)) {
        this.tokenizeNumber();
      } else if (char === '"' || char === "'") {
        this.tokenizeString();
      } else if (this.isIdentStart(char)) {
        this.tokenizeIdentifier();
      } else if (this.isStructuralChar(char)) {
        this.tokenizeStructural();
      } else {
        this.addError(`Unexpected character: ${char}`);
        this.advance();
      }
    }

    // Add EOF token
    this.tokens.push(CSSToken.createEOF(this.getPosition()));

    return this.tokens;
  }

  // Tokenization methods for different token types
  tokenizeWhitespace() {
    const start = this.getPosition();
    let value = '';

    while (this.position < this.input.length && this.isWhitespace(this.peek())) {
      value += this.advance();
    }

    if (this.options.preserveWhitespace) {
      this.tokens.push(CSSToken.createWhitespace(value, start));
    }
  }

  tokenizeComment() {
    const start = this.getPosition();
    let value = '';
    
    // Skip /*
    this.advance();
    this.advance();

    while (this.position < this.input.length) {
      if (this.peek() === '*' && this.peek(1) === '/') {
        this.advance(); // Skip *
        this.advance(); // Skip /
        break;
      }
      value += this.advance();
    }

    this.tokens.push(new CSSToken(
      CSSTokenType.Comment,
      value,
      start
    ));
  }

  tokenizeAtKeyword() {
    const start = this.getPosition();
    this.advance(); // Skip @
    
    let value = '';
    while (this.position < this.input.length && this.isIdentChar(this.peek())) {
      value += this.advance();
    }

    this.tokens.push(new CSSToken(
      CSSTokenType.AtKeyword,
      value,
      start
    ));
  }

  tokenizeHash() {
    const start = this.getPosition();
    this.advance(); // Skip #
    
    let value = '';
    while (this.position < this.input.length && this.isIdentChar(this.peek())) {
      value += this.advance();
    }

    // Check if it's a valid color
    if (this.options.recognizeColors && this.isValidColor(value)) {
      this.tokens.push(new CSSToken(
        CSSTokenType.Color,
        '#' + value,
        start
      ));
    } else {
      this.tokens.push(new CSSToken(
        CSSTokenType.Selector,
        '#' + value,
        start
      ));
    }
  }

  tokenizeNumber() {
    const start = this.getPosition();
    let value = '';
    let hasDecimal = false;

    // Handle sign
    if (this.peek() === '+' || this.peek() === '-') {
      value += this.advance();
    }

    // Handle digits before decimal
    while (this.position < this.input.length && this.isDigit(this.peek())) {
      value += this.advance();
    }

    // Handle decimal point and digits after
    if (this.peek() === '.') {
      hasDecimal = true;
      value += this.advance();
      while (this.position < this.input.length && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    // Check for unit
    let unit = '';
    if (this.isIdentStart(this.peek())) {
      while (this.position < this.input.length && this.isIdentChar(this.peek())) {
        unit += this.advance();
      }
    }

    if (unit) {
      this.tokens.push(new CSSToken(
        CSSTokenType.Number,
        parseFloat(value),
        start
      ));
      this.tokens.push(new CSSToken(
        CSSTokenType.Unit,
        unit,
        this.getPosition()
      ));
    } else {
      this.tokens.push(new CSSToken(
        CSSTokenType.Number,
        parseFloat(value),
        start
      ));
    }
  }

  tokenizeString() {
    const start = this.getPosition();
    const quote = this.advance();
    let value = '';

    while (this.position < this.input.length) {
      const char = this.peek();
      
      if (char === quote) {
        this.advance();
        break;
      } else if (char === '\\') {
        this.advance();
        value += this.advance();
      } else {
        value += this.advance();
      }
    }

    this.tokens.push(new CSSToken(
      CSSTokenType.String,
      value,
      start
    ));
  }

  tokenizeIdentifier() {
    const start = this.getPosition();
    let value = '';

    while (this.position < this.input.length && this.isIdentChar(this.peek())) {
      value += this.advance();
    }

    // Check if it's a function
    if (this.peek() === '(' && this.options.recognizeFunctions) {
      this.advance(); // Skip (
      this.tokens.push(new CSSToken(
        CSSTokenType.Function,
        value,
        start
      ));
      this.tokens.push(new CSSToken(
        CSSTokenType.OpenParen,
        '(',
        this.getPosition()
      ));
      return;
    }

    // Check for property or value context
    const lastToken = this.tokens[this.tokens.length - 1];
    if (lastToken && lastToken.type === CSSTokenType.Colon) {
      this.tokens.push(new CSSToken(
        CSSTokenType.Value,
        value,
        start
      ));
    } else {
      this.tokens.push(new CSSToken(
        CSSTokenType.Property,
        value,
        start
      ));
    }
  }

  tokenizeStructural() {
    const char = this.advance();
    const position = this.getPosition();

    switch (char) {
      case '{':
        this.tokens.push(new CSSToken(CSSTokenType.StartBlock, char, position));
        break;
      case '}':
        this.tokens.push(new CSSToken(CSSTokenType.EndBlock, char, position));
        break;
      case ':':
        this.tokens.push(new CSSToken(CSSTokenType.Colon, char, position));
        break;
      case ';':
        this.tokens.push(new CSSToken(CSSTokenType.Semicolon, char, position));
        break;
      case ',':
        this.tokens.push(new CSSToken(CSSTokenType.Comma, char, position));
        break;
      case '(':
        this.tokens.push(new CSSToken(CSSTokenType.OpenParen, char, position));
        break;
      case ')':
        this.tokens.push(new CSSToken(CSSTokenType.CloseParen, char, position));
        break;
    }
  }

  // Helper methods
  isWhitespace(char) {
    return /[\s\n\t\r\f]/.test(char);
  }

  isDigit(char) {
    return /[0-9]/.test(char);
  }

  isLetter(char) {
    return /[a-zA-Z]/.test(char);
  }

  isIdentStart(char) {
    return this.isLetter(char) || char === '_' || char === '-';
  }

  isIdentChar(char) {
    return this.isIdentStart(char) || this.isDigit(char);
  }

  isNumberStart(char) {
    return this.isDigit(char) || (char === '.' && this.isDigit(this.peek(1))) ||
           ((char === '+' || char === '-') && 
            (this.isDigit(this.peek(1)) || 
             (this.peek(1) === '.' && this.isDigit(this.peek(2)))));
  }

  isStructuralChar(char) {
    return /[{}:;,()]/.test(char);
  }

  isValidColor(value) {
    return /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value);
  }

  peek(offset = 0) {
    return this.input[this.position + offset] || '';
  }

  advance() {
    const char = this.input[this.position++];
    
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    
    return char;
  }

  getPosition() {
    return {
      line: this.line,
      column: this.column
    };
  }

  addError(message) {
    this.tokens.push(CSSToken.createError(
      message,
      this.getPosition()
    ));
  }
}