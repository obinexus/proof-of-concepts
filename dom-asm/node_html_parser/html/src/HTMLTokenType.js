// HTMLTokenType.js - Enum-like constant definitions
export const HTMLTokenType = {
  StartTag: 'StartTag',
  EndTag: 'EndTag',
  Text: 'Text',
  Comment: 'Comment',
  ConditionalComment: 'ConditionalComment',
  Doctype: 'Doctype',
  CDATA: 'CDATA',
  EOF: 'EOF'
};

// Token base class with validation
export class HTMLBaseToken {
  constructor(type, start, end, line, column) {
    if (!Object.values(HTMLTokenType).includes(type)) {
      throw new TypeError(`Invalid token type: ${type}`);
    }
    
    this.validateNumber('start', start);
    this.validateNumber('end', end);
    this.validateNumber('line', line);
    this.validateNumber('column', column);
    
    Object.assign(this, { type, start, end, line, column });
    Object.freeze(this);
  }
  
  validateNumber(field, value) {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new TypeError(`${field} must be a valid number`);
    }
  }
}

export class StartTagToken extends HTMLBaseToken {
  constructor(name, attributes, selfClosing, start, end, line, column, namespace) {
    super(HTMLTokenType.StartTag, start, end, line, column);
    
    if (typeof name !== 'string') {
      throw new TypeError('name must be a string');
    }
    if (!(attributes instanceof Map)) {
      throw new TypeError('attributes must be a Map');
    }
    if (typeof selfClosing !== 'boolean') {
      throw new TypeError('selfClosing must be a boolean');
    }
    if (namespace && typeof namespace !== 'string') {
      throw new TypeError('namespace must be a string if provided');
    }
    
    Object.assign(this, { name, attributes, selfClosing, namespace });
    Object.freeze(this);
  }
}

export class EndTagToken extends HTMLBaseToken {
  constructor(name, start, end, line, column, namespace) {
    super(HTMLTokenType.EndTag, start, end, line, column);
    
    if (typeof name !== 'string') {
      throw new TypeError('name must be a string');
    }
    if (namespace && typeof namespace !== 'string') {
      throw new TypeError('namespace must be a string if provided');
    }
    
    Object.assign(this, { name, namespace });
    Object.freeze(this);
  }
}

export class TextToken extends HTMLBaseToken {
  constructor(content, isWhitespace, start, end, line, column) {
    super(HTMLTokenType.Text, start, end, line, column);
    
    if (typeof content !== 'string') {
      throw new TypeError('content must be a string');
    }
    if (typeof isWhitespace !== 'boolean') {
      throw new TypeError('isWhitespace must be a boolean');
    }
    
    Object.assign(this, { content, isWhitespace });
    Object.freeze(this);
  }
}

export class CommentToken extends HTMLBaseToken {
  constructor(data, start, end, line, column, isConditional = false) {
    super(HTMLTokenType.Comment, start, end, line, column);
    
    if (typeof data !== 'string') {
      throw new TypeError('data must be a string');
    }
    if (typeof isConditional !== 'boolean') {
      throw new TypeError('isConditional must be a boolean');
    }
    
    Object.assign(this, { data, isConditional });
    Object.freeze(this);
  }
}

export class ConditionalCommentToken extends HTMLBaseToken {
  constructor(condition, content, start, end, line, column) {
    super(HTMLTokenType.ConditionalComment, start, end, line, column);
    
    if (typeof condition !== 'string') {
      throw new TypeError('condition must be a string');
    }
    if (typeof content !== 'string') {
      throw new TypeError('content must be a string');
    }
    
    Object.assign(this, { condition, content });
    Object.freeze(this);
  }
}

export class DoctypeToken extends HTMLBaseToken {
  constructor(name, start, end, line, column, publicId, systemId) {
    super(HTMLTokenType.Doctype, start, end, line, column);
    
    if (typeof name !== 'string') {
      throw new TypeError('name must be a string');
    }
    if (publicId && typeof publicId !== 'string') {
      throw new TypeError('publicId must be a string if provided');
    }
    if (systemId && typeof systemId !== 'string') {
      throw new TypeError('systemId must be a string if provided');
    }
    
    Object.assign(this, { name, publicId, systemId });
    Object.freeze(this);
  }
}

export class CDATAToken extends HTMLBaseToken {
  constructor(content, start, end, line, column) {
    super(HTMLTokenType.CDATA, start, end, line, column);
    
    if (typeof content !== 'string') {
      throw new TypeError('content must be a string');
    }
    
    Object.assign(this, { content });
    Object.freeze(this);
  }
}

export class EOFToken extends HTMLBaseToken {
  constructor(start, end, line, column) {
    super(HTMLTokenType.EOF, start, end, line, column);
    Object.freeze(this);
  }
}

// Factory class for creating tokens with validation
export class HTMLTokenBuilder {
  static createStartTag(name, attributes, selfClosing, start, end, line, column, namespace) {
    return new StartTagToken(name, attributes, selfClosing, start, end, line, column, namespace);
  }
  
  static createEndTag(name, start, end, line, column, namespace) {
    return new EndTagToken(name, start, end, line, column, namespace);
  }
  
  static createText(content, isWhitespace, start, end, line, column) {
    return new TextToken(content, isWhitespace, start, end, line, column);
  }
  
  static createComment(data, start, end, line, column, isConditional) {
    return new CommentToken(data, start, end, line, column, isConditional);
  }
  
  static createConditionalComment(condition, content, start, end, line, column) {
    return new ConditionalCommentToken(condition, content, start, end, line, column);
  }
  
  static createDoctype(name, start, end, line, column, publicId, systemId) {
    return new DoctypeToken(name, start, end, line, column, publicId, systemId);
  }
  
  static createCDATA(content, start, end, line, column) {
    return new CDATAToken(content, start, end, line, column);
  }
  
  static createEOF(start, end, line, column) {
    return new EOFToken(start, end, line, column);
  }
}