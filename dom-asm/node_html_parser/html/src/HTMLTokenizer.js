/**
 * @typedef {'StartTag' | 'EndTag' | 'Text' | 'Comment' | 'ConditionalComment' | 'Doctype' | 'CDATA' | 'EOF'} TokenType
 */

/**
 * @typedef {Object} BaseToken
 * @property {TokenType} type
 * @property {number} start
 * @property {number} end
 * @property {number} line
 * @property {number} column
 */

/**
 * @typedef {BaseToken & {
 *   type: 'StartTag',
 *   name: string,
 *   attributes: Map<string, string>,
 *   selfClosing: boolean,
 *   namespace?: string
 * }} StartTagToken
 */

/**
 * @typedef {BaseToken & {
 *   type: 'EndTag',
 *   name: string,
 *   namespace?: string
 * }} EndTagToken
 */

/**
 * @typedef {BaseToken & {
 *   type: 'Text',
 *   content: string,
 *   isWhitespace: boolean
 * }} TextToken
 */

/**
 * @typedef {BaseToken & {
 *   type: 'Comment',
 *   data: string,
 *   isConditional?: boolean
 * }} CommentToken
 */

/**
 * @typedef {BaseToken & {
 *   type: 'ConditionalComment',
 *   condition: string,
 *   content: string
 * }} ConditionalCommentToken
 */

/**
 * @typedef {BaseToken & {
 *   type: 'Doctype',
 *   name: string,
 *   publicId?: string,
 *   systemId?: string
 * }} DoctypeToken
 */

/**
 * @typedef {BaseToken & {
 *   type: 'CDATA',
 *   content: string
 * }} CDATAToken
 */

/**
 * @typedef {BaseToken & {
 *   type: 'EOF'
 * }} EOFToken
 */

/**
 * @typedef {StartTagToken | EndTagToken | TextToken | CommentToken | ConditionalCommentToken | DoctypeToken | CDATAToken | EOFToken} HTMLToken
 */

/**
 * @typedef {Object} TokenizerError
 * @property {string} message
 * @property {'warning' | 'error'} severity
 * @property {number} line
 * @property {number} column
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {Object} TokenizerOptions
 * @property {boolean} [xmlMode]
 * @property {boolean} [recognizeCDATA]
 * @property {boolean} [recognizeConditionalComments]
 * @property {boolean} [preserveWhitespace]
 * @property {boolean} [allowUnclosedTags]
 * @property {boolean} [advanced]
 */

/**
 * @typedef {Object} TokenizerResult
 * @property {HTMLToken[]} tokens
 * @property {{ message: string, line: number, column: number }[]} errors
 */

export class HTMLTokenizer {
  /**
   * @param {string} input
   * @param {TokenizerOptions} [options={}]
   */
  constructor(input, options = {}) {
    /** @private */
    this._input = input;
    /** @private */
    this._position = 0;
    /** @private */
    this._line = 1;
    /** @private */
    this._column = 1;
    /** @private */
    this._tokens = [];
    /** @private */
    this._errors = [];
    /** @private */
    this._options = Object.assign({
      xmlMode: false,
      recognizeCDATA: true,
      recognizeConditionalComments: true,
      preserveWhitespace: false,
      allowUnclosedTags: true,
      advanced: false,
    }, options);
  }

  /**
   * @returns {TokenizerResult}
   */
  tokenize() {
    while (this._position < this._input.length) {
      const char = this._input[this._position];

      if (char === '<') {
        this.processTag();
      } else {
        this.processText();
      }
    }

    // Push EOF token
    this._tokens.push({
      type: 'EOF',
      line: this._line,
      column: this._column,
      start: this._position,
      end: this._position,
    });

    return { tokens: this._tokens, errors: this._errors };
  }

  /**
   * @param {string} char
   */
  skipUntil(char) {
    while (this._position < this._input.length && this._input[this._position] !== char) {
      this.advance();
    }
    this.advance(); // Skip target char
  }

  processTag() {
    const start = this._position;
    this.advance(); // Skip '<'

    if (this._input[this._position] === '/') {
      this.advance(); // Skip '/'
      const tagName = this.readTagName();

      if (tagName) {
        this._tokens.push({
          type: 'EndTag',
          name: tagName,
          line: this._line,
          column: this._column,
          start: start,
          end: this._position,
        });
      } else {
        this.addError('Malformed end tag', start);
      }

      this.skipUntil('>');
    } else {
      const tagName = this.readTagName();

      if (tagName) {
        const attributes = this.readAttributes();
        const selfClosing = this._input[this._position] === '/';
        if (selfClosing) this.advance(); // Skip '/'

        this._tokens.push({
          type: 'StartTag',
          name: tagName,
          attributes,
          selfClosing,
          line: this._line,
          column: this._column,
          start: start,
          end: this._position,
        });
      } else {
        this.addError('Malformed start tag', start);
      }

      this.skipUntil('>');
    }
  }

  processText() {
    const start = this._position;
    let content = '';

    while (this._position < this._input.length && this._input[this._position] !== '<') {
      content += this._input[this._position];
      this.advance();
    }

    if (content.trim() || this._options.preserveWhitespace) {
      this._tokens.push({
        type: 'Text',
        content,
        isWhitespace: !content.trim(),
        line: this._line,
        column: this._column,
        start: start,
        end: this._position,
      });
    }
  }

  /**
   * @returns {Map<string, string>}
   */
  readAttributes() {
    const attributes = new Map();

    while (this._position < this._input.length) {
      this.skipWhitespace();

      if (this.peek() === '>' || this.peek() === '/' || this.peek() === '<') break;

      const name = this.readAttributeName();
      if (!name) break;

      let value = '';
      this.skipWhitespace();

      if (this.peek() === '=') {
        this.advance();
        this.skipWhitespace();
        value = this.readAttributeValue();
      }

      attributes.set(name.toLowerCase(), value);
    }

    return attributes;
  }

  /**
   * @returns {string}
   */
  readAttributeName() {
    let name = '';
    while (this._position < this._input.length) {
      const char = this.peek();
      if (/[\s=>\/]/.test(char)) break;
      name += this.advance();
    }
    return name;
  }

  handleStartTag() {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    this.advance(); // Skip '<'
    const name = this.readTagName();
    let namespace;

    // Handle XML namespace
    if (this._options.xmlMode && name.includes(':')) {
      const [ns, localName] = name.split(':');
      namespace = ns;
    }

    if (!name) {
      this.reportError('Invalid start tag name', start, this._position);
      return;
    }

    const attributes = this.readAttributes();
    let selfClosing = false;

    this.skipWhitespace();
    if (this.peek() === '/') {
      selfClosing = true;
      this.advance();
    }

    const token = {
      type: 'StartTag',
      name: name.toLowerCase(),
      attributes,
      selfClosing,
      namespace,
      start: start,
      end: this._position,
      line: startLine,
      column: startColumn
    };

    this.addToken(token);
  }

  handleEndTag() {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    this.advance(); // Skip '</'
    const name = this.readTagName();

    if (!name) {
      this.reportError('Invalid end tag name', start, this._position);
      return;
    }

    this.skipWhitespace();
    if (this.peek() === '>') {
      this.advance();
      this.addToken({
        type: 'EndTag',
        name: name.toLowerCase(),
        start: start,
        end: this._position,
        line: startLine,
        column: startColumn
      });
    } else {
      this.reportError('Expected ">" at end of end tag', start, this._position);
    }
  }

  /**
   * @returns {HTMLToken[]}
   */
  processAdvancedTokens() {
    return this._tokens.map(token => {
      if (token.type === 'Text') {
        return {
          ...token,
          content: token.content.trim(),
          isWhitespace: /^\s*$/.test(token.content)
        };
      }
      return token;
    });
  }

  handleComment() {
    const start = this._position;
    this.advance(); // Skip '<!'
    let content = '';

    while (this._position < this._input.length && !this.match('-->')) {
      content += this.advance();
    }
    this.advance(); // Skip '-'
    this.advance(); // Skip '-'
    this.advance(); // Skip '>'

    this._tokens.push({
      type: 'Comment',
      data: content.trim(),
      line: this._line,
      column: this._column,
      start: start,
      end: this._position,
    });
  }

  handleConditionalComment() {
    const start = this._position;
    this.advance(); // Skip '<!--'
    let content = '';

    while (this._position < this._input.length && !this.match('-->')) {
      content += this.advance();
    }
    this.advance(); // Skip '-'
    this.advance(); // Skip '-'
    this.advance(); // Skip '>'

    this._tokens.push({
      type: 'ConditionalComment',
      condition: '',
      content,
      line: this._line,
      column: this._column,
      start: start,
      end: this._position,
    });
  }

  handleDoctype() {
    const start = this._position;
    this.advance(); // Skip '<!DOCTYPE'
    this.skipWhitespace();

    const name = this.readTagName();
    this._tokens.push({
      type: 'Doctype',
      name,
      line: this._line,
      column: this._column,
      start: start,
      end: this._position,
    });
  }

  readTagName() {
    let name = '';
    while (this._position < this._input.length) {
      const char = this.peek();
      if (!/[a-zA-Z0-9:-]/.test(char)) break;
      name += this.advance();
    }
    return name;
  }

  handleText() {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;
    let content = '';

    while (this._position < this._input.length) {
      const char = this.peek();
      if (char === '<') break;
      content += this.advance();
    }

    const isWhitespace = /^\s*$/.test(content);

    // Always create text tokens, but mark whitespace appropriately
    this.addToken({
      type: 'Text',
      content,
      isWhitespace,
      start: start,
      end: this._position,
      line: startLine,
      column: startColumn
    });
  }

  readAttributeValue() {
    const quote = this.peek();
    if (quote === '"' || quote === "'") {
      this.advance();
      let value = '';

      while (this._position < this._input.length) {
        if (this.peek() === quote) {
          this.advance();
          break;
        }
        value += this.advance();
      }

      return value;
    }

    // Unquoted attribute value
    let value = '';
    while (this._position < this._input.length) {
      const char = this.peek();
      if (/[\s>]/.test(char)) break;
      value += this.advance();
    }

    return value;
  }

  readQuotedString() {
    const quote = this.peek();
    if (quote !== '"' && quote !== "'") {
      return '';
    }

    this.advance();
    let value = '';

    while (this._position < this._input.length) {
      if (this.peek() === quote) {
        this.advance();
        break;
      }
      value += this.advance();
    }

    return value;
  }

  hasUnclosedTags() {
    // Check if there are any unclosed tags in the tokens
    const stack = [];
    for (const token of this._tokens) {
      if (token.type === 'StartTag' && !token.selfClosing) {
        stack.push(token.name);
      } else if (token.type === 'EndTag') {
        if (stack.length > 0 && stack[stack.length - 1] === token.name) {
          stack.pop();
        }
      }
    }
    return stack.length > 0;
  }

  handleCDATA() {
    const start = this._position;
    this.advance(); // Skip '<![CDATA['
    let content = '';

    while (this._position < this._input.length && !this.match(']]>')) {
      content += this.advance();
    }
    this.advance(); // Skip ']'
    this.advance(); // Skip ']'
    this.advance(); // Skip '>'

    this._tokens.push({
      type: 'CDATA',
      content,
      line: this._line,
      column: this._column,
      start: start,
      end: this._position,
    });
  }

  /**
   * @param {HTMLToken} token
   */
  addToken(token) {
    this._tokens.push(token);
  }

  /**
   * @param {string} char
   * @returns {boolean}
   */
  isAlphaNumeric(char) {
    return /[a-zA-Z0-9]/.test(char);
  }

  /**
   * @param {number} [offset=0]
   * @returns {string}
   */
  peek(offset = 0) {
    return this._input[this._position + offset] || '';
  }

  /**
   * @param {string} str
   * @returns {boolean}
   */
  match(str) {
    return this._input.startsWith(str, this._position);
  }

  skipWhitespace() {
    while (this.isWhitespace(this._input[this._position])) {
      this.advance();
    }
  }

  /**
   * @param {string} char
   * @returns {boolean}
   */
  isWhitespace(char) {
    return /\s/.test(char);
  }

  /**
   * @returns {string}
   */
  advance() {
    const char = this._input[this._position];
    if (char === '\n') {
      this._line++;
      this._column = 1;
    } else {
      this._column++;
    }
    this._position++;
    return char;
  }

  /**
   * @param {string} message
   * @param {number} start
   */
  addError(message, start) {
    this._errors.push({
      message,
      line: this._line,
      column: this._column,
      severity: "error",
      start: start,
      end: this._position
    });
  }

  /**
   * @param {string} message
   * @param {number} start
   * @param {number} end
   * @param {'warning' | 'error'} [severity='error']
   */
  reportError(message, start, end, severity = 'error') {
    this._errors.push({
      message,
      severity,
      start,
      end,
      line: this._line,
      column: this._column
    });
  }
}
