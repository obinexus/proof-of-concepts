// Define the JavaScriptTokenType class

import { JSToken } from "src/types";

// Define the JSTokenType interface
export interface JSTokenType {
    toString(): string;
    equals(other: JSTokenType): boolean;
}

/**
 * Represents a type of JavaScript token.
 * This class is used to categorize different types of tokens that can be encountered
 * during the tokenization of JavaScript code.
 *
 * @example
 * ```typescript
 * const keywordToken = JavaScriptTokenType.KEYWORD;
 * console.log(keywordToken.toString()); // Outputs: "KEYWORD"
 *
 * const identifierToken = JavaScriptTokenType.IDENTIFIER;
 * console.log(identifierToken.toString()); // Outputs: "IDENTIFIER"
 * ```
 */
export class JavaScriptTokenType implements JSTokenType {

    private readonly type: string;

    private constructor(type: string) {
        this.type = type;
    }

    public static readonly KEYWORD = new JavaScriptTokenType("KEYWORD");
    public static readonly IDENTIFIER = new JavaScriptTokenType("IDENTIFIER");
    public static readonly LITERAL = new JavaScriptTokenType("LITERAL");
    public static readonly OPERATOR = new JavaScriptTokenType("OPERATOR");
    public static readonly PUNCTUATOR = new JavaScriptTokenType("PUNCTUATOR");
    public static readonly COMMENT = new JavaScriptTokenType("COMMENT");
    public static readonly WHITESPACE = new JavaScriptTokenType("WHITESPACE");
    public static readonly TEMPLATE = new JavaScriptTokenType("TEMPLATE");
    public static readonly REGEXP = new JavaScriptTokenType("REGEXP");

    public toString(): string {
        return this.type;
    }

    public equals(other: JavaScriptTokenType): boolean {
        return this.type === other.type;
    }
}

// Define the JavaScriptTokenValue class
export class JavaScriptTokenValue {
    private readonly value: string;

    constructor(value: string) {
        this.value = value;
    }

    public toString(): string {
        return this.value;
    }

    public equals(other: JavaScriptTokenValue): boolean {
        return this.value === other.value;
    }
}

// Define the JavaScriptToken class that uses JavaScriptTokenType and JavaScriptTokenValue
export class JavaScriptToken implements JSToken  {
    private readonly type: JavaScriptTokenType | string;
    private readonly value: JavaScriptTokenValue;

    constructor(type: JavaScriptTokenType, value: JavaScriptTokenValue) {
        this.type = type;
        this.value = value;
    }

    public getType(): JavaScriptTokenType {
        return this.type;
    }

    public getValue(): JavaScriptTokenValue {
        return this.value;
    }

    public toString(): string {
        return `Type: ${this.type.toString()}, Value: ${this.value.toString()}`;
    }

    public equals(other: JavaScriptToken): boolean {
        return this.type instanceof JavaScriptTokenType && other.type instanceof JavaScriptTokenType && this.type.equals(other.type) && this.value.equals(other.value);
    }

    public isType(type: JavaScriptTokenType): boolean {
        return this.type instanceof JavaScriptTokenType && this.type.equals(type);
    }
}

export class JavaScriptInvalidTokenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'JavaScriptInvalidTokenError';
        super.stack = new Error().stack;
        
    }


}
