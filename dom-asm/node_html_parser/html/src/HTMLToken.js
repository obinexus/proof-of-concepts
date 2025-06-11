import {HTMLTokenType } from './HTMLTokenType.js'
// HTMLToken.js - Shift-reduce string-based token implementation
export class HTMLToken {
  constructor(rawString) {
    this.rawString = rawString;
    this.currentPos = 0;
    this.tokens = [];
    this.stack = [];
  }

  // Shift a character onto the stack
  shift() {
    if (this.currentPos < this.rawString.length) {
      this.stack.push(this.rawString[this.currentPos]);
      this.currentPos++;
      return true;
    }
    return false;
  }

  // Try to reduce the stack to a token
  reduce() {
    const stackContent = this.stack.join('');
    
    // Try to match patterns from most specific to least specific
    if (this.matchStartTag(stackContent)) return true;
    if (this.matchEndTag(stackContent)) return true;
    if (this.matchComment(stackContent)) return true;
    if (this.matchDoctype(stackContent)) return true;
    if (this.matchCDATA(stackContent)) return true;
    if (this.matchText(stackContent)) return true;
    
    return false;
  }

  matchStartTag(content) {
    const match = content.match(/^<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^>\/\s]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^>\s]+))?)*)\s*(\/?)>/);
    if (match) {
      const [fullMatch, tagName, attributesStr, selfClosing] = match;
      const attributes = this.parseAttributes(attributesStr);
      
      this.tokens.push({
        type: 'StartTag',
        name: tagName.toLowerCase(),
        attributes,
        selfClosing: Boolean(selfClosing),
        raw: fullMatch
      });
      
      this.stack = [];
      return true;
    }
    return false;
  }

  matchEndTag(content) {
    const match = content.match(/^<\/([a-zA-Z][a-zA-Z0-9:-]*)\s*>/);
    if (match) {
      const [fullMatch, tagName] = match;
      
      this.tokens.push({
        type: 'EndTag',
        name: tagName.toLowerCase(),
        raw: fullMatch
      });
      
      this.stack = [];
      return true;
    }
    return false;
  }

  matchComment(content) {
    if (content.startsWith('<!--') && content.endsWith('-->')) {
      const commentData = content.slice(4, -3).trim();
      
      this.tokens.push({
        type: 'Comment',
        data: commentData,
        raw: content
      });
      
      this.stack = [];
      return true;
    }
    return false;
  }

  matchDoctype(content) {
    const match = content.match(/^<!DOCTYPE\s+([^>]+)>/i);
    if (match) {
      const [fullMatch, doctypeContent] = match;
      
      this.tokens.push({
        type: 'Doctype',
        name: doctypeContent.trim(),
        raw: fullMatch
      });
      
      this.stack = [];
      return true;
    }
    return false;
  }

  matchCDATA(content) {
    if (content.startsWith('<![CDATA[') && content.endsWith(']]>')) {
      const cdataContent = content.slice(9, -3);
      
      this.tokens.push({
        type: 'CDATA',
        content: cdataContent,
        raw: content
      });
      
      this.stack = [];
      return true;
    }
    return false;
  }

  matchText(content) {
    // Only reduce text when we hit a < character or end of input
    if (this.currentPos >= this.rawString.length || 
        this.rawString[this.currentPos] === '<') {
      if (content.length > 0) {
        this.tokens.push({
          type: 'Text',
          content: content,
          isWhitespace: /^\s*$/.test(content),
          raw: content
        });
        
        this.stack = [];
        return true;
      }
    }
    return false;
  }

  parseAttributes(attributesStr) {
    const attributes = new Map();
    const pattern = /([^=\s]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^>\s]+)))?/g;
    let match;
    
    while ((match = pattern.exec(attributesStr))) {
      const [, name, quotedValue1, quotedValue2, unquotedValue] = match;
      const value = quotedValue1 || quotedValue2 || unquotedValue || '';
      attributes.set(name.toLowerCase(), value);
    }
    
    return attributes;
  }

  tokenize() {
    while (this.currentPos < this.rawString.length || this.stack.length > 0) {
      if (!this.reduce()) {
        if (!this.shift()) {
          // Force reduce any remaining content as text
          if (this.stack.length > 0) {
            this.tokens.push({
              type: 'Text',
              content: this.stack.join(''),
              isWhitespace: /^\s*$/.test(this.stack.join('')),
              raw: this.stack.join('')
            });
            this.stack = [];
          }
        }
      }
    }
    
    // Add EOF token
    this.tokens.push({
      type: 'EOF',
      raw: ''
    });
    
    return this.tokens;
  }
}