// CSSTokenType - Enum-like constant definitions with validation support
export const CSSTokenType = {
    // Structure tokens
    StartBlock: 'StartBlock',     // {
    EndBlock: 'EndBlock',         // }
    Semicolon: 'Semicolon',       // ;
    Colon: 'Colon',              // :
    Comma: 'Comma',              // ,
    
    // Selector tokens
    Selector: 'Selector',         // e.g., .class, #id, element
    PseudoClass: 'PseudoClass',   // e.g., :hover
    PseudoElement: 'PseudoElement', // e.g., ::before
    Combinator: 'Combinator',     // e.g., >, +, ~
    
    // Property and value tokens
    Property: 'Property',         // e.g., color, margin
    Value: 'Value',              // e.g., red, 20px
    Unit: 'Unit',                // e.g., px, em, %
    Number: 'Number',            // e.g., 42, 1.5
    Color: 'Color',              // e.g., #fff, rgb()
    URL: 'URL',                  // e.g., url()
    String: 'String',            // e.g., "text", 'text'
    
    // Function tokens
    Function: 'Function',         // e.g., rgb(), calc()
    OpenParen: 'OpenParen',       // (
    CloseParen: 'CloseParen',     // )
    
    // Special tokens
    AtKeyword: 'AtKeyword',       // e.g., @media, @import
    Comment: 'Comment',           // /* comment */
    Whitespace: 'Whitespace',     // space, tab, newline
    EOF: 'EOF',                  // End of file
    
    // Meta tokens for state tracking
    Error: 'Error'               // Invalid token
  };
  
  // Base token class with validation and state management
  export class CSSToken {
    constructor(type, value, position, metadata = {}) {
      this.validateType(type);
      this.validatePosition(position);
      
      this.type = type;
      this.value = value;
      this.position = position;
      this.metadata = {
        ...metadata,
        stateSignature: null,    // For state minimization
        equivalenceClass: null,   // For grouping equivalent tokens
        transitions: new Map()    // For automaton transitions
      };
      
      Object.freeze(this);
    }
    
    validateType(type) {
      if (!Object.values(CSSTokenType).includes(type)) {
        throw new TypeError(`Invalid token type: ${type}`);
      }
    }
    
    validatePosition(position) {
      if (!position || 
          typeof position.line !== 'number' || 
          typeof position.column !== 'number' ||
          position.line < 1 || 
          position.column < 1) {
        throw new TypeError('Invalid position object. Must have line and column numbers >= 1');
      }
    }
    
    // State management methods for automaton minimization
    computeStateSignature() {
      const components = [
        this.type,
        this.getTransitionsSignature(),
        this.getMetadataSignature()
      ];
      
      this.metadata.stateSignature = components.join('|');
      return this.metadata.stateSignature;
    }
    
    getTransitionsSignature() {
      return Array.from(this.metadata.transitions.entries())
        .map(([symbol, target]) => `${symbol}->${target.type}`)
        .sort()
        .join(',');
    }
    
    getMetadataSignature() {
      const relevantMetadata = {
        equivalenceClass: this.metadata.equivalenceClass
      };
      return JSON.stringify(relevantMetadata);
    }
    
    addTransition(symbol, targetToken) {
      if (!(targetToken instanceof CSSToken)) {
        throw new TypeError('Target must be a CSSToken instance');
      }
      
      // Create a new token with updated transitions
      const newTransitions = new Map(this.metadata.transitions);
      newTransitions.set(symbol, targetToken);
      
      return new CSSToken(
        this.type,
        this.value,
        this.position,
        {
          ...this.metadata,
          transitions: newTransitions
        }
      );
    }
    
    setEquivalenceClass(classId) {
      return new CSSToken(
        this.type,
        this.value,
        this.position,
        {
          ...this.metadata,
          equivalenceClass: classId
        }
      );
    }
    
    // Helper methods for token comparison and validation
    equals(other) {
      if (!(other instanceof CSSToken)) return false;
      
      return this.type === other.type &&
             this.value === other.value &&
             this.position.line === other.position.line &&
             this.position.column === other.position.column &&
             this.metadata.stateSignature === other.metadata.stateSignature;
    }
    
    isTypeOf(...types) {
      return types.includes(this.type);
    }
    
    toString() {
      return `${this.type}(${JSON.stringify(this.value)}) at ${this.position.line}:${this.position.column}`;
    }
    
    // Factory methods for common token types
    static createEOF(position) {
      return new CSSToken(CSSTokenType.EOF, '', position);
    }
    
    static createError(message, position) {
      return new CSSToken(CSSTokenType.Error, message, position);
    }
    
    static createWhitespace(value, position) {
      return new CSSToken(CSSTokenType.Whitespace, value, position);
    }
    
    // Validation and type checking methods
    static isStructureToken(token) {
      return token.isTypeOf(
        CSSTokenType.StartBlock,
        CSSTokenType.EndBlock,
        CSSTokenType.Semicolon,
        CSSTokenType.Colon,
        CSSTokenType.Comma
      );
    }
    
    static isSelectorToken(token) {
      return token.isTypeOf(
        CSSTokenType.Selector,
        CSSTokenType.PseudoClass,
        CSSTokenType.PseudoElement,
        CSSTokenType.Combinator
      );
    }
    
    static isValueToken(token) {
      return token.isTypeOf(
        CSSTokenType.Value,
        CSSTokenType.Unit,
        CSSTokenType.Number,
        CSSTokenType.Color,
        CSSTokenType.URL,
        CSSTokenType.String
      );
    }
    
    // State minimization helper methods
    static areEquivalent(token1, token2) {
      if (!(token1 instanceof CSSToken) || !(token2 instanceof CSSToken)) {
        return false;
      }
      
      // Compare basic properties
      if (token1.type !== token2.type) return false;
      
      // Compare transitions
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
    
    static computeEquivalenceClasses(tokens) {
      const classes = new Map();
      let nextClassId = 0;
      
      for (const token of tokens) {
        let found = false;
        
        for (const [classId, representatives] of classes) {
          if (representatives.some(rep => CSSToken.areEquivalent(rep, token))) {
            token.metadata.equivalenceClass = classId;
            representatives.push(token);
            found = true;
            break;
          }
        }
        
        if (!found) {
          const newClassId = nextClassId++;
          token.metadata.equivalenceClass = newClassId;
          classes.set(newClassId, [token]);
        }
      }
      
      return classes;
    }
  }