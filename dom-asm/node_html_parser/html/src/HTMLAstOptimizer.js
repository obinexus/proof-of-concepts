export class HTMLAstOptimizer {
  constructor() {
    this.stateClasses = new Map();
    this.nodeSignatures = new Map();
    this.minimizedNodes = new WeakMap();
  }

  optimize(ast) {
    // Phase 1: Build state equivalence classes
    this.buildStateClasses(ast);
    
    // Phase 2: Node reduction and path optimization
    const optimizedAST = this.optimizeNode(ast.root);
    
    // Phase 3: Memory optimization
    this.applyMemoryOptimizations(optimizedAST);

    // Compute optimization metrics
    const metrics = this.computeOptimizationMetrics(ast.root, optimizedAST);

    return {
      root: optimizedAST,
      metadata: {
        ...ast.metadata,
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
      
      if (node.children) {
        node.children.forEach(collectSignatures);
      }
    };
    
    collectSignatures(ast.root);
    
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
    
    // Add type and name
    components.push(node.type);
    if (node.name) components.push(node.name);
    
    // Add attributes signature
    if (node.attributes && node.attributes.size > 0) {
      const sortedAttrs = Array.from(node.attributes.entries())
        .sort(([k1], [k2]) => k1.localeCompare(k2));
      components.push(JSON.stringify(sortedAttrs));
    }
    
    // Add children types signature
    if (node.children && node.children.length > 0) {
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
    const optimized = {
      type: node.type,
      metadata: {
        ...node.metadata,
        isMinimized: true
      }
    };
    
    // Copy essential properties
    if (node.name) optimized.name = node.name;
    if (node.value) optimized.value = node.value;
    if (node.attributes) {
      optimized.attributes = new Map(
        Array.from(node.attributes.entries())
          .filter(([_, value]) => value !== null && value !== '')
      );
    }
    
    // Optimize children
    if (node.children && node.children.length > 0) {
      optimized.children = this.optimizeChildren(node.children);
    } else {
      optimized.children = [];
    }
    
    // Cache optimized node
    this.minimizedNodes.set(node, optimized);
    
    return optimized;
  }

  optimizeChildren(children) {
    // Remove redundant text nodes
    const optimizedChildren = children
      .filter(child => {
        if (child.type === 'Text') {
          return child.value && child.value.trim().length > 0;
        }
        return true;
      })
      .map(child => this.optimizeNode(child));
    
    // Merge adjacent text nodes
    return this.mergeAdjacentTextNodes(optimizedChildren);
  }

  mergeAdjacentTextNodes(children) {
    const merged = [];
    let currentTextNode = null;
    
    for (const child of children) {
      if (child.type === 'Text') {
        if (currentTextNode) {
          currentTextNode.value += child.value;
        } else {
          currentTextNode = { ...child };
          merged.push(currentTextNode);
        }
      } else {
        currentTextNode = null;
        merged.push(child);
      }
    }
    
    return merged;
  }

  applyMemoryOptimizations(node) {
    // Freeze objects to prevent modifications
    Object.freeze(node.metadata);
    if (node.attributes) {
      Object.freeze(node.attributes);
    }
    
    // Recursively optimize children
    if (node.children) {
      node.children.forEach(this.applyMemoryOptimizations.bind(this));
      Object.freeze(node.children);
    }
    
    // Freeze the node itself
    Object.freeze(node);
  }

  computeOptimizationMetrics(originalRoot, optimizedRoot) {
    const originalMetrics = this.getNodeMetrics(originalRoot);
    const optimizedMetrics = this.getNodeMetrics(optimizedRoot);
    
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
    
    // Estimate memory usage (simplified)
    metrics.estimatedMemory += this.estimateNodeMemory(node);
    
    if (node.children) {
      node.children.forEach(child => this.getNodeMetrics(child, metrics));
    }
    
    return metrics;
  }

  estimateNodeMemory(node) {
    let bytes = 0;
    
    // Base object overhead
    bytes += 40;
    
    // Type and name strings
    bytes += (node.type?.length ?? 0) * 2;
    bytes += (node.name?.length ?? 0) * 2;
    
    // Value for text nodes
    if (node.type === 'Text') {
      bytes += (node.value?.length ?? 0) * 2;
    }
    
    // Attributes
    if (node.attributes) {
      for (const [key, value] of node.attributes) {
        bytes += (key.length + value.length) * 2;
      }
    }
    
    // Metadata
    bytes += JSON.stringify(node.metadata).length * 2;
    
    return bytes;
  }
}