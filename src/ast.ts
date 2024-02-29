function getWordChars(): string[] {
    return ['(', ')', '{', '}', '[', ']'];
}

function isBlockChar(char: string): boolean {
    let wordChars = getWordChars();
    return wordChars.includes(char);
}

function isWhiteSpaceChar(char: string): boolean {
    let whitespaceChars = [' ', '\t', '\n'];
    return whitespaceChars.includes(char);
}

function isPunctuationChar(char: string): boolean {
    let punctuationChars = [',', ':'];
    return punctuationChars.includes(char);
}

function isBlockEndChar(char: string): boolean {
    let wordChars = [')', '}', ']'];
    return wordChars.includes(char);
}

function isBlockOpenChar(char: string): boolean {
    let wordChars = ['(', '[', '{'];
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
    Start
}

export class Node {
    type: TokenType;
    text: string;
    children: Node[];
    line: number;
    parent?: Node;

    constructor(type: TokenType, text: string, line: number) {
        this.type = type;
        this.text = text;
        this.children = [];
        this.line = line;
    }

    formatChildren(startDepth: number): string {
        let increment = 3;
        let text = "";
        let leadingWhiteSpace = " ".repeat(startDepth);
        for (let i = 0; i < this.children.length; i++) {
            let currChild = this.children[i];
            switch (currChild.type) {
                case TokenType.Open:
                    if(i !== 0) {
                        text += " ";
                    }
                    text += currChild.text + currChild.formatChildren(startDepth + increment);
                    break;
                case TokenType.Close:
                    text += currChild.text;
                    break;
                case TokenType.Fact:
                    if(i === 0) {
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
        this.children.map(child => {
            child.parent = this;
            child.assignParents();
        });
    }
}

function get_line(node: Node, line: number): Node[] {
    let nodes: Node[] = [];
    if (node.line === line) {
        nodes.push(node);
    }
    else if(node.line > line) {
        return nodes;
    }
    let children = node.children.map(child => get_line(child, line));
    nodes.concat(children.flat());
    return nodes;
}

function parseToken(token: string, line: number): Node {
    if (isBlockOpenChar(token)) {
        return new Node(TokenType.Open, token, line);
    } else if (isBlockEndChar(token)) {
        return new Node(TokenType.Close, token, line);
    } else if (isWhiteSpaceChar(token)) {
        return new Node(TokenType.Newline, token, line);
    } else {
        return new Node(TokenType.Fact, token, line);
    }
}

function tokenize(text: string): string[] {
    return text.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ')
        .replace(/\{/g, ' { ').replace(/\}/g, ' } ')
        .replace(/\[/g, ' [ ').replace(/\]/g, ' ] ')
        .replace(/\n/g, ' \n ').trim().split(/[\t|' ']+/);
}

export function parseText(text: string): Node {
    let parentNode = new Node(TokenType.Start, "StartNode", 0);
    let _ = 0;
    let tokens = tokenize(text);
    [parentNode.children, _, _] = parse(parentNode, tokens, 0, 0);
    let s = parentNode.formatChildren(0);
    parentNode.assignParents();
    let line = get_line(parentNode, 2);
    return parentNode;
}

export function parse(node: Node, tokens: string[], index: number, line: number): [Node[], number, number] {
    let nodes: Node[] = [];
    for (let i = index; i < tokens.length; i++) {
        let newNode = parseToken(tokens[i], line);
        if (newNode.type === TokenType.Open) {
            [newNode.children, i, line] = parse(newNode, tokens, i + 1, line);
        } else if (newNode.type === TokenType.Close) {
            nodes.push(newNode);
            return [nodes, i, line];
        } else if (newNode.type === TokenType.Newline) {
            line++;
        }
        nodes.push(newNode);
    }
    return [nodes, tokens.length, line];
}