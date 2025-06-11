// JSAst.js
import { JSToken, JSTokenType } from './JSToken.js';
import { JSParser, ASTNode } from './JSParser.js';

export const NodeType = {
    Program: 'Program',
    VariableDeclaration: 'VariableDeclaration',
    VariableDeclarator: 'VariableDeclarator',
    FunctionDeclaration: 'FunctionDeclaration',
    BlockStatement: 'BlockStatement',
    ExpressionStatement: 'ExpressionStatement',
    BinaryExpression: 'BinaryExpression',
    AssignmentExpression: 'AssignmentExpression',
    Identifier: 'Identifier',
    Literal: 'Literal',
    ReturnStatement: 'ReturnStatement',
    IfStatement: 'IfStatement'
};

export class JSAst {
    constructor(options = {}) {
        this.options = {
            minimizeStates: true,
            preserveComments: false,
            ...options
        };
        this.stateClasses = new Map();
        this.minimizedNodes = new WeakMap();
    }

    parse(source) {
        this.root = this.parser.parse(source);

        if (this.options.minimizeStates) {
            this.minimize();
        }

        return this.root;
    }

    minimize() {
        this.buildEquivalenceClasses();
        this.root = this.minimizeNode(this.root);

        if (this.options.optimizationLevel >= 2) {
            this.applyAdvancedOptimizations();
        }
    }

    buildEquivalenceClasses() {
        const initialClasses = new Map();
        this.collectNodesByType(this.root, initialClasses);

        let currentClasses = initialClasses;
        let changed = true;
        let classId = 0;

        while (changed) {
            changed = false;
            const newClasses = new Map();

            for (const [type, nodes] of currentClasses) {
                const refinements = this.refineEquivalenceClass(nodes);
                
                for (const [signature, nodeSet] of refinements) {
                    if (nodeSet.size > 0) {
                        nodeSet.forEach(node => {
                            node.metadata.equivalenceClass = classId;
                            node.metadata.stateSignature = signature;
                        });
                        newClasses.set(classId++, nodeSet);
                    }
                }

                if (refinements.size > 1) changed = true;
            }

            currentClasses = newClasses;
        }

        this.stateClasses = currentClasses;
    }
    collectNodesByType(node, classes) {
        if (!classes.has(node.type)) {
            classes.set(node.type, new Set());
        }
        classes.get(node.type).add(node);

        for (const child of node.children) {
            this.collectNodesByType(child, classes);
        }
    }
    refineEquivalenceClass(nodes) {
        const refinements = new Map();

        for (const node of nodes) {
            const signature = this.computeNodeSignature(node);
            if (!refinements.has(signature)) {
                refinements.set(signature, new Set());
            }
            refinements.get(signature).add(node);
        }

        return refinements;
    }
    minimizeNode(node) {
        if (this.minimizedNodes.has(node)) {
            return this.minimizedNodes.get(node);
        }

        const minimized = new ASTNode(node.type, node.value);
        minimized.metadata = {
            ...node.metadata,
            isMinimized: true
        };

        minimized.children = node.children
            .map(child => this.minimizeNode(child))
            .filter(child => this.shouldKeepNode(child));

        this.minimizedNodes.set(node, minimized);
        return minimized;
    }
    optimize(ast) {
        if (this.options.minimizeStates) {
            this.minimizeStates(ast);
        }
        return this.optimizeNode(ast);
    }
    applyAdvancedOptimizations() {
        this.optimizeConstantExpressions(this.root);
        this.foldConstants(this.root);
        this.removeDeadCode(this.root);
    }
    optimizeNode(node) {
        // Check cache
        if (this.minimizedNodes.has(node)) {
            return this.minimizedNodes.get(node);
        }

        // Optimize constant expressions
        if (node.type === 'BinaryExpression' && 
            node.children.every(child => 
                child.type === 'Literal' && typeof child.value === 'number'
            )) {
            const result = this.evaluateConstantExpression(node);
            const optimized = {
                type: 'Literal',
                value: result,
                children: [],
                metadata: { ...node.metadata, isMinimized: true }
            };
            this.minimizedNodes.set(node, optimized);
            return optimized;
        }

        // Recursively optimize children
        const optimized = {
            type: node.type,
            value: node.value,
            children: node.children.map(child => this.optimizeNode(child)),
            metadata: { ...node.metadata, isMinimized: true }
        };

        this.minimizedNodes.set(node, optimized);
        return optimized;
    }

    evaluateConstantExpression(node) {
        if (node.type === 'Literal') return node.value;

        const left = this.evaluateConstantExpression(node.children[0]);
        const right = this.evaluateConstantExpression(node.children[1]);

        switch (node.value) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': return left / right;
            case '%': return left % right;
            default: return 0;
        }
    }
    optimizeConstantExpressions(node) {
        if (node.type === 'BinaryExpression') {
            const left = this.evaluateConstant(node.children[0]);
            const right = this.evaluateConstant(node.children[1]);

            if (left !== null && right !== null) {
                const result = this.computeBinaryOperation(left, right, node.value);
                return new ASTNode('Literal', result);
            }
        }

        node.children = node.children.map(child => this.optimizeConstantExpressions(child));
        return node;
    }

    evaluateConstant(node) {
        if (node.type === 'Literal') {
            return Number(node.value);
        }
        return null;
    }

    computeBinaryOperation(left, right, operator) {
        switch (operator) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': return left / right;
            case '%': return left % right;
            case '===': return left === right ? 1 : 0;
            case '!==': return left !== right ? 1 : 0;
            case '<': return left < right ? 1 : 0;
            case '<=': return left <= right ? 1 : 0;
            case '>': return left > right ? 1 : 0;
            case '>=': return left >= right ? 1 : 0;
            default: return null;
        }
    }

    foldConstants(node) {
        if (!node) return null;

        // First fold constants in children
        node.children = node.children.map(child => this.foldConstants(child));

        // Then try to fold this node
        if (node.type === 'BinaryExpression') {
            const left = node.children[0];
            const right = node.children[1];

            if (left.type === 'Literal' && right.type === 'Literal') {
                const result = this.computeBinaryOperation(
                    Number(left.value),
                    Number(right.value),
                    node.value
                );
                if (result !== null) {
                    return new ASTNode('Literal', result);
                }
            }
        }

        return node;
    }

    removeDeadCode(node) {
        if (!node) return null;

        // Process children first
        node.children = node.children
            .map(child => this.removeDeadCode(child))
            .filter(Boolean);

        switch (node.type) {
            case 'IfStatement':
                if (node.children[0].type === 'Literal') {
                    // If condition is constant, keep only the relevant branch
                    const condition = Boolean(node.children[0].value);
                    const thenBranch = node.children[1];
                    const elseBranch = node.children[2];
                    return condition ? thenBranch : (elseBranch || null);
                }
                break;

            case 'BlockStatement':
                // Remove empty blocks
                if (node.children.length === 0) {
                    return null;
                }
                break;

            case 'VariableDeclarator':
                // Remove unused variables (if optimization level is high enough)
                if (this.options.optimizationLevel >= 3 && !this.isVariableUsed(node)) {
                    return null;
                }
                break;
        }

        return node;
    }

    isVariableUsed(node) {
        const name = node.children[0].value;
        return this.findReferences(this.root, name).length > 1; // More than just declaration
    }

    findReferences(node, name) {
        const refs = [];
        this.traverseTree(node, (n) => {
            if (n.type === 'Identifier' && n.value === name) {
                refs.push(n);
            }
        });
        return refs;
    }

    traverseTree(node, callback) {
        callback(node);
        node.children.forEach(child => this.traverseTree(child, callback));
    }

    shouldKeepNode(node) {
        // Always keep required nodes
        if (this.isRequiredNode(node)) return true;

        // Keep comments if preserveComments is enabled
        if (node.type === 'Comment' && this.options.preserveComments) return true;

        // Remove empty nodes unless they're significant
        if (node.children.length === 0 && !node.value && 
            !this.isSignificantEmptyNode(node)) {
            return false;
        }

        return true;
    }

    isRequiredNode(node) {
        const requiredTypes = new Set([
            NodeType.Program,
            NodeType.FunctionDeclaration,
            NodeType.ReturnStatement,
            NodeType.VariableDeclaration,
            NodeType.IfStatement
        ]);
        return requiredTypes.has(node.type);
    }

    isSignificantEmptyNode(node) {
        // Some nodes are significant even when empty
        return node.type === 'BlockStatement' || 
               node.type === 'ReturnStatement';
    }
  minimizeStates(ast) {
        // Build initial equivalence classes
        const initialClasses = new Map();
        this.collectNodesByType(ast, initialClasses);

        // Iteratively refine classes
        let currentClasses = initialClasses;
        let changed = true;
        let classId = 0;

        while (changed) {
            changed = false;
            const newClasses = new Map();

            for (const [type, nodes] of currentClasses) {
                const refinements = this.refineEquivalenceClass(nodes);
                for (const nodeSet of refinements.values()) {
                    if (nodeSet.size > 0) {
                        for (const node of nodeSet) {
                            node.metadata.equivalenceClass = classId;
                        }
                        newClasses.set(classId++, nodeSet);
                    }
                }
                if (refinements.size > 1) changed = true;
            }

            currentClasses = newClasses;
        }

        this.stateClasses = currentClasses;
    }
    computeNodeSignature(node) {
        const components = [
            node.type,
            node.value,
            ...node.children.map(child => child.type),
            node.metadata.minimized ? 'minimized' : 'full'
        ];
        return components.join('|');
    }

    getStats() {
        const stats = {
            totalNodes: 0,
            minimizedNodes: 0,
            equivalenceClasses: this.stateClasses.size,
            nodeTypes: new Map(),
            optimizationRatio: 0
        };

        this.traverseTree(this.root, (node) => {
            stats.totalNodes++;
            if (node.metadata.isMinimized) {
                stats.minimizedNodes++;
            }
            stats.nodeTypes.set(
                node.type,
                (stats.nodeTypes.get(node.type) || 0) + 1
            );
        });

        stats.optimizationRatio = stats.minimizedNodes / stats.totalNodes;
        return stats;
    }

    toString() {
        return this.stringifyNode(this.root);
    }

    stringifyNode(node, indent = 0) {
        const indentation = ' '.repeat(indent * 2);
        let result = `${indentation}${node.type}`;
        
        if (node.value !== null) {
            result += `: ${node.value}`;
        }
        
        if (node.metadata.equivalenceClass !== null) {
            result += ` [class: ${node.metadata.equivalenceClass}]`;
        }
        
        result += '\n';
        
        for (const child of node.children) {
            result += this.stringifyNode(child, indent + 1);
        }
        
        return result;
    }

    toJSON() {
        return this.jsonifyNode(this.root);
    }

    jsonifyNode(node) {
        return {
            type: node.type,
            value: node.value,
            metadata: node.metadata,
            children: node.children.map(child => this.jsonifyNode(child))
        };
    }
}