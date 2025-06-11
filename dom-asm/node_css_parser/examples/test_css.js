// test_css.js
import { promises as fs } from 'fs';
import { CSSTokenizer, CSSParser } from '../src/index.js';

async function testCSS(css) {
  try {
    console.log('🔍 Starting CSS Test');
    console.log(`📊 Input size: ${css.length} bytes\n`);

    // Tokenization phase
    console.log('🔄 Tokenizing...');
    const tokenizeStart = performance.now();
    const tokenizer = new CSSTokenizer(css);
    const tokens = tokenizer.tokenize();
    const tokenizeTime = performance.now() - tokenizeStart;
    
    // Token statistics
    const tokenTypes = new Map();
    tokens.forEach(token => {
      const count = tokenTypes.get(token.type) || 0;
      tokenTypes.set(token.type, count + 1);
    });

    console.log(`✅ Tokenization complete: ${tokens.length} tokens in ${tokenizeTime.toFixed(2)}ms`);
    console.log('\nToken distribution:');
    tokenTypes.forEach((count, type) => {
      console.log(`  ${type}: ${count}`);
    });

    // Parsing phase
    console.log('\n🔄 Parsing...');
    const parseStart = performance.now();
    const parser = new CSSParser(tokens);
    const ast = parser.parse();
    const parseTime = performance.now() - parseStart;

    // Collect AST statistics
    const stats = collectASTStats(ast);

    console.log(`✅ Parsing complete in ${parseTime.toFixed(2)}ms\n`);
    console.log('AST Statistics:');
    console.log(`  Rules: ${stats.rules}`);
    console.log(`  Declarations: ${stats.declarations}`);
    console.log(`  At-rules: ${stats.atRules}`);
    console.log(`  Total nodes: ${stats.totalNodes}`);

    if (parser.errors.length > 0) {
      console.log('\n⚠️ Parser warnings:');
      parser.errors.forEach(error => {
        console.log(`  - ${error.message}`);
      });
    }

    return {
      tokens,
      ast,
      stats: {
        tokenization: {
          time: tokenizeTime,
          count: tokens.length,
          types: tokenTypes
        },
        parsing: {
          time: parseTime,
          ...stats
        }
      }
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  }
}

function collectASTStats(ast) {
  const stats = {
    rules: 0,
    declarations: 0,
    atRules: 0,
    totalNodes: 0
  };

  function traverse(node) {
    stats.totalNodes++;

    if (node.type === 'rule') {
      stats.rules++;
      if (node.declarations) {
        stats.declarations += node.declarations.length;
      }
    } else if (node.type === 'at-rule') {
      stats.atRules++;
    }

    // Traverse children
    if (node.children) {
      node.children.forEach(traverse);
    }
    if (node.rules) {
      node.rules.forEach(traverse);
    }
  }

  traverse(ast);
  return stats;
}

// Read input CSS and run test
try {
  const css = await fs.readFile('./test.css', { encoding: 'utf8' });
  await testCSS(css);
} catch (error) {
  console.error('Failed to read CSS file:', error);
}