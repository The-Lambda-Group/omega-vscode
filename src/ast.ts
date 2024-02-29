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

    constructor(type: TokenType, text: string) {
        this.type = type;
        this.text = text;
        this.children = [];
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
}

function parseToken(token: string): Node {
    if (isBlockOpenChar(token)) {
        return new Node(TokenType.Open, token);
    } else if (isBlockEndChar(token)) {
        return new Node(TokenType.Close, token);
    } else if (isWhiteSpaceChar(token)) {
        return new Node(TokenType.Newline, token);
    } else {
        return new Node(TokenType.Fact, token);
    }
}

function tokenize(text: string): string[] {
    return text.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ')
        .replace(/\{/g, ' { ').replace(/\}/g, ' } ')
        .replace(/\[/g, ' [ ').replace(/\]/g, ' ] ')
        .replace(/\n/g, ' \n ').trim().split(/[\t|' ']+/);
}

export function parseText(text: string): Node {
    let parentNode = new Node(TokenType.Start, "StartNode");
    let _ = 0;
    let tokens = tokenize(text);
    [parentNode.children, _] = parse(parentNode, tokens, 0);
    let s = parentNode.formatChildren(0);
    return parentNode;
}

export function parse(node: Node, tokens: string[], index: number): [Node[], number] {
    let nodes: Node[] = [];
    for (let i = index; i < tokens.length; i++) {
        let newNode = parseToken(tokens[i]);
        if (newNode.type === TokenType.Open) {
            [newNode.children, i] = parse(newNode, tokens, i + 1);
        } else if (newNode.type === TokenType.Close) {
            nodes.push(newNode);
            return [nodes, i];
        }
        nodes.push(newNode);
    }
    return [nodes, tokens.length];
}