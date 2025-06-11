
import { CSSTokenizer, CSSParser } from '../src/index.js';

// Performance comparison between approaches
class BenchmarkRunner {
    static async compareParserApproaches(css) {
      // Our current optimized parser
      console.log('Testing Optimized Parser:');
      const optimizedStart = performance.now();
      const tokenizer = new CSSTokenizer(css);
      const tokens = tokenizer.tokenize();
      const parser = new CSSParser(tokens);
      const ast = parser.parse();
      const optimizedTime = performance.now() - optimizedStart;
  
      // Traditional automaton minimization (Hopcroft's algorithm)
      console.log('\nTesting Traditional Automaton:');
      const automatonStart = performance.now();
      const automaton = new HTMLParser(); // From HTMLParser.js in context
      const minimizedAst = automaton.parse(css);
      const automatonTime = performance.now() - automatonStart;
  
      // Comparison metrics
      const comparison = {
        optimizedParser: {
          time: optimizedTime,
          memory: process.memoryUsage().heapUsed,
          states: tokens.length,
          astNodes: countNodes(ast)
        },
        traditionalAutomaton: {
          time: automatonTime,
          memory: process.memoryUsage().heapUsed,
          states: automaton.states.size,
          astNodes: countNodes(minimizedAst)
        }
      };
  
      console.log('\nPerformance Comparison:');
      console.log(`Optimized Parser:
    - Time: ${optimizedTime.toFixed(2)}ms
    - States: ${comparison.optimizedParser.states}
    - AST Nodes: ${comparison.optimizedParser.astNodes}
    - Memory: ${(comparison.optimizedParser.memory / 1024 / 1024).toFixed(2)}MB`);
  
      console.log(`\nTraditional Automaton:
    - Time: ${automatonTime.toFixed(2)}ms
    - States: ${comparison.traditionalAutomaton.states}
    - AST Nodes: ${comparison.traditionalAutomaton.astNodes}
    - Memory: ${(comparison.traditionalAutomaton.memory / 1024 / 1024).toFixed(2)}MB`);
  
      return comparison;
    }
  }
  
  function countNodes(node, count = { total: 0 }) {
    count.total++;
    if (node.children) {
      node.children.forEach(child => countNodes(child, count));
    }
    if (node.declarations) {
      count.total += node.declarations.length;
    }
    return count.total;
  }


import fs from 'fs';
  const css = fs.readFileSync('test.css', 'utf8')
  await BenchmarkRunner.compareParserApproaches(css);