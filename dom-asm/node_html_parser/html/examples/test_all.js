import { HTMLParser, HTMLAstOptimizer } from '../src/index.js';

// Example HTML content
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML Parser Test Document</title>
    <!-- Test comment with special chars: <>&'" -->
    <style>
        body { font-family: Arial, sans-serif; }
    </style>
</head>
<body>
    <!-- Test nested elements and attributes -->
    <div id="container" class="main-content" data-test="value">
        <h1>HTML Parser Test</h1>
        
        <!-- Test text content -->
        <p>This is a paragraph with <strong>bold text</strong> and <em>emphasized text</em>.</p>
        
        <!-- Test self-closing tags -->
        <img src="test.jpg" alt="Test image"/>
        <br/>
        
        <!-- Test whitespace handling -->
        <div class="whitespace-test">
            Text with    multiple    spaces
            and line
            breaks
        </div>
        
        <!-- Test special characters -->
        <p class="special-chars">Special characters: &lt; &gt; &amp; &quot; &apos;</p>
        
        <!-- Test empty elements -->
        <div></div>
        <span>   </span>
        
        <!-- Test lists -->
        <ul>
            <li>Item 1</li>
            <li>Item 2
                <ul>
                    <li>Nested item 1</li>
                    <li>Nested item 2</li>
                </ul>
            </li>
            <li>Item 3</li>
        </ul>
        
        <!-- Test forms -->
        <form action="/submit" method="post">
            <input type="text" name="username" required/>
            <input type="password" name="password"/>
            <select name="options">
                <option value="1">Option 1</option>
                <option value="2">Option 2</option>
            </select>
            <button type="submit">Submit</button>
        </form>
        
        <!-- Test tables -->
        <table border="1">
            <thead>
                <tr>
                    <th>Header 1</th>
                    <th>Header 2</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Cell 1</td>
                    <td>Cell 2</td>
                </tr>
            </tbody>
        </table>
        
        <!-- Test CDATA section -->
        <![CDATA[
            This is a CDATA section with <tags> and &entities;
        ]]>
        
        <!-- Test conditional comments -->
        <!--[if IE]>
            <p>This is visible in IE</p>
        <![endif]-->
        
        <!-- Test script tags -->
        <script type="text/javascript">
            // This is a JavaScript comment
            function test() {
                return '<div>This should not be parsed as HTML</div>';
            }
        </script>
    </div>
</body>
</html>
`;

// Initialize parser and optimizer
const parser = new HTMLParser();
const optimizer = new HTMLAstOptimizer();

// Parse and optimize the HTML content
const ast = parser.parse(html);
const optimizedAst = optimizer.optimize(ast);

// Log the AST structures
if (!optimizedAst) {
  console.error('Optimization failed: No AST returned.');
} else {
  console.log('Original AST Structure:', JSON.stringify(ast, null, 2));
  console.log('Optimized AST Structure:', JSON.stringify(optimizedAst, null, 2));

  // Traverse both ASTs for comparison
  function traverseAST(node, depth = 0, isOptimized = false) {
    const indent = '  '.repeat(depth);
    const type = node.type || 'Unknown';
    const name = node.name || '';
    const value = node.value || '';
    
    console.log(`${indent}${isOptimized ? '[OPT] ' : ''}${type}${name ? ': ' + name : ''}${value ? ' = ' + value : ''}`);
    
    if (node.attributes && typeof node.attributes === 'object' && node.attributes.size > 0) {
      console.log(`${indent}Attributes:`, Object.fromEntries(node.attributes));
    }
    
    if (node.metadata?.isMinimized) {
      console.log(`${indent}[Minimized State: ${node.metadata.equivalenceClass}]`);
    }
    
    (node.children || []).forEach(child => traverseAST(child, depth + 1, isOptimized));
  }

  console.log('\nOriginal AST Traversal:');
  traverseAST(ast.root);
  
  console.log('\nOptimized AST Traversal:');
  traverseAST(optimizedAst.root, 0, true);

  // Log optimization metrics
  console.log('\nOriginal Metrics:');
  console.log('Total Nodes:', ast.metadata?.nodeCount || 0);
  console.log('Elements:', ast.metadata?.elementCount || 0);
  console.log('Text Nodes:', ast.metadata?.textCount || 0);
  console.log('Comments:', ast.metadata?.commentCount || 0);
  
  console.log('\nOptimization Metrics:');
  const { nodeReduction, memoryUsage, stateClasses } = optimizedAst.metadata.optimizationMetrics;
  console.log('Node Reduction:', `${((1 - nodeReduction.ratio) * 100).toFixed(1)}%`);
  console.log('Memory Savings:', `${((1 - memoryUsage.ratio) * 100).toFixed(1)}%`);
  console.log('State Classes:', stateClasses.count);
  console.log('Average Class Size:', stateClasses.averageSize.toFixed(2));
}