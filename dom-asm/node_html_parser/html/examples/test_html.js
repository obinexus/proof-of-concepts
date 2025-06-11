import {HTMLParser} from '../src/index.js';

// Example HTML content
const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Test Page</title>
  </head>
  <body>
    <!-- Navigation -->
    <nav class="menu">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
    
    <div class="content">
      <h1>Welcome!</h1>
      <p>This is a test page.</p>
    </div>
  </body>
</html>
`;

// Initialize parser
const parser = new HTMLParser();

// Parse the HTML content
const ast = parser.parse(html);

// Log the AST structure
if (!ast) {
  console.error('Parsing failed: No AST returned.');
} else {
  console.log('AST Structure:', JSON.stringify(ast, null, 2));

  // Example of traversing the AST
  function traverseAST(node, depth = 0) {
    const indent = '  '.repeat(depth);
    const type = node.type || 'Unknown';
    const name = node.name || '';
    const value = node.value || '';

    console.log(`${indent}${type}${name ? ': ' + name : ''}${value ? ' = ' + value : ''}`);
    
    if (node.attributes && typeof node.attributes === 'object' && node.attributes.size > 0) {
      console.log(`${indent}Attributes:`, Object.fromEntries(node.attributes));
    }

    (node.children || []).forEach(child => traverseAST(child, depth + 1));
  }

  console.log('\nAST Traversal:');
  if (ast.root) {
    traverseAST(ast.root);
  } else {
    console.error('AST root is missing!');
  }

  // Log optimization metrics
  console.log('\nOptimization Metrics:', ast.metadata?.minimizationMetrics || {});
  console.log('Total Nodes:', ast.metadata?.nodeCount || 0);
  console.log('Elements:', ast.metadata?.elementCount || 0);
  console.log('Text Nodes:', ast.metadata?.textCount || 0);
  console.log('Comments:', ast.metadata?.commentCount || 0);
}
