// JSParser.js
import { JSTokenizer } from './JSTokenizer.js';
import { JSToken, JSTokenType, JSTokenError } from './JSToken.js';

export class ParserError extends Error {
    constructor(message, token) {
        super(`${message} at line ${token.metadata.line}, column ${token.metadata.column}`);
        this.name = 'ParserError';
        this.token = token;
    }
}

export class ASTNode {
    constructor(type, value = null) {
        this.type = type;
        this.value = value;
        this.children = [];
        this.metadata = {
            equivalenceClass: null,
            stateSignature: null,
            isMinimized: false
        };
    }

    addChild(node) {
        node.parent = this;
        this.children.push(node);
        return this;
    }

    computeStateSignature() {
        const components = [
            this.type,
            this.value,
            this.children.map(child => child.type).join(',')
        ];
        this.metadata.stateSignature = components.join('|');
        return this.metadata.stateSignature;
    }
}

export class JSParser {
    #tokenizer;
    #tokens = [];
    #current = 0;
    #minimizeStates;
    #stateClasses = new Map();

    constructor(options = {}) {
        this.#minimizeStates = options.minimizeStates ?? true;
        this.#tokenizer = new JSTokenizer(options);
    }

    /**
     * Parse JavaScript source code into an AST
     * @param {string} source JavaScript source code
     * @returns {ASTNode} Abstract Syntax Tree
     */
    parse(source) {
        this.#tokens = this.#tokenizer.tokenize(source);
        this.#current = 0;

        const ast = this.parseProgram();

        if (this.#minimizeStates) {
            this.minimizeStates(ast);
        }

        return ast;
    }

    /**
     * Parse a complete program
     * @private
     */
    parseProgram() {
        const program = new ASTNode('Program');

        while (!this.isAtEnd()) {
            try {
                const statement = this.parseStatement();
                if (statement) {
                    program.addChild(statement);
                }
            } catch (error) {
                if (error instanceof ParserError) {
                    this.synchronize();
                } else {
                    throw error;
                }
            }
        }

        return program;
    }
    parseFunctionDeclaration() {
        const node = new ASTNode('FunctionDeclaration');
        this.consume(JSTokenType.KEYWORD, 'function');
        
        const name = this.consume(JSTokenType.IDENTIFIER);
        node.addChild(new ASTNode('Identifier', name.value));
        
        this.consume(JSTokenType.PUNCTUATOR, '(');
        const params = [];
        
        if (!this.check(JSTokenType.PUNCTUATOR, ')')) {
            do {
                const param = this.consume(JSTokenType.IDENTIFIER);
                params.push(new ASTNode('Identifier', param.value));
            } while (this.match(JSTokenType.PUNCTUATOR, ',') && this.advance());
        }
        
        this.consume(JSTokenType.PUNCTUATOR, ')');
        node.addChild(this.parseBlockStatement());
        return node;
    }

    parseIfStatement() {
        const node = new ASTNode('IfStatement');
        
        this.consume(JSTokenType.KEYWORD, 'if');
        this.consume(JSTokenType.PUNCTUATOR, '(');
        node.addChild(this.parseExpression());
        this.consume(JSTokenType.PUNCTUATOR, ')');
        
        node.addChild(this.parseStatement());
        
        if (this.match(JSTokenType.KEYWORD, 'else')) {
            this.advance();
            node.addChild(this.parseStatement());
        }
        
        return node;
    }
ss
    /**
     * Parse a statement
     * @private
     */
    parseStatement() {
        const token = this.peek();

        switch (token.type) {
            case JSTokenType.KEYWORD:
                switch (token.value) {
                    case 'const':
                    case 'let':
                    case 'var':
                        return this.parseVariableDeclaration();
                    case 'function':
                        return this.parseFunctionDeclaration();
                    case 'if':
                        return this.parseIfStatement();
                    case 'return':
                        return this.parseReturnStatement();
                    // Add other keyword cases
                }
                break;
            // Add other statement types
        }

        return this.parseExpressionStatement();
    }

    /**
     * Parse variable declaration
     * @private
     */
    parseVariableDeclaration() {
        const node = new ASTNode('VariableDeclaration');
        node.kind = this.consume().value; // const, let, var

        do {
            const declarator = new ASTNode('VariableDeclarator');
            
            // Parse identifier
            const id = this.consume(JSTokenType.IDENTIFIER);
            declarator.addChild(new ASTNode('Identifier', id.value));

            // Parse initializer if present
            if (this.match(JSTokenType.OPERATOR, '=')) {
                this.advance(); // Skip =
                declarator.addChild(this.parseExpression());
            }

            node.addChild(declarator);
        } while (this.match(JSTokenType.PUNCTUATOR, ',') && this.advance());

        this.consume(JSTokenType.PUNCTUATOR, ';');
        return node;
    }

    /**
     * Parse expression
     * @private
     */
    parseExpression() {
        return this.parseAssignment();
    }

    /**
     * Parse assignment expression
     * @private
     */
    parseAssignment() {
        let expr = this.parseEquality();

        if (this.match(JSTokenType.OPERATOR, '=')) {
            const equals = this.advance();
            const value = this.parseAssignment();

            if (expr.type === 'Identifier') {
                const node = new ASTNode('AssignmentExpression', '=');
                node.addChild(expr);
                node.addChild(value);
                return node;
            }

            throw new ParserError('Invalid assignment target.', equals);
        }

        return expr;
    }

    /**
     * Parse equality expression
     * @private
     */
    parseEquality() {
        let expr = this.parseComparison();

        while (this.match(JSTokenType.OPERATOR, '==', '!=', '===', '!==')) {
            const operator = this.advance().value;
            const right = this.parseComparison();
            const node = new ASTNode('BinaryExpression', operator);
            node.addChild(expr);
            node.addChild(right);
            expr = node;
        }

        return expr;
    }

    /**
     * State minimization for AST
     * @private
     */
    minimizeStates(ast) {
        // Initialize state classes
        const initialClasses = new Map();
        this.collectNodesByType(ast, initialClasses);

        // Iteratively refine equivalence classes
        let currentClasses = initialClasses;
        let changed = true;

        while (changed) {
            changed = false;
            const newClasses = new Map();

            for (const [type, nodes] of currentClasses) {
                const refinements = this.refineNodeClass(nodes);
                
                if (refinements.size > 1) {
                    changed = true;
                    for (const [signature, refinedNodes] of refinements) {
                        newClasses.set(`${type}-${signature}`, refinedNodes);
                    }
                } else {
                    newClasses.set(type, nodes);
                }
            }

            currentClasses = newClasses;
        }

        // Store final state classes
        this.#stateClasses = currentClasses;

        // Apply minimization
        this.applyMinimization(ast);
    }

    /**
     * Collect nodes by type for initial classification
     * @private
     */
    collectNodesByType(node, classes) {
        if (!classes.has(node.type)) {
            classes.set(node.type, new Set());
        }
        classes.get(node.type).add(node);

        for (const child of node.children) {
            this.collectNodesByType(child, classes);
        }
    }

    /**
     * Refine node equivalence class based on structure
     * @private
     */
    refineNodeClass(nodes) {
        const refinements = new Map();

        for (const node of nodes) {
            const signature = node.computeStateSignature();
            if (!refinements.has(signature)) {
                refinements.set(signature, new Set());
            }
            refinements.get(signature).add(node);
        }

        return refinements;
    }

    /**
     * Apply minimization to AST
     * @private
     */
    applyMinimization(node) {
        node.metadata.isMinimized = true;

        // Find equivalent nodes and set equivalence class
        for (const [classId, nodes] of this.#stateClasses) {
            if (nodes.has(node)) {
                node.metadata.equivalenceClass = classId;
                break;
            }
        }

        // Recursively apply to children
        for (const child of node.children) {
            this.applyMinimization(child);
        }
    }

    /**
     * Helper methods for token manipulation
     * @private
     */
    peek() {
        return this.#tokens[this.#current];
    }

    isAtEnd() {
        return this.peek().type === JSTokenType.EOF;
    }

    advance() {
        if (!this.isAtEnd()) this.#current++;
        return this.previous();
    }

    previous() {
        return this.#tokens[this.#current - 1];
    }

    consume(type, value) {
        if (this.match(type, value)) {
            return this.advance();
        }

        throw new ParserError(
            `Expected ${value ? `'${value}'` : type}, found '${this.peek().value}'`,
            this.peek()
        );
    }

     // Helper methods
     match(type, ...values) {
        if (this.check(type, ...values)) {
            return true;
        }
        return false;
    }

    check(type, ...values) {
        if (this.isAtEnd()) return false;
        if (this.peek().type !== type) return false;
        return values.length === 0 || values.includes(this.peek().value);
    }

    advance() {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    consume(type, value) {
        if (this.check(type, value)) {
            return this.advance();
        }

        throw new ParserError(
            `Expected ${value || type}, found '${this.peek().value}'`,
            this.peek()
        );
    }

    isAtEnd() {
        return this.peek().type === JSTokenType.EOF;
    }

    peek() {
        return this.tokens[this.current];
    }

    previous() {
        return this.tokens[this.current - 1];
    }

    synchronize() {
        this.advance();

        while (!this.isAtEnd()) {
            if (this.previous().type === JSTokenType.PUNCTUATOR && 
                this.previous().value === ';') {
                return;
            }

            switch (this.peek().value) {
                case 'class':
                case 'function':
                case 'let':
                case 'const':
                case 'var':
                case 'if':
                case 'while':
                case 'return':
                    return;
            }

            this.advance();
        }
    }

    /**
     * Get parser statistics
     */
    getStats() {
        return {
            totalNodes: this.countNodes(this.parseProgram()),
            equivalenceClasses: this.#stateClasses.size,
            tokenStats: this.#tokenizer.getStats()
        };
    }

    /**
     * Count total nodes in AST
     * @private
     */
    countNodes(node) {
        let count = 1;
        for (const child of node.children) {
            count += this.countNodes(child);
        }
        return count;
    }
}