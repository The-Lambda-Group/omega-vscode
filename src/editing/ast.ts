import { findPreviousWordStart } from "./editor";
import * as vscode from "vscode";

function getWordChars(): string[] {
  return ["(", ")", "{", "}", "[", "]"];
}

function isBlockChar(char: string): boolean {
  let wordChars = getWordChars();
  return wordChars.includes(char);
}

function isWhiteSpaceChar(char: string): boolean {
  let whitespaceChars = [" ", "\t", "\n"];
  return whitespaceChars.includes(char);
}

function isPunctuationChar(char: string): boolean {
  let punctuationChars = [",", ":"];
  return punctuationChars.includes(char);
}

function isBlockEndChar(char: string): boolean {
  let wordChars = [")", "}", "]"];
  return wordChars.includes(char);
}

function isBlockOpenChar(char: string): boolean {
  let wordChars = ["(", "[", "{"];
  return wordChars.includes(char);
}

function isWordOverChar(char: string): boolean {
  return isBlockChar(char) || isWhiteSpaceChar(char);
}

export enum TokenType {
  Open,
  Close,
  Fact,
  Newline,
  Start,
  Error,
  End,
}

export class Node {
  type: TokenType;
  text: string;
  children: Node[];
  line: number;
  parent?: Node;
  linePos: number;
  blockPos: number;

  constructor(
    type: TokenType,
    text: string,
    line: number,
    linePos: number,
    blockPos: number
  ) {
    this.type = type;
    this.text = text.trimStart().trimEnd();
    this.children = [];
    this.line = line;
    this.linePos = linePos;
    this.blockPos = blockPos;
  }

  toString(): string {
    let s =
      "Line: " +
      this.line +
      ", linePos: " +
      this.linePos +
      ", blockPos" +
      "this.blockPos" +
      ", text: " +
      this.text;
    return s;
  }

  findNode(line: number, linePos: number): Node[] {
    if (this.line === line && this.linePos === linePos) {
      return [this];
    }
    return this.children.map((child) => child.findNode(line, linePos)).flat();
  }

  formatChildren(startDepth: number): string {
    let increment = 3;
    let text = "";
    let leadingWhiteSpace = " ".repeat(startDepth);
    for (let i = 0; i < this.children.length; i++) {
      let currChild = this.children[i];
      switch (currChild.type) {
        case TokenType.Open:
          if (i !== 0) {
            text += " ";
          }
          text +=
            currChild.text + currChild.formatChildren(startDepth + increment);
          break;
        case TokenType.Close:
          text += currChild.text;
          break;
        case TokenType.Fact:
          if (i === 0) {
            text += currChild.text;
            break;
          }
          text += " " + currChild.text;
          break;
        case TokenType.Newline:
          text += currChild.text + leadingWhiteSpace;
          break;
        case TokenType.Start:
          break;
      }
    }
    return text;
  }

  assignParents() {
    this.children.map((child) => {
      child.parent = this;
      child.assignParents();
    });
  }

  getPrevNode(): Node {
    let parent = this.parent;
    if (parent === undefined) {
      return new Node(
        TokenType.Error,
        "No parent",
        this.line,
        this.linePos,
        this.blockPos
      );
    }
    let newSelectedNode;
    if (this.type === TokenType.Close) {
      newSelectedNode = parent;
    } else {
      newSelectedNode =
        this.blockPos === 0 ? parent : parent.children[this.blockPos - 1];
      if (newSelectedNode.type === TokenType.Newline) {
        newSelectedNode = newSelectedNode.getPrevNode();
      }
    }
    return newSelectedNode;
  }

  getNextNode(): Node {
    let parent = this.parent;
    if (parent === undefined) {
      return new Node(
        TokenType.Error,
        "No parent",
        this.line,
        this.linePos,
        this.blockPos
      );
    }
    let newSelectedNode;
    if (this.type === TokenType.Close) {
      return parent.getNextNode();
    } else {
      if (this.blockPos === parent.children.length - 1) {
        if (parent.type === TokenType.Start) {
          /* There is no next node */
          return new Node(TokenType.End, "END", 0, 0, 0);
        }
        newSelectedNode = parent.getNextNode();
      } else {
        newSelectedNode = parent.children[this.blockPos + 1];
      }
      if (newSelectedNode.type === TokenType.Newline) {
        newSelectedNode = newSelectedNode.getNextNode();
      }
    }
    return newSelectedNode;
  }

  getBlockClose(): Node {
    let parent;
    if (this.type === TokenType.Open) {
      parent = this;
    } else {
      parent = this.parent;
      if (this.parent === undefined) {
        return new Node(
          TokenType.Error,
          "No parent",
          this.line,
          this.linePos,
          this.blockPos
        );
      }
    }

    if (parent?.children.length === 0) {
      return new Node(TokenType.Error, "child length 0", 0, 0, 0);
    }
    let lastChild = parent?.children[(parent?.children.length ?? 1) - 1];
    if (lastChild?.type !== TokenType.Close) {
      return new Node(TokenType.Error, "Unbalanced Block Error!", 0, 0, 0);
    }
    return lastChild;
  }

  get_doc_line_pos(lineText: string) {
    let tokenized = tokenize(lineText);
    let lastPos = 0;
    for (let i = 0; i < tokenized.length; i++) {
      lastPos = lineText.indexOf(tokenized[i], lastPos);
      if (i === this.linePos && tokenized[i] === this.text) {
        return lastPos;
      }
    }
  }

  get_doc_start_pos(editor: vscode.TextEditor) {
    let lineText = editor.document.lineAt(this.line).text;
    let linePos = this.get_doc_line_pos(lineText) ?? 0;
    let position = new vscode.Position(this.line, linePos);
    return position;
  }

  check_balance(): boolean {
    if (this.type === TokenType.Open) {
      if (
        this.children.length === 0 ||
        this.children[this.children.length - 1].type !== TokenType.Close
      ) {
        return false;
      }
    }
    let child_output = this.children.map((x) => x.check_balance());
    return !child_output.includes(false);
  }
}

/* Text should end at the node position */
export function get_selected_node(
  parentNode: Node,
  line: number,
  position: number,
  text: string
): Node {
  let linePos = tokenize(text).length - 1;
  let nodes = parentNode.findNode(line, linePos);
  if (nodes.length === 0) {
    return new Node(TokenType.Start, "error", line, -1, -1);
  }
  return nodes[0];
}

function format_line(nodes: Node[], prevLine: string) {
  let parentNode = new Node(TokenType.Start, "start", 0, -1, -1);
  parentNode.children = nodes;
  let line = parentNode.formatChildren(0).trimStart().trimEnd();
  let prevWordPos = findPreviousWordStart(
    prevLine.concat(" "),
    prevLine.length + 1
  );
  return " ".repeat(prevWordPos).concat(line);
}

function get_line(node: Node, line: number): Node[] {
  let nodes: Node[] = [];
  if (node.line === line) {
    nodes.push(node);
  } else if (node.line > line) {
    return nodes;
  }

  return nodes.concat(
    node.children.map((child) => get_line(child, line)).flat()
  );
}

export function format_doc(node: Node, maxLine: number): string {
  let text = "";
  let parent = new Node(TokenType.Start, "start", 0, -1, -1);
  parent.children = get_line(node, 0);
  let prevLine = parent.formatChildren(0).trimStart().trimEnd();
  for (let i = 1; i < maxLine; i++) {
    let newLine = format_line(get_line(node, i), prevLine);
    text += newLine;
    prevLine = newLine;
  }
  return text;
}

function parseToken(
  token: string,
  line: number,
  linePos: number,
  blockPos: number
): Node {
  if (isBlockOpenChar(token)) {
    return new Node(TokenType.Open, token, line, linePos, blockPos);
  } else if (isBlockEndChar(token)) {
    return new Node(TokenType.Close, token, line, linePos, blockPos);
  } else if (isWhiteSpaceChar(token)) {
    return new Node(TokenType.Newline, token, line, linePos, blockPos);
  } else {
    return new Node(TokenType.Fact, token, line, linePos, blockPos);
  }
}

function tokenize(text: string): string[] {
  return text
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .replace(/\{/g, " { ")
    .replace(/\}/g, " } ")
    .replace(/\[/g, " [ ")
    .replace(/\]/g, " ] ")
    .replace(/\n/g, " \n ")
    .trim()
    .split(/[\t|' ']+/);
}

export function parseText(text: string): [Node, number] {
  let parentNode = new Node(TokenType.Start, "StartNode", 0, -1, -1);
  let _ = 0;
  let tokens = tokenize(text);
  let maxLine;
  [parentNode.children, _, maxLine] = parse(parentNode, tokens, 0, 0);
  let s = parentNode.formatChildren(0);
  parentNode.assignParents();
  return [parentNode, maxLine];
}

export function parse(
  node: Node,
  tokens: string[],
  line: number,
  index: number
): [Node[], number, number] {
  let nodes: Node[] = [];
  let linePos = node.linePos;
  let blockPos = 0;
  for (let i = index; i < tokens.length; i++, blockPos++) {
    linePos++;
    let newNode = parseToken(tokens[i], line, linePos, blockPos);
    if (newNode.type === TokenType.Open) {
      [newNode.children, i, line] = parse(newNode, tokens, line, i + 1);
      linePos = newNode.children[newNode.children.length - 1].linePos;
    } else if (newNode.type === TokenType.Close) {
      nodes.push(newNode);
      return [nodes, i, line];
    } else if (newNode.type === TokenType.Newline) {
      linePos = -1;
      line++;
    }
    nodes.push(newNode);
  }
  return [nodes, tokens.length, line];
}
