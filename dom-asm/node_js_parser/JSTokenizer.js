// JSTokenizer.js
import { JSToken, JSTokenType, JSTokenError } from './JSToken.js';

export class TokenizerError extends Error {
    constructor(message, line, column) {
        super(`${message} at line ${line}, column ${column}`);
        this.name = 'TokenizerError';
        this.line = line;
        this.column = column;
    }
}

export class JSTokenizer {
    #input;
    #position = 0;
    #line = 1;
    #column = 1;
    #tokens = [];
    #states = new Map();
    #minimizeStates;
    #stateClasses = new Map();

    // Token pattern definitions
    static #patterns = {
        whitespace: /^\s+/,
        lineComment: /^\/\/.*/,
        blockComment: /^\/\*[\s\S]*?\*\//,
        number: /^-?\d*\.?\d+([eE][+-]?\d+)?/,
        string: /^(['"])((?:\\.|[^\\])*?)\1/,
        identifier: /^[a-zA-Z_$][a-zA-Z0-9_$]*/,
        operator: /^(?:=>|[-+*/%=<>!&|^~?:]+)/,
        punctuator: /^[{}[\]().,;]/,
        template: /^`(?:\\.|[^\\`])*`/,
        regexp: /^\/(?![*+?])(?:[^\r\n\[/\\]|\\.|\[(?:[^\r\n\]\\]|\\.)*\])+\/[gimuy]*/
    };

    // Reserved keywords
    static #keywords = new Set([
        'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
        'default', 'delete', 'do', 'else', 'export', 'extends', 'finally',
        'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'return',
        'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void',
        'while', 'with', 'yield', 'let', 'static', 'enum', 'await', 'async'
    ]);

    /**
     * @param {Object} options Tokenizer options
     * @param {boolean} [options.minimizeStates=true] Whether to use state minimization
     */
    constructor(options = {}) {
        this.#minimizeStates = options.minimizeStates ?? true;
        this.initializeStates();
    }

    /**
     * Initialize automaton states
     * @private
     */
    initializeStates() {
        // Define base states
        const initialState = { type: 'INITIAL', transitions: new Map() };
        const identifierState = { type: 'IDENTIFIER', transitions: new Map() };
        const numberState = { type: 'NUMBER', transitions: new Map() };
        const stringState = { type: 'STRING', transitions: new Map() };
        const operatorState = { type: 'OPERATOR', transitions: new Map() };
        
        // Add states to map
        this.#states.set('INITIAL', initialState);
        this.#states.set('IDENTIFIER', identifierState);
        this.#states.set('NUMBER', numberState);
        this.#states.set('STRING', stringState);
        this.#states.set('OPERATOR', operatorState);

        // Set up transitions
        this.addTransitions(initialState, [
            { pattern: /[a-zA-Z_$]/, target: 'IDENTIFIER' },
            { pattern: /[0-9]/, target: 'NUMBER' },
            { pattern: /['"`]/, target: 'STRING' },
            { pattern: /[+\-*/%=<>!&|^~?:]/, target: 'OPERATOR' }
        ]);
    }

    /**
     * Add transitions to a state
     * @private
     */
    addTransitions(state, transitions) {
        for (const { pattern, target } of transitions) {
            state.transitions.set(pattern, this.#states.get(target));
        }
    }

    /**
     * Tokenize input string
     * @param {string} input Source code to tokenize
     * @returns {JSToken[]} Array of tokens
     */
    tokenize(input) {
        this.#input = input;
        this.#position = 0;
        this.#line = 1;
        this.#column = 1;
        this.#tokens = [];

        while (this.#position < this.#input.length) {
            const token = this.nextToken();
            if (token) {
                this.#tokens.push(token);
            }
        }

        // Add EOF token
        this.#tokens.push(new JSToken(
            JSTokenType.EOF,
            '',
            { line: this.#line, column: this.#column }
        ));

        // Apply state minimization if enabled
        if (this.#minimizeStates) {
            this.minimizeStates();
        }

        return this.#tokens;
    }

    /**
     * Get next token from input
     * @private
     * @returns {JSToken|null}
     */
    nextToken() {
        this.skipWhitespace();

        if (this.#position >= this.#input.length) {
            return null;
        }

        // Try each token pattern
        for (const [type, pattern] of Object.entries(JSTokenizer.#patterns)) {
            const match = this.#input.slice(this.#position).match(pattern);
            if (match) {
                const value = match[0];
                const token = this.createToken(type, value);
                this.advance(value.length);
                return token;
            }
        }

        throw new TokenizerError(
            `Unexpected character: ${this.#input[this.#position]}`,
            this.#line,
            this.#column
        );
    }

    /**
     * Create a token with the appropriate type
     * @private
     */
    createToken(type, value) {
        let tokenType;
        
        switch (type) {
            case 'identifier':
                tokenType = JSTokenizer.#keywords.has(value) ? 
                    JSTokenType.KEYWORD : JSTokenType.IDENTIFIER;
                break;
            case 'number':
                tokenType = JSTokenType.LITERAL;
                break;
            case 'string':
                tokenType = JSTokenType.LITERAL;
                value = value.slice(1, -1); // Remove quotes
                break;
            case 'operator':
                tokenType = JSTokenType.OPERATOR;
                break;
            case 'punctuator':
                tokenType = JSTokenType.PUNCTUATOR;
                break;
            case 'template':
                tokenType = JSTokenType.TEMPLATE;
                break;
            case 'regexp':
                tokenType = JSTokenType.REGEXP;
                break;
            case 'lineComment':
            case 'blockComment':
                tokenType = JSTokenType.COMMENT;
                break;
            case 'whitespace':
                tokenType = JSTokenType.WHITESPACE;
                break;
            default:
                throw new TokenizerError(
                    `Unknown token type: ${type}`,
                    this.#line,
                    this.#column
                );
        }

        return new JSToken(tokenType, value, {
            line: this.#line,
            column: this.#column,
            startPos: this.#position,
            endPos: this.#position + value.length
        });
    }

    /**
     * Skip whitespace and update line/column counters
     * @private
     */
    skipWhitespace() {
        while (this.#position < this.#input.length) {
            const char = this.#input[this.#position];
            if (!/\s/.test(char)) break;
            
            if (char === '\n') {
                this.#line++;
                this.#column = 1;
            } else {
                this.#column++;
            }
            
            this.#position++;
        }
    }

    /**
     * Advance position and update line/column counters
     * @private
     */
    advance(length) {
        const text = this.#input.slice(this.#position, this.#position + length);
        const lines = text.split('\n');
        
        if (lines.length > 1) {
            this.#line += lines.length - 1;
            this.#column = lines[lines.length - 1].length + 1;
        } else {
            this.#column += length;
        }
        
        this.#position += length;
    }

    /**
     * Minimize states using equivalence classes
     * @private
     */
    minimizeStates() {
        // Build initial equivalence classes based on token types
        const initialClasses = new Map();
        
        for (const token of this.#tokens) {
            const type = token.type;
            if (!initialClasses.has(type)) {
                initialClasses.set(type, new Set());
            }
            initialClasses.get(type).add(token);
        }

        // Refine equivalence classes until no more refinement is possible
        let currentClasses = initialClasses;
        let changed = true;

        while (changed) {
            changed = false;
            const newClasses = new Map();

            for (const [type, tokens] of currentClasses) {
                const refinements = this.refineEquivalenceClass(tokens);
                
                if (refinements.size > 1) {
                    changed = true;
                    for (const [signature, refinedTokens] of refinements) {
                        newClasses.set(`${type}-${signature}`, refinedTokens);
                    }
                } else {
                    newClasses.set(type, tokens);
                }
            }

            currentClasses = newClasses;
        }

        // Store final equivalence classes
        this.#stateClasses = currentClasses;

        // Minimize tokens based on equivalence classes
        for (const token of this.#tokens) {
            token.minimize();
        }
    }

    /**
     * Refine an equivalence class based on transitions
     * @private
     */
    refineEquivalenceClass(tokens) {
        const refinements = new Map();

        for (const token of tokens) {
            const signature = token.computeStateSignature();
            if (!refinements.has(signature)) {
                refinements.set(signature, new Set());
            }
            refinements.get(signature).add(token);
        }

        return refinements;
    }

    /**
     * Get token statistics
     * @returns {Object} Token statistics
     */
    getStats() {
        return {
            totalTokens: this.#tokens.length,
            uniqueTokenTypes: new Set(this.#tokens.map(t => t.type)).size,
            equivalenceClasses: this.#stateClasses.size,
            minimizationRatio: this.#stateClasses.size / this.#tokens.length
        };
    }
}