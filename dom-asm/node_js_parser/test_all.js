// test_all.js

import { JSToken, JSTokenType, JSTokenError } from './JSToken.js';
import { JSTokenizer } from './JSTokenizer.js';
import { JSParser } from './JSParser.js';
import { JSAst, NodeType } from './JSAst.js';

// Test runner
class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    assertEquals(actual, expected, message = '') {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
        }
    }

    assertThrows(fn, errorType, message = '') {
        try {
            fn();
            throw new Error(`Expected ${errorType.name} but no error was thrown`);
        } catch (error) {
            if (!(error instanceof errorType)) {
                throw new Error(`Expected ${errorType.name} but got ${error.constructor.name}`);
            }
        }
    }

    async run() {
        console.log('Starting tests...\n');
        const startTime = Date.now();

        for (const test of this.tests) {
            try {
                await test.fn();
                console.log(`✓ ${test.name}`);
                this.passed++;
            } catch (error) {
                console.error(`✗ ${test.name}`);
                console.error(`  ${error.message}\n`);
                this.failed++;
            }
        }

        const duration = Date.now() - startTime;
        console.log('\nTest Results:');
        console.log(`Total: ${this.tests.length}`);
        console.log(`Passed: ${this.passed}`);
        console.log(`Failed: ${this.failed}`);
        console.log(`Duration: ${duration}ms`);
    }
}

// Create test instance
const runner = new TestRunner();

// Token Tests
runner.test('JSTokenType should have all required token types', () => {
    const requiredTypes = [
        'KEYWORD', 'IDENTIFIER', 'LITERAL', 'OPERATOR',
        'PUNCTUATOR', 'COMMENT', 'WHITESPACE', 'TEMPLATE',
        'REGEXP', 'EOF'
    ];

    requiredTypes.forEach(type => {
        runner.assert(JSTokenType[type], `Missing token type: ${type}`);
    });
});

runner.test('JSToken should validate token types', () => {
    runner.assertThrows(
        () => new JSToken('INVALID_TYPE', 'value'),
        TypeError
    );
});

runner.test('JSToken should handle state minimization correctly', () => {
    const token = new JSToken(JSTokenType.IDENTIFIER, 'x');
    const minimized = token.minimize();
    runner.assert(minimized.isMinimized, 'Token should be minimized');
});

// Tokenizer Tests
runner.test('JSTokenizer should handle basic tokens', () => {
    const tokenizer = new JSTokenizer();
    const tokens = tokenizer.tokenize('const x = 42;');
    
    runner.assert(tokens.length === 6, 'Should have correct number of tokens'); // const, x, =, 42, ;, EOF
    runner.assert(tokens[0].type === JSTokenType.KEYWORD, 'First token should be keyword');
    runner.assert(tokens[0].value === 'const', 'First token should be const');
});

runner.test('JSTokenizer should handle complex expressions', () => {
    const tokenizer = new JSTokenizer();
    const tokens = tokenizer.tokenize('function add(a, b) { return a + b; }');
    
    runner.assert(tokens.find(t => t.type === JSTokenType.KEYWORD && t.value === 'function'),
        'Should recognize function keyword');
    runner.assert(tokens.find(t => t.type === JSTokenType.IDENTIFIER && t.value === 'add'),
        'Should recognize function name');
});

runner.test('JSTokenizer should handle string literals', () => {
    const tokenizer = new JSTokenizer();
    const tokens = tokenizer.tokenize('"hello world" \'test\'');
    
    const stringTokens = tokens.filter(t => t.type === JSTokenType.LITERAL);
    runner.assert(stringTokens.length === 2, 'Should recognize both string literals');
    runner.assert(stringTokens[0].value === 'hello world', 'Should preserve string content');
});

// Parser Tests
runner.test('JSParser should parse variable declarations', () => {
    const parser = new JSParser();
    const ast = parser.parse('const x = 42;');
    
    runner.assert(ast.type === 'Program', 'Root should be Program');
    runner.assert(ast.children[0].type === 'VariableDeclaration',
        'Should have VariableDeclaration node');
});

runner.test('JSParser should handle expressions', () => {
    const parser = new JSParser();
    const ast = parser.parse('x = a + b;');
    
    const expr = ast.children[0];
    runner.assert(expr.type === 'ExpressionStatement', 'Should be expression statement');
    runner.assert(expr.children[0].type === 'AssignmentExpression',
        'Should be assignment expression');
});

// AST Tests
runner.test('JSAst should optimize constant expressions', () => {
    const ast = new JSAst();
    const tree = ast.parse('const x = 40 + 2;');
    
    const declarator = tree.children[0].children[0];
    runner.assert(declarator.children[1].type === NodeType.Literal,
        'Should optimize to literal');
    runner.assert(declarator.children[1].value === 42,
        'Should compute correct value');
});

runner.test('JSAst should handle state minimization', () => {
    const ast = new JSAst();
    const tree = ast.parse(`
        const x = 42;
        const y = 42;
    `);
    
    // Both literals should share the same equivalence class
    const decl1 = tree.children[0].children[0];
    const decl2 = tree.children[1].children[0];
    runner.assert(
        decl1.children[1].metadata.equivalenceClass ===
        decl2.children[1].metadata.equivalenceClass,
        'Equivalent literals should share state'
    );
});

runner.test('JSAst should preserve program semantics after optimization', () => {
    const ast = new JSAst();
    const source = `
        function add(a, b) {
            return a + b;
        }
        const x = add(40, 2);
    `;
    
    const tree = ast.parse(source);
    runner.assert(tree.children.length === 2, 'Should preserve all top-level statements');
    runner.assert(
        tree.children[0].type === NodeType.FunctionDeclaration,
        'Should preserve function declaration'
    );
});

// Integration Tests
runner.test('Full pipeline should handle complex code', () => {
    const source = `
        function factorial(n) {
            if (n <= 1) return 1;
            return n * factorial(n - 1);
        }
        const result = factorial(5);
    `;
    
    const ast = new JSAst();
    const tree = ast.parse(source);
    
    // Verify basic structure
    runner.assert(tree.type === NodeType.Program, 'Should have program root');
    runner.assert(tree.children.length === 2, 'Should have two top-level statements');
    
    // Verify optimization
    const stats = ast.getStats();
    runner.assert(stats.minimizedNodes > 0, 'Should perform some optimizations');
    runner.assert(
        stats.optimizationRatio < 1,
        'Should achieve some state reduction'
    );
});

runner.test('Should handle error recovery', () => {
    const ast = new JSAst();
    runner.assertThrows(
        () => ast.parse('const x = ;'),
        Error,
        'Should handle syntax errors gracefully'
    );
});

// Run all tests
runner.run().then(() => {
    if (runner.failed > 0) {
        process.exit(1);
    }
});