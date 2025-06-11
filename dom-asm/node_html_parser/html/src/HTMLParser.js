import {  HTMLTokenizer } from './HTMLTokenizer.js';
import {HTMLToken} from './HTMLToken.js';

export class HTMLParserError extends Error {
  constructor(message, token, state, position) {
    super(`${message} at position ${position}`);
    this.name = 'HTMLParserError';
    this.token = token;
    this.state = state;
    this.position = position;
  }
}

export class HTMLParser {
  constructor() {
    this.states = new Set();
    this.currentState = null;
    this.equivalenceClasses = new Map();
    this.optimizedStateMap = new Map();
    this.initializeStates();
  }

  initializeStates() {
    const initialState = {
      type: 'Initial',
      isAccepting: false,
      transitions: new Map()
    };

    const inTagState = {
      type: 'InTag',
      isAccepting: false,
      transitions: new Map()
    };

    const inContentState = {
      type: 'InContent',
      isAccepting: true,
      transitions: new Map()
    };

    const inCommentState = {
      type: 'InComment',
      isAccepting: false,
      transitions: new Map()
    };

    const inDoctypeState = {
      type: 'InDoctype',
      isAccepting: false,
      transitions: new Map()
    };

    const finalState = {
      type: 'Final',
      isAccepting: true,
      transitions: new Map()
    };

    // Set up transitions
    initialState.transitions.set('<', inTagState);
    initialState.transitions.set('text', inContentState);
    inTagState.transitions.set('>', inContentState);
    inTagState.transitions.set('!', inDoctypeState);
    inTagState.transitions.set('<!--', inCommentState);
    inContentState.transitions.set('<', inTagState);
    inContentState.transitions.set('EOF', finalState);
    inCommentState.transitions.set('-->', inContentState);
    inDoctypeState.transitions.set('>', inContentState);
    
    // Initialize state collections
    this.states.clear();
    this.states.add(initialState);
    this.states.add(inTagState);
    this.states.add(inContentState);
    this.states.add(inCommentState);
    this.states.add(inDoctypeState);
    this.states.add(finalState);
    
    // Set initial state
    this.currentState = initialState;
    
    // Clear and initialize maps
    this.equivalenceClasses.clear();
    this.optimizedStateMap.clear();
  }

  parse(input) {
    const tokenizer = new HTMLTokenizer(input);
    const { tokens } = tokenizer.tokenize();
    
    this.minimizeStates();
    const ast = this.buildOptimizedAST(tokens);
    return this.optimizeAST(ast);
  }

  minimizeStates() {
    const accepting = new Set([...this.states].filter(s => s.isAccepting));
    const nonAccepting = new Set([...this.states].filter(s => !s.isAccepting));
    
    let partition = [accepting, nonAccepting];
    let newPartition = [];
    
    do {
      partition = newPartition.length > 0 ? newPartition : partition;
      newPartition = [];
      
      for (const block of partition) {
        const splits = this.splitBlock(block, partition);
        newPartition.push(...splits);
      }
    } while (newPartition.length !== partition.length);
    
    partition.forEach((block, index) => {
      this.equivalenceClasses.set(index, block);
    });
  }

  splitBlock(block, partition) {
    if (block.size <= 1) return [block];
    
    const splits = new Map();
    
    for (const state of block) {
      const signature = this.getStateSignature(state, partition);
      if (!splits.has(signature)) {
        splits.set(signature, new Set());
      }
      splits.get(signature).add(state);
    }
    
    return Array.from(splits.values());
  }

  getStateSignature(state, partition) {
    const transitions = [];
    
    for (const [symbol, targetState] of state.transitions) {
      const targetPartition = partition.findIndex(block => block.has(targetState));
      transitions.push(`${symbol}:${targetPartition}`);
    }
    
    return transitions.sort().join('|');
  }

  buildOptimizedAST(tokens) {
    const root = {
      type: 'Element',
      name: 'root',
      children: [],
      metadata: {
        equivalenceClass: 0,
        isMinimized: false
      }
    };

    const stack = [root];
    let currentNode = root;
    
    for (const token of tokens) {
      try {
        currentNode = this.processTokenWithOptimizedState(token, currentNode, stack);
      } catch (error) {
        if (error instanceof HTMLParserError) {
          this.handleParserError(error, currentNode);
        }
      }
    }

    return {
      root,
      metadata: this.computeOptimizedMetadata(root)
    };
  }

  processTokenWithOptimizedState(token, currentNode, stack) {
    const optimizedState = this.optimizedStateMap.get(this.currentState) || this.currentState;
    
    switch (token.type) {
      case 'StartTag': {
        const element = {
          type: 'Element',
          name: token.name,
          attributes: token.attributes ?? new Map(),
          children: [],
          metadata: {
            equivalenceClass: this.getEquivalenceClass(optimizedState),
            isMinimized: true
          }
        };
        
        currentNode.children.push(element);
        if (!token.selfClosing) {
          stack.push(element);
          currentNode = element;
        }
        break;
      }

      case 'EndTag': {
        if (stack.length > 1) {
          for (let i = stack.length - 1; i >= 1; i--) {
            if (stack[i].name === token.name) {
              currentNode = stack[i];
              stack.length = i + 1;
              return stack[i - 1];
            }
          }
          if (stack.length > 1) {
            stack.pop();
            currentNode = stack[stack.length - 1];
          }
        }
        break;
      }

      case 'Text': {
        if (token.content.trim() || token.isWhitespace) {
          const node = {
            type: 'Text',
            value: token.content,
            children: [],
            metadata: {
              equivalenceClass: this.getEquivalenceClass(optimizedState),
              isMinimized: true
            }
          };
          currentNode.children.push(node);
        }
        break;
      }

      case 'Comment': {
        const node = {
          type: 'Comment',
          value: token.data,
          children: [],
          metadata: {
            equivalenceClass: this.getEquivalenceClass(optimizedState),
            isMinimized: true
          }
        };
        currentNode.children.push(node);
        break;
      }
    }

    return currentNode;
  }

  optimizeAST(ast) {
    this.mergeTextNodes(ast.root);
    this.removeRedundantNodes(ast.root);
    this.optimizeAttributes(ast.root);
    
    ast.metadata.minimizationMetrics = {
      originalStateCount: this.states.size,
      minimizedStateCount: this.equivalenceClasses.size,
      optimizationRatio: this.equivalenceClasses.size / this.states.size
    };
    
    return ast;
  }

  mergeTextNodes(node) {
    if (!node.children.length) return;

    for (const child of node.children) {
      if (child.type === 'Element') {
        this.mergeTextNodes(child);
      }
    }

    let i = 0;
    while (i < node.children.length - 1) {
      const current = node.children[i];
      const next = node.children[i + 1];
      
      if (current.type === 'Text' && next.type === 'Text') {
        current.value = (current.value || '') + (next.value || '');
        node.children.splice(i + 1, 1);
      } else {
        i++;
      }
    }
  }

  removeRedundantNodes(node) {
    node.children = node.children.filter(child => {
      if (child.type === 'Text') {
        return child.value && child.value.trim().length > 0;
      }
      this.removeRedundantNodes(child);
      return true;
    });
  }

  optimizeAttributes(node) {
    if (node.attributes) {
      const optimizedAttributes = new Map();
      for (const [key, value] of node.attributes.entries()) {
        const normalizedKey = key.toLowerCase();
        optimizedAttributes.set(normalizedKey, value);
      }
      node.attributes = optimizedAttributes;
    }
    
    node.children.forEach(child => this.optimizeAttributes(child));
  }

  getEquivalenceClass(state) {
    for (const [classId, states] of this.equivalenceClasses) {
      if (states.has(state)) return classId;
    }
    return -1;
  }

  handleParserError(error, currentNode) {
    console.error(`Parser error in state ${error.state.type}:`, error.message);
  }

  computeOptimizedMetadata(root) {
    const metadata = {
      nodeCount: 0,
      elementCount: 0,
      textCount: 0,
      commentCount: 0
    };

    const countNodes = (node) => {
      metadata.nodeCount++;
      switch (node.type) {
        case 'Element':
          metadata.elementCount++;
          break;
        case 'Text':
          metadata.textCount++;
          break;
        case 'Comment':
          metadata.commentCount++;
          break;
      }
      node.children.forEach(countNodes);
    };

    countNodes(root);
    return metadata;
  }
}