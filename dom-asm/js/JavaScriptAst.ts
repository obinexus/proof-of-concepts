import { JSToken, JSTokenType } from "src/types";
import { JavaScriptAstNode, JavaScriptNodeTypeMap } from "./JavaScriptAstNode";

// Define the JavaScriptAst class
export class JavaScriptAst {
  public root: JavaScriptAstNode;

  constructor(root: JavaScriptAstNode, tokens: JSToken[]) {
    this.root = root;
    this.tokens = tokens;
  }

  public minimize(): JavaScriptAst {
    this.root = this.root.minimize();
    return this;
  }

  public static build(tokens: JSToken[]): JavaScriptAst {
    const builder = new JavaScriptAst(new JavaScriptAstNode(JavaScriptNodeTypeMap.Program, undefined, []), tokens);
    const root = builder.buildAST();
    return new JavaScriptAst(root, tokens);
  }

  private tokens: JSToken[] = [];
  private position: number = 0;

  private currentToken(): JSToken | null {
    return this.tokens[this.position] || null;
  }

  private consumeToken(): JSToken {
    if (this.position >= this.tokens.length) {
      throw new Error('Unexpected end of input');
    }
    return this.tokens[this.position++];
  }

  public peekToken(): JSToken | null {
    return this.tokens[this.position + 1] || null;
  }

  private parseProgram(): JavaScriptAstNode {
    const program: JavaScriptAstNode = new JavaScriptAstNode(JavaScriptNodeTypeMap.Program, undefined, []);

    while (this.position < this.tokens.length) {
      const statement = this.parseStatement();
      if (statement) {
        program.children!.push(statement);
      }
    }

    return program;
  }

  private parseStatement(): JavaScriptAstNode | null {
    const token = this.currentToken();
    if (!token) {
      return null;
    }

    if (token.type === JSTokenType.Keyword && token.value === "const") {
      return this.parseVariableDeclaration();
    }

    return null;
  }
  
  private parseVariableDeclaration(): JavaScriptAstNode {
    this.consumeToken(); // consume 'const'
    const identifier = this.consumeToken();
    if (!identifier || identifier.type !== JSTokenType.Identifier) {
      throw new Error("Expected identifier after 'const'");
    }

    const equals = this.consumeToken();
    if (!equals || equals.type !== JSTokenType.Operator || equals.value !== "=") {
      throw new Error("Expected '=' after identifier");
    }

    const value = this.consumeToken();
    if (!value || value.type !== JSTokenType.Literal) {
      throw new Error("Expected literal value after '='");
    }

    const semicolon = this.consumeToken();
    if (!semicolon || semicolon.type !== JSTokenType.Delimiter || semicolon.value !== ";") {
      throw new Error("Expected ';' after value");
    }

    return new JavaScriptAstNode(JavaScriptNodeTypeMap.VariableDeclaration, undefined, [
      new JavaScriptAstNode(JavaScriptNodeTypeMap.Identifier, identifier.value, []),
      new JavaScriptAstNode(JavaScriptNodeTypeMap.Literal, value.value, [])
    ]);
  }

  public buildAST(): JavaScriptAstNode {
    return this.parseProgram();
  }
}
