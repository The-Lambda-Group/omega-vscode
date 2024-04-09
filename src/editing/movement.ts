import * as vscode from "vscode";
import { Node, TokenType, parseText } from "./ast";
import { getCurrentNode, printErrorMessage } from "./editor";

export function moveToStart(editor: vscode.TextEditor) {
  let pos = new vscode.Position(0, 0);
  editor.selection = new vscode.Selection(pos, pos);
}

export function moveToNode(editor: vscode.TextEditor, node: Node) {
  if (node.type === TokenType.Start) {
    let pos = new vscode.Position(0, 0);
    editor.selection = new vscode.Selection(pos, pos);
    return;
  }
  let startPosition = node.get_doc_start_pos(editor);
  let endPosition = new vscode.Position(
    startPosition.line,
    startPosition.character + node.text.length
  );

  editor.selection = new vscode.Selection(endPosition, endPosition);
}

export function moveToEnd(editor: vscode.TextEditor) {
  let pos = editor.document.positionAt(editor.document.getText().length);
  editor.selection = new vscode.Selection(pos, pos);
}

export function selectNodes(
  editor: vscode.TextEditor,
  openNode: Node,
  closeNode: Node
) {
  let openNodePos = openNode.get_doc_start_pos(editor);
  let closeNodeStartPos = closeNode.get_doc_start_pos(editor);
  let closeNodePos = new vscode.Position(
    closeNodeStartPos.line,
    closeNodeStartPos.character + closeNode.text.length
  );

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

  selectNodes(editor, openNode, closeNode);
}

export function selectNode(editor: vscode.TextEditor) {
  let [ast, maxLine] = parseText(editor.document.getText());
  if (ast.type !== TokenType.Start) {
    return;
  }

  let currentNode = getCurrentNode(editor, ast);
  let startPos = currentNode.get_doc_start_pos(editor);
  let endLinePos = startPos.character + currentNode.text.length;
  let endPos = new vscode.Position(currentNode.line, endLinePos);

  editor.selection = new vscode.Selection(startPos, endPos);
}

export function pareditForward(editor: vscode.TextEditor, select: boolean) {
  let [ast, maxLine] = parseText(editor.document.getText());
  if (ast.type !== TokenType.Start) {
    return;
  }

  let node = getCurrentNode(editor, ast);
  if (node.parent === undefined) {
    printErrorMessage(editor, "No parent exists: " + node.toString());
    return;
  }
  let nextNode;
  switch (node.type) {
    case TokenType.Open:
      if (
        node.children.length === 0 ||
        node.children[node.children.length - 1].type !== TokenType.Close
      ) {
        printErrorMessage(editor, "Unbalance block: " + node.toString());
        return;
      }
      nextNode = node.children[node.children.length - 1];
      break;
    case TokenType.Close:
      nextNode = node.parent.getNextNode();
      break;
    case TokenType.Fact:
    case TokenType.Newline:
      nextNode = node.getNextNode();
      break;
    case TokenType.Start:
    case TokenType.End:
    case TokenType.Error:
      printErrorMessage(editor, "Invalid Input: " + node.toString());
      return;
  }
  if (nextNode.type === TokenType.Error) {
    printErrorMessage(editor, "No next node: " + node.toString());
    return;
  } else if (nextNode.type === TokenType.End) {
    moveToEnd(editor);
    return;
  }

  if(select) {
    selectNodes(editor, node, nextNode);
  } else {
    moveToNode(editor, nextNode);
  }
}

export function pareditBackward(editor: vscode.TextEditor, select: boolean) {
  let [ast, maxLine] = parseText(editor.document.getText());
  if (ast.type !== TokenType.Start) {
    return;
  }

  let node = getCurrentNode(editor, ast);
  if (node.parent === undefined) {
    printErrorMessage(editor, "No parent exists: " + node.toString());
    return;
  }
  let prevNode;
  switch (node.type) {
    case TokenType.Close:
    case TokenType.Fact:
    case TokenType.Newline:
    case TokenType.Open:
      prevNode = node.getPrevNode();
      break;
    case TokenType.Start:
      moveToStart(editor);
      return;
    case TokenType.End:
    case TokenType.Error:
      printErrorMessage(editor, "Invalid Input: " + node.toString());
      return;
  }
  if (prevNode.type === TokenType.Error) {
    printErrorMessage(editor, "No previous node: " + node.toString());
    return;
  }

  if(select) {
    selectNodes(editor, prevNode, node);
  } else {
    moveToNode(editor, prevNode);
  }
}
