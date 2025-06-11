// CSSParser.js
export class CSSParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
    this.errors = [];
  }

  parse() {
    const ast = {
      type: 'stylesheet',
      children: [],
      metadata: {}
    };

    // Main parsing loop
    while (this.position < this.tokens.length) {
      const token = this.peek();
      
      // Handle EOF
      if (!token || token.type === 'EOF') {
        break;
      }

      // Skip comments and whitespace
      if (token.type === 'Comment' || token.type === 'Whitespace') {
        this.consume();
        continue;
      }

      // Parse at-rules or regular rules
      if (token.type === 'AtKeyword') {
        const atRule = this.parseAtRule();
        if (atRule) ast.children.push(atRule);
      } else {
        const rule = this.parseRule();
        if (rule) ast.children.push(rule);
      }
    }

    return ast;
  }

  parseAtRule() {
    const token = this.consume(); // @-keyword
    const atRule = {
      type: 'at-rule',
      name: token.value,
      prelude: [],
      block: null
    };

    // Parse prelude
    while (this.position < this.tokens.length) {
      const token = this.peek();
      
      if (!token || token.type === 'EOF' || token.type === 'StartBlock' || token.type === 'Semicolon') {
        break;
      }
      
      atRule.prelude.push({
        type: 'text',
        value: this.consume().value
      });
    }

    // Parse block if present
    if (this.peek()?.type === 'StartBlock') {
      this.consume(); // {
      atRule.block = this.parseBlock();
    } else if (this.peek()?.type === 'Semicolon') {
      this.consume(); // ;
    }

    return atRule;
  }

  parseRule() {
    const selectors = [];
    const declarations = [];
    let hasBlock = false;

    // Parse selectors
    while (this.position < this.tokens.length) {
      const token = this.peek();
      
      if (!token || token.type === 'EOF') break;
      
      if (token.type === 'StartBlock') {
        hasBlock = true;
        this.consume();
        break;
      }
      
      if (token.type === 'Whitespace' || token.type === 'Comment') {
        this.consume();
        continue;
      }
      
      if (token.type === 'Comma') {
        this.consume();
        continue;
      }
      
      if (token.type === 'Selector' || token.type === 'Property') {
        selectors.push({
          type: 'selector',
          value: this.consume().value
        });
      } else {
        // Skip unknown tokens
        this.consume();
      }
    }

    // Parse declarations if we found a block
    if (hasBlock) {
      while (this.position < this.tokens.length) {
        const token = this.peek();
        
        if (!token || token.type === 'EOF' || token.type === 'EndBlock') {
          break;
        }

        if (token.type === 'Whitespace' || token.type === 'Comment') {
          this.consume();
          continue;
        }

        const declaration = this.parseDeclaration();
        if (declaration) {
          declarations.push(declaration);
        }
      }

      // Consume closing brace
      if (this.peek()?.type === 'EndBlock') {
        this.consume();
      }
    }

    // Only return a rule if we have valid selectors
    if (selectors.length > 0) {
      return {
        type: 'rule',
        selectors,
        declarations
      };
    }

    return null;
  }

  parseBlock() {
    const declarations = [];
    const rules = [];

    while (this.position < this.tokens.length) {
      const token = this.peek();
      
      if (!token || token.type === 'EOF' || token.type === 'EndBlock') {
        break;
      }

      if (token.type === 'Whitespace' || token.type === 'Comment') {
        this.consume();
        continue;
      }

      if (token.type === 'AtKeyword') {
        const nestedAtRule = this.parseAtRule();
        if (nestedAtRule) rules.push(nestedAtRule);
      } else if (token.type === 'Property') {
        const declaration = this.parseDeclaration();
        if (declaration) declarations.push(declaration);
      } else {
        const rule = this.parseRule();
        if (rule) rules.push(rule);
      }
    }

    // Consume closing brace
    if (this.peek()?.type === 'EndBlock') {
      this.consume();
    }

    return {
      type: 'block',
      declarations,
      rules
    };
  }

  parseDeclaration() {
    // Get property
    const token = this.peek();
    if (!token || (token.type !== 'Property' && token.type !== 'Selector')) {
      return null;
    }

    const property = {
      type: 'property',
      value: this.consume().value
    };

    // Skip whitespace
    while (this.peek()?.type === 'Whitespace') {
      this.consume();
    }

    // Expect colon
    if (this.peek()?.type !== 'Colon') {
      // Error recovery - skip to next semicolon
      this.skipToSemicolon();
      return null;
    }
    this.consume(); // :

    // Skip whitespace
    while (this.peek()?.type === 'Whitespace') {
      this.consume();
    }

    // Parse values
    const values = [];
    while (this.position < this.tokens.length) {
      const token = this.peek();
      
      if (!token || token.type === 'EOF' || token.type === 'Semicolon' || token.type === 'EndBlock') {
        break;
      }

      if (token.type === 'Whitespace' || token.type === 'Comment') {
        this.consume();
        continue;
      }

      values.push({
        type: 'value',
        value: this.consume().value
      });
    }

    // Optional semicolon
    if (this.peek()?.type === 'Semicolon') {
      this.consume();
    }

    return {
      type: 'declaration',
      property,
      values
    };
  }

  // Helper methods
  peek() {
    return this.tokens[this.position];
  }

  consume() {
    return this.tokens[this.position++];
  }

  skipToSemicolon() {
    while (this.position < this.tokens.length) {
      const token = this.peek();
      if (!token || token.type === 'Semicolon' || token.type === 'EndBlock') {
        break;
      }
      this.consume();
    }
    if (this.peek()?.type === 'Semicolon') {
      this.consume();
    }
  }
}