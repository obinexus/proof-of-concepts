// JSToken.js

/**
 * Enumeration of JavaScript token types with metadata for state minimization
 */
export const JSTokenType = {
    // Core token types
    KEYWORD: 'KEYWORD',
    IDENTIFIER: 'IDENTIFIER',
    LITERAL: 'LITERAL',
    OPERATOR: 'OPERATOR',
    PUNCTUATOR: 'PUNCTUATOR',
    COMMENT: 'COMMENT',
    WHITESPACE: 'WHITESPACE',
    TEMPLATE: 'TEMPLATE',
    REGEXP: 'REGEXP',
    EOF: 'EOF',

    // Get all token types for validation
    values() {
        return Object.keys(this).filter(key => typeof this[key] === 'string');
    }
};

/**
 * Token class with built-in state minimization capabilities
 */
export class JSToken {
    #type;
    #value;
    #metadata;
    #minimized = false;
    #stateSignature = null;

    /**
     * @param {string} type - Token type from JSTokenType
     * @param {string} value - Token value
     * @param {object} metadata - Optional token metadata
     */
    constructor(type, value, metadata = {}) {
        this.validateType(type);
        this.#type = type;
        this.#value = value;
        this.#metadata = {
            ...metadata,
            startPos: metadata.startPos || 0,
            endPos: metadata.endPos || 0,
            line: metadata.line || 1,
            column: metadata.column || 1,
            equivalenceClass: null,
            transitions: new Map()
        };
    }

    // Getters
    get type() { return this.#type; }
    get value() { return this.#value; }
    get metadata() { return {...this.#metadata}; }
    get isMinimized() { return this.#minimized; }
    get stateSignature() { return this.#stateSignature; }

    /**
     * Validate token type against defined types
     * @param {string} type 
     */
    validateType(type) {
        if (!JSTokenType.values().includes(type)) {
            throw new TypeError(`Invalid token type: ${type}`);
        }
    }

    /**
     * Add a transition to another state/token
     * @param {string} symbol - Transition symbol
     * @param {JSToken} target - Target token
     * @returns {JSToken} - New token instance with updated transitions
     */
    addTransition(symbol, target) {
        if (!(target instanceof JSToken)) {
            throw new TypeError('Target must be a JSToken instance');
        }

        const newToken = this.clone();
        newToken.#metadata.transitions.set(symbol, target);
        return newToken;
    }

    /**
     * Compute state signature for minimization
     * @returns {string}
     */
    computeStateSignature() {
        const components = [
            this.#type,
            this.getTransitionsSignature(),
            this.getMetadataSignature()
        ];

        this.#stateSignature = components.join('|');
        return this.#stateSignature;
    }

    /**
     * Get signature of token transitions
     * @returns {string}
     */
    getTransitionsSignature() {
        return Array.from(this.#metadata.transitions.entries())
            .map(([symbol, target]) => `${symbol}->${target.type}`)
            .sort()
            .join(',');
    }

    /**
     * Get signature of token metadata
     * @returns {string}
     */
    getMetadataSignature() {
        const relevantMetadata = {
            equivalenceClass: this.#metadata.equivalenceClass
        };
        return JSON.stringify(relevantMetadata);
    }

    /**
     * Set equivalence class for state minimization
     * @param {number} classId 
     * @returns {JSToken}
     */
    setEquivalenceClass(classId) {
        const newToken = this.clone();
        newToken.#metadata.equivalenceClass = classId;
        return newToken;
    }

    /**
     * Compare with another token
     * @param {JSToken} other 
     * @returns {boolean}
     */
    equals(other) {
        if (!(other instanceof JSToken)) return false;
        
        return this.#type === other.type &&
               this.#value === other.value &&
               this.#stateSignature === other.stateSignature;
    }

    /**
     * Check if token is of specific type
     * @param {string} type 
     * @returns {boolean}
     */
    isType(type) {
        return this.#type === type;
    }

    /**
     * Create a deep clone of the token
     * @returns {JSToken}
     */
    clone() {
        const newToken = new JSToken(this.#type, this.#value, {...this.#metadata});
        newToken.#minimized = this.#minimized;
        newToken.#stateSignature = this.#stateSignature;
        return newToken;
    }

    /**
     * Minimize the token state
     * @param {boolean} [force=false] - Force minimization even if already minimized
     * @returns {JSToken}
     */
    minimize(force = false) {
        if (this.#minimized && !force) return this;

        const minimized = this.clone();
        minimized.#stateSignature = this.computeStateSignature();
        minimized.#minimized = true;

        // Minimize transitions
        for (const [symbol, target] of this.#metadata.transitions) {
            minimized.#metadata.transitions.set(symbol, target.minimize());
        }

        return minimized;
    }

    /**
     * Create non-minimized copy for inspection
     * @returns {JSToken}
     */
    toNonMinimized() {
        const nonMinimized = this.clone();
        nonMinimized.#minimized = false;
        nonMinimized.#stateSignature = null;
        return nonMinimized;
    }

    /**
     * Static helper to compute equivalence classes for a set of tokens
     * @param {JSToken[]} tokens 
     * @returns {Map<number, JSToken[]>}
     */
    static computeEquivalenceClasses(tokens) {
        const classes = new Map();
        let nextClassId = 0;

        for (const token of tokens) {
            let found = false;
            
            for (const [classId, representatives] of classes) {
                if (representatives.some(rep => JSToken.areEquivalent(rep, token))) {
                    token.setEquivalenceClass(classId);
                    representatives.push(token);
                    found = true;
                    break;
                }
            }

            if (!found) {
                const newClassId = nextClassId++;
                token.setEquivalenceClass(newClassId);
                classes.set(newClassId, [token]);
            }
        }

        return classes;
    }

    /**
     * Check if two tokens are equivalent for minimization
     * @param {JSToken} token1 
     * @param {JSToken} token2 
     * @returns {boolean}
     */
    static areEquivalent(token1, token2) {
        if (!(token1 instanceof JSToken) || !(token2 instanceof JSToken)) {
            return false;
        }

        if (token1.type !== token2.type) return false;

        const transitions1 = Array.from(token1.metadata.transitions.entries()).sort();
        const transitions2 = Array.from(token2.metadata.transitions.entries()).sort();

        if (transitions1.length !== transitions2.length) return false;

        for (let i = 0; i < transitions1.length; i++) {
            const [symbol1, target1] = transitions1[i];
            const [symbol2, target2] = transitions2[i];

            if (symbol1 !== symbol2 || !target1.equals(target2)) {
                return false;
            }
        }

        return true;
    }

    toString() {
        return `JSToken(${this.#type}, '${this.#value}')${this.#minimized ? ' [minimized]' : ''}`;
    }

    toJSON() {
        return {
            type: this.#type,
            value: this.#value,
            metadata: this.#metadata,
            minimized: this.#minimized,
            stateSignature: this.#stateSignature
        };
    }
}

// Error class for token-related errors
export class JSTokenError extends Error {
    constructor(message) {
        super(message);
        this.name = 'JSTokenError';
    }
}