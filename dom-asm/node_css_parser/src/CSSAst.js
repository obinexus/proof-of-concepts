import { CSSToken, CSSTokenType } from './CSSToken.js';

export class CSSNode {
  constructor(type, value = null) {
    this.type = type;
    this.value = value;
    this.children = [];
    this.parent = null;
    this.metadata = {
      equivalenceClass: null,
      stateSignature: null,
      isMinimized: false
    };
  }

  addChild(node) {
    node.parent = this;
    this.children.push(node);
  }

  clone() {
    const newNode = new CSSNode(this.type, this.value);
    newNode.metadata = { ...this.metadata };
    newNode.children = this.children.map(child => child.clone());
    newNode.children.forEach(child => child.parent = newNode);
    return newNode;
  }
}

export class CSSAst {
  constructor() {
    this.stateClasses = new Map();
    this.nodeSignatures = new Map();
    this.minimizedNodes = new WeakMap();
  }

  buildAst(tokens) {
    const root = new CSSNode('stylesheet');
    let currentRule = null;
    let currentDeclaration = null;

    for (const token of tokens) {
      switch (token.type) {
        case CSSTokenType.Selector:
        case CSSTokenType.AtKeyword:
          if (currentRule === null) {
            currentRule = new CSSNode('rule');
            root.addChild(currentRule);
          }
          currentRule.addChild(new CSSNode('selector', token.value));
          break;

        case CSSTokenType.StartBlock:
          if (currentRule === null) {
            throw new Error('Unexpected block start');
          }
          break;

        case CSSTokenType.Property:
          currentDeclaration = new CSSNode('declaration');
          currentDeclaration.addChild(new CSSNode('property', token.value));
          if (currentRule) {
            currentRule.addChild(currentDeclaration);
          }
          break;

        case CSSTokenType.Colon:
          if (!currentDeclaration) {
            throw new Error('Unexpected colon');
          }
          break;

        case CSSTokenType.Value:
        case CSSTokenType.Number:
        case CSSTokenType.Color:
        case CSSTokenType.String:
          if (currentDeclaration) {
            currentDeclaration.addChild(new CSSNode('value', token.value));
          }
          break;

        case CSSTokenType.Unit:
          if (currentDeclaration && currentDeclaration.children.length > 0) {
            const lastChild = currentDeclaration.children[currentDeclaration.children.length - 1];
            if (lastChild.type === 'value') {
              lastChild.value = `${lastChild.value}${token.value}`;
            }
          }
          break;

        case CSSTokenType.Semicolon:
          currentDeclaration = null;
          break;

        case CSSTokenType.EndBlock:
          currentRule = null;
          currentDeclaration = null;
          break;
      }
    }

    return root;
  }

  optimize(ast) {
    // Phase 1: Build state equivalence classes
    this.buildStateClasses(ast);
    
    // Phase 2: Node reduction and path optimization
    const optimizedAST = this.optimizeNode(ast);
    
    // Phase 3: Memory optimization
    this.applyMemoryOptimizations(optimizedAST);

    // Compute optimization metrics
    const metrics = this.computeOptimizationMetrics(ast, optimizedAST);

    return {
      root: optimizedAST,
      metadata: {
        optimizationMetrics: metrics
      }
    };
  }

  buildStateClasses(ast) {
    const stateSignatures = new Map();
    
    // First pass: Collect state signatures
    const collectSignatures = (node) => {
      const signature = this.computeNodeSignature(node);
      if (!stateSignatures.has(signature)) {
        stateSignatures.set(signature, new Set());
      }
      stateSignatures.get(signature).add(node);
      
      for (const child of node.children) {
        collectSignatures(child);
      }
    };
    
    collectSignatures(ast);
    
    // Second pass: Build equivalence classes
    let classId = 0;
    for (const [signature, nodes] of stateSignatures) {
      if (nodes.size > 1) {
        this.stateClasses.set(classId, {
          signature,
          nodes: new Set(nodes)
        });
        classId++;
      }
    }
  }

  computeNodeSignature(node) {
    const components = [];
    
    // Add type and value
    components.push(node.type);
    if (node.value !== null) components.push(node.value);
    
    // Add children types signature
    if (node.children.length > 0) {
      const childrenTypes = node.children.map(c => c.type).join(',');
      components.push(childrenTypes);
    }
    
    return components.join('|');
  }

  optimizeNode(node) {
    // Check if node has already been minimized
    if (this.minimizedNodes.has(node)) {
      return this.minimizedNodes.get(node);
    }
    
    // Create optimized node
    const optimized = new CSSNode(node.type, node.value);
    optimized.metadata.isMinimized = true;
    
    // Optimize children
    if (node.children.length > 0) {
      optimized.children = this.optimizeChildren(node.children);
      optimized.children.forEach(child => child.parent = optimized);
    }
    
    // Cache optimized node
    this.minimizedNodes.set(node, optimized);
    
    return optimized;
  }

  optimizeChildren(children) {
    // Remove redundant nodes
    const optimizedChildren = children
      .filter(child => {
        if (child.type === 'value') {
          return child.value !== null && child.value.trim().length > 0;
        }
        return true;
      })
      .map(child => this.optimizeNode(child));
    
    // Merge adjacent text nodes
    return this.mergeAdjacentValues(optimizedChildren);
  }

  mergeAdjacentValues(children) {
    const merged = [];
    let currentValue = null;
    
    for (const child of children) {
      if (child.type === 'value') {
        if (currentValue) {
          currentValue.value += child.value;
        } else {
          currentValue = child;
          merged.push(currentValue);
        }
      } else {
        currentValue = null;
        merged.push(child);
      }
    }
    
    return merged;
  }

  applyMemoryOptimizations(node) {
    // Freeze metadata
    Object.freeze(node.metadata);
    
    // Recursively optimize children
    for (const child of node.children) {
      this.applyMemoryOptimizations(child);
    }
    Object.freeze(node.children);
    
    // Freeze the node itself
    Object.freeze(node);
  }

  computeOptimizationMetrics(originalAst, optimizedAst) {
    const originalMetrics = this.getNodeMetrics(originalAst);
    const optimizedMetrics = this.getNodeMetrics(optimizedAst);
    
    return {
      nodeReduction: {
        original: originalMetrics.totalNodes,
        optimized: optimizedMetrics.totalNodes,
        ratio: optimizedMetrics.totalNodes / originalMetrics.totalNodes
      },
      memoryUsage: {
        original: originalMetrics.estimatedMemory,
        optimized: optimizedMetrics.estimatedMemory,
        ratio: optimizedMetrics.estimatedMemory / originalMetrics.estimatedMemory
      },
      stateClasses: {
        count: this.stateClasses.size,
        averageSize: Array.from(this.stateClasses.values())
          .reduce((acc, cls) => acc + cls.nodes.size, 0) / this.stateClasses.size
      }
    };
  }

  getNodeMetrics(node, metrics = { totalNodes: 0, estimatedMemory: 0 }) {
    metrics.totalNodes++;
    
    // Estimate memory usage
    metrics.estimatedMemory += this.estimateNodeMemory(node);
    
    for (const child of node.children) {
      this.getNodeMetrics(child, metrics);
    }
    
    return metrics;
  }

  estimateNodeMemory(node) {
    let bytes = 0;
    
    // Base object overhead
    bytes += 40;
    
    // Type and value
    bytes += (node.type?.length ?? 0) * 2;
    bytes += (node.value?.toString().length ?? 0) * 2;
    
    // Metadata
    bytes += JSON.stringify(node.metadata).length * 2;
    
    return bytes;
  }

  // Additional utility methods for AST analysis and manipulation
  findNodesByType(ast, type) {
    const nodes = [];
    const traverse = (node) => {
      if (node.type === type) {
        nodes.push(node);
      }
      for (const child of node.children) {
        traverse(child);
      }
    };
    traverse(ast);
    return nodes;
  }

  findNodesByValue(ast, value) {
    const nodes = [];
    const traverse = (node) => {
      if (node.value === value) {
        nodes.push(node);
      }
      for (const child of node.children) {
        traverse(child);
      }
    };
    traverse(ast);
    return nodes;
  }

  getNodeDepth(node) {
    let depth = 0;
    let current = node;
    while (current.parent) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  toString(ast, indent = 0) {
    const indentStr = ' '.repeat(indent * 2);
    let result = `${indentStr}${ast.type}`;
    if (ast.value !== null) {
      result += `: ${ast.value}`;
    }
    if (ast.metadata.equivalenceClass !== null) {
      result += ` [class: ${ast.metadata.equivalenceClass}]`;
    }
    result += '\n';
    
    for (const child of ast.children) {
      result += this.toString(child, indent + 1);
    }
    
    return result;
  }
}