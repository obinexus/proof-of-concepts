import { JavaScriptTokenizer } from 'src/tokenizer/JavaScriptTokenizer';
import { JavaScriptAst } from './JavaScriptAst';
import { JavaScriptAstValidator } from './JavaScriptAstValidator';

export class JavaScriptParser {
  private tokenizer: JavaScriptTokenizer;
  private validator: JavaScriptAstValidator;

  constructor() {
    this.tokenizer = new JavaScriptTokenizer();
    this.validator = new JavaScriptAstValidator();
  }

  public parse(source: string): JavaScriptAst {
    const tokens = this.tokenizer.tokenize(source);
    const ast = JavaScriptAst.build(tokens );
    const errors = this.validator.validate(ast.root);

    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.map(e => e.message).join(', ')}`);
    }

    return ast;
  }
}