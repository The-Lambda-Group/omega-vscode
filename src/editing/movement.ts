import * as vscode from "vscode";
import { Node, TokenType, parseText } from "./ast";
import { getCurrentNode } from "./editor";

export function moveToNode(editor: vscode.TextEditor, node: Node) {
  let newPosition = node.get_doc_pos(editor);

  editor.selection = new vscode.Selection(newPosition, newPosition);
}

export function selectNodes(editor: vscode.TextEditor, ast: Node, openNode: Node, closeNode: Node) {
  let openNodePos = openNode.get_doc_pos(editor);
  let closeNodePos = closeNode.get_doc_pos(editor);

  editor.selection = new vscode.Selection(openNodePos, closeNodePos);
}

export function getSexpEnd(editor: vscode.TextEditor) {
  let [ast, maxLine] = parseText(editor.document.getText());
  if (ast.type !== TokenType.Start) {
    return;
  }

  /* Get current Position */
  let selectedNode = getCurrentNode(editor, ast);
  if (selectedNode.parent === undefined) {
    return;
  }
  let blockClose = selectedNode.getBlockClose();
  moveToNode(editor, blockClose);
}

export function getSexpStart(editor: vscode.TextEditor) {
  let [ast, maxLine] = parseText(editor.document.getText());
  if (ast.type !== TokenType.Start) {
    return;
  }

  let selectedNode = getCurrentNode(editor, ast);
  if (selectedNode.parent === undefined) {
    return;
  }
  let prevSexp = selectedNode.parent;
  moveToNode(editor, prevSexp);
}

export function getNextWord(editor: vscode.TextEditor) {
  let [ast, maxLine] = parseText(editor.document.getText());
  if (ast.type !== TokenType.Start) {
    return;
  }

  let currentNode = getCurrentNode(editor, ast);
  let nextNode = currentNode.getNextNode();
  moveToNode(editor, nextNode);
}

export function getPreviousWord(editor: vscode.TextEditor) {
  let [ast, maxLine] = parseText(editor.document.getText());
  if (ast.type !== TokenType.Start) {
    return;
  }

  let currentNode = getCurrentNode(editor, ast);
  let prevNode = currentNode.getPrevNode();
  moveToNode(editor, prevNode);
}

export function selectCurrSexp(editor: vscode.TextEditor) {
  let [ast, maxLine] = parseText(editor.document.getText());
  if (ast.type !== TokenType.Start) {
    return;
  }

  let currentNode = getCurrentNode(editor, ast);
  let openNode = currentNode.parent ?? currentNode;
  let closeNode = currentNode.getBlockClose();

  selectNodes(editor, ast, openNode, closeNode);
}

export function selectNode(editor: vscode.TextEditor) {
  let [ast, maxLine] = parseText(editor.document.getText());
  if (ast.type !== TokenType.Start) {
    return;
  }

  let currentNode = getCurrentNode(editor, ast);
  let startPos = currentNode.get_doc_pos(editor);
  let endLinePos = startPos.character + currentNode.text.length;
  let endPos = new vscode.Position(currentNode.line, endLinePos);

  editor.selection = new vscode.Selection(startPos, endPos);
}