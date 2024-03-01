import * as vscode from "vscode";
import { OmegaDocumentProvider } from "./docs";
import { DBNodeTreeItem, OmegaTreeViewProvider } from "./tree_node";
import { open } from "fs";
import { DatastoreNode } from "./tree_node/data_type/datastore";
import { TokenType, format_doc, get_node_document_pos, get_selected_node, parse, parseText } from "./ast";
import { runBuffer } from "./run";

export function activate(context: vscode.ExtensionContext) {
  console.log("activating Omega extension.");
  const documentProvider = new OmegaDocumentProvider();
  vscode.workspace.registerTextDocumentContentProvider(
    "omegaDocuments",
    documentProvider
  );
  const DBNode = new DatastoreNode({
    dsName: "ds.omegadb.io/registry",
    host: "http://localhost:5984",
  });
  const nodeDependenciesProvider = new OmegaTreeViewProvider({
    documentProvider,
  });
  vscode.window.registerTreeDataProvider(
    "omegaDatastores",
    nodeDependenciesProvider
  );
  vscode.commands.registerCommand("omega.fetchDatastore", () => {
    DBNode.fetchChildren().then(
      /* Finished Getting Children */
    );
    vscode.window.showInformationMessage("NOT_IMPLEMENTED");
  });
  vscode.commands.registerCommand(
    "omega.editEntry",
    (treeItem: DBNodeTreeItem) => {
      nodeDependenciesProvider.edit(treeItem);
    }
  );
  vscode.commands.registerCommand("omega.navigateRight", () => {
    jumpToSpot(false, true);
  });
  vscode.commands.registerCommand("omega.navigateLeft", () => {
   navLeft(false);
  });
  vscode.commands.registerCommand("omega.navigateSelectRight", () => {
    jumpToSpot(true, true);
  });
  vscode.commands.registerCommand("omega.navigateSelectLeft", () => {
    jumpToSpot(true, false);
  });
  vscode.commands.registerCommand("omega.sexpStart", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    let [ast, maxLine] = parseText(editor.document.getText());
    if (ast.type !== TokenType.Start) {
      return;
    }

    /* Get current Position */
    const selection = editor.selection;
    let line = selection.start.line;
    let pos = selection.start.character;
    let lineText = editor.document.lineAt(line).text;
    let selectedNode = get_selected_node(ast, line, pos, lineText.substring(0, pos));
    if (selectedNode.parent === undefined) {
      return;
    }
    let prevSexp = selectedNode.parent;
    lineText = editor.document.lineAt(prevSexp.line).text;
    let newLinePos = get_node_document_pos(prevSexp, lineText);
    if(newLinePos === undefined) {
      return;
    }

    /* Move the cursor */
    let newPosition = editor.document.positionAt(editor.document.offsetAt(new vscode.Position(prevSexp.line, newLinePos)));
    editor.selection = new vscode.Selection(newPosition, newPosition);
  });

  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
    // /* Check when we last ran aggressiveIndext */
    // let lastRun = context.workspaceState.get<number>("LastAggressiveIndentTime");
    // if (lastRun === undefined) {
    //   lastRun = 0;
    // }
    // let currTime = new Date().getTime();
    // if (currTime - lastRun < 100) {
    //   return;
    // }

    // /* Get the overall text range to map over */
    // let range = event.contentChanges.map((reason) => reason.range).reduce((acc, elem) => {
    //   let start = acc.start.isBefore(elem.start) ? acc.start : elem.start;
    //   let end = acc.end.isAfter(elem.end) ? acc.end : elem.end;
    //   return new vscode.Range(start, end);
    // });

    /* Format */
    let n = event.contentChanges.length;
    let x = event.contentChanges.map((reason) => {
      let range = reason.range;
      let newText = reason.text;
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const document = editor.document;
      formatRange(editor, document, range, newText);
      // context.workspaceState.update("LastAggressiveIndentTime", currTime);
    });

  }));
  vscode.commands.registerCommand("omega.aggressiveIndent", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    let [ast, maxLine] = parseText(editor.document.getText());
    if (ast.type !== TokenType.Start) {
      /* Error */
      return;
    }
    editor.edit(editBuilder => {
      let document = editor.document;
      let range = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));

      const selection = editor.selection;
      let line = selection.start.line;
      let pos = selection.start.character;
      const lineText = document.lineAt(selection.start).text;
      let n = get_selected_node(ast, line, pos, lineText.substring(0, pos));

      editBuilder.replace(range, format_doc(ast, maxLine));
    });
  });
  const outputChannel = vscode.window.createOutputChannel("OmegaDB Output");
  vscode.commands.registerCommand("omega.runBuffer", () => {
    runBuffer(outputChannel);
  });
}

function getWordChars(): string[] {
  return ['(', ')', '{', '}', '[', ']'];
}

function isWordChar(char: string): boolean {
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
  return isWordChar(char) || isWhiteSpaceChar(char);
}

function getPairOpposite(char: string): string {
  let charsSet: Map<String, String> = new Map<string, string>([['[', ']'], ["(", ")"], ["{", "}"], [']', '['], [")", "("], ["}", "{"]]);
  let other = charsSet.get(char)?.toString() ?? " ";
  return other;
}

function findBlockOpener(text: string, initialOffset: number): number {
  let counts = new Map<string, number>(getWordChars().map(elem => [elem, 0]));
  for (let i = initialOffset; i >= 0; i--) {
    if (isBlockOpenChar(text[i])) {
      let pairOppositeCount = counts.get(getPairOpposite(text[i])) ?? 0;
      if (pairOppositeCount === 0) {
        return i;
      }
      counts.set(getPairOpposite(text[i]), pairOppositeCount - 1);
    } else if (isBlockEndChar(text[i])) {
      let currCount = counts.get(text[i]) ?? 0;
      counts.set(text[i], currCount + 1);
    }
  }
  /* No block opener exists */
  return -1;
}

function findNextWordChar(text: string, rangeEndChar: string, initialOffset: number): number {
  let offset = initialOffset;
  while (offset < text.length) {
    offset++;
    if (text[offset] === rangeEndChar) {
      return offset;
    }
  }
  /* We are unbalanced! */
  return -1;
}

function findPrevWordChar(text: string, initialOffset: number): [string, number] {
  let offset = initialOffset;
  while (offset > 0) {
    offset--;
    if (isWordChar(text[offset])) {
      return [text[offset], offset];
    }
  }
  /* We are unbalanced! */
  return [" ", -1];
}

function getFormatRange(text: string, startOffset: number, endOffset: number): [number, number] {
  const [rangeStartChar, rangeStartOffset] = findPrevWordChar(text, startOffset);
  let rangeEndOffset = findNextWordChar(text, getPairOpposite(rangeStartChar), startOffset);
  return [rangeStartOffset, rangeEndOffset];
}

export function findPreviousWordStart(text: string, initialOffset: number): number {
  let currentOffset = initialOffset;
  if (initialOffset > text.length) {
    return -1;
  } else if (initialOffset === 0) {
    return -1;
  }

  /* Why are we sometimes double hitting */
  let newWordStarted = false;
  let whitespaceTouched = false;
  while (currentOffset >= 1) {
    currentOffset--;
    if (isWordChar(text[currentOffset])) {
      if (isBlockEndChar(text[currentOffset])) {
        /* Find start of block */
        return findNextBalancedChar(text, text[currentOffset], getPairOpposite(text[currentOffset]), currentOffset, false);
      }
      return currentOffset + 1;
    } else if (isWhiteSpaceChar(text[currentOffset]) || isPunctuationChar(text[currentOffset])) {
      if (newWordStarted) { return currentOffset + 1; }
      whitespaceTouched = true;
      continue;
    } else if (whitespaceTouched && newWordStarted === false) {
      newWordStarted = true;
    }
  }
  return -1;
}

function formatRange(
  editor: vscode.TextEditor,
  document: vscode.TextDocument,
  range: vscode.Range,
  newText: string
) {
  const startIndex = document.offsetAt(range.start);
  if (newText.includes("\n")) {
    /* Delete everything after the \n */
    let oldLine = document.lineAt(range.start.line).text;
    let prevWordStart = findPreviousWordStart(oldLine, range.start.character);
    let leadingTabCount = oldLine.substring(0, prevWordStart).match("/\t/g")?.length ?? 0;
    let leadingWhitespace = "\t".repeat(leadingTabCount).concat(" ".repeat(prevWordStart - leadingTabCount));

    editor.edit(editBuilder => {
      let pos = document.positionAt(startIndex + 1);
      let line = document.lineAt(pos.line);
      let lineText = line.text;
      let newNewLine = leadingWhitespace.concat(lineText.trimStart().trimEnd());
      editBuilder.replace(line.range, newNewLine);
    });
  }
};

async function balanceLines(editor: vscode.TextEditor,
  line1: string,
  line2: vscode.TextLine): Promise<string> {
  let leadingWhiteSpace = line1.length - line1.trimStart().length;
  let leadingTabCount = line1.substring(0, leadingWhiteSpace).match("/\t/g")?.length ?? 0;
  let newLine2 = "\t".repeat(leadingTabCount).concat(" ".repeat(leadingWhiteSpace - leadingTabCount).concat(line2.text.trimStart().trimEnd()));
  await editor.edit(editBuilder => {
    editBuilder.replace(line2.range, newLine2);
  });
  return newLine2;
}

function getSurroundingBlock(text: string, offset: number): [number, number] {
  /* If we go forwards, we can find the pair easiest (fuck! that's not true) */
  let openOffset = findBlockOpener(text, offset);
  if (openOffset === -1) {
    return [-1, -1];
  }
  let closeOffset = findNextBalancedChar(text, text[openOffset], getPairOpposite(text[openOffset]), offset, true);
  return [openOffset, closeOffset];
}

async function format_block(editor: vscode.TextEditor, document: vscode.TextDocument, range: vscode.Range) {
  let currLine = document.lineAt(range.start.line).text;
  let endLine = document.lineAt(range.end.line);

  for (let i = range.start.line; i < endLine.lineNumber; i++) {
    let nextLine = document.lineAt(i + 1);
    currLine = await balanceLines(editor, currLine, nextLine);
  }
}

async function format_surrounding_region(editor: vscode.TextEditor) {
  let document = editor.document;
  let startPos = document.offsetAt(editor.selection.active);
  let [start, end] = getSurroundingBlock(document.getText(), startPos);
  await format_block(editor, document, new vscode.Range(document.positionAt(start), document.positionAt(end)));
}

function aggressiveIndent(range: vscode.Range) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  const text = document.getText();
  const length = text.length;
  let startPosition = document.positionAt(0);
  let endPosition = document.positionAt(text.length);

  // const startOffset = document.offsetAt(range.start);;
  // const endOffset = document.offsetAt(range.end);

  // let formattedBlock = formatBlock(text);
  // editor.edit(editBuilder => {
  //   editBuilder.replace(new vscode.Range(startPosition, endPosition), formattedBlock);
  // });
}

function findNextWhiteSpace(text: string, startIndex: number, forward: boolean): number {
  let whitespaceChars = [" ", "\t", "\n"];
  const direction = forward ? 1 : -1;
  let count = 0;
  for (let i = startIndex + direction; forward ? i < text.length : i >= 0; i += direction) {
    const currentChar = text[i];
    if (whitespaceChars.includes(currentChar)) {
      return i;
    }
  }
  return -1;
}

function findNextBalancedChar(text: string, haveChar: string, oppositeChar: string, startIndex: number, forward: boolean): number {
  const direction = forward ? 1 : -1;
  let count = 0;
  for (let i = startIndex + direction; forward ? i < text.length : i >= 0; i += direction) {
    const currentChar = text[i];
    if (haveChar === currentChar) {
      count++;
    } else if (currentChar === oppositeChar) {
      if (count === 0) {
        return i;
      }
      count--;
    }
  }
  return -1;
}

function find_format_range(text: string, startOffset: number, endOffset: number): [number, number] {
  /* Find first opening parenthesis */
  let paren_count = 0;
  let start = -1;
  let end = -1;

  for (let i = startOffset; i >= 0; i--) {
    let char = text[i];
    if (char === '(') {
      if (paren_count === 0) {
        start = i;
        break;
      }
      paren_count--;
    }
    else if (char === ')') {
      paren_count++;
    }
  }

  for (let i = endOffset; i < text.length; i++) {
    let char = text[i];
    if (char === '(') {
      if (paren_count === 0) {
        start = i;
        break;
      }
      paren_count--;
    }
    else if (char === ')') {
      paren_count++;
    }
  }


  return [0, 0];
}

function navLeft(shouldSelect: boolean) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  let [ast, maxLine] = parseText(editor.document.getText());
  if (ast.type !== TokenType.Start) {
    return;
  }

  /* Get current Position */
  const selection = editor.selection;
  let line = selection.start.line;
  let pos = selection.start.character;
  let lineText = editor.document.lineAt(line).text;
  let selectedNode = get_selected_node(ast, line, pos, lineText.substring(0, pos));
  if (selectedNode.parent === undefined) {
    return;
  }
  let parent = selectedNode.parent;
  let newSelectedNode = selectedNode.getPreviousNode();
  if (newSelectedNode.type === TokenType.Error) {
    return;
  }
  
  lineText = editor.document.lineAt(newSelectedNode.line).text;
  let newLinePos = get_node_document_pos(newSelectedNode, lineText);
  if(newLinePos === undefined) {
    return;
  }

  /* Move the cursor */
  let newPosition = editor.document.positionAt(editor.document.offsetAt(new vscode.Position(parent.line, newLinePos)));
  editor.selection = new vscode.Selection(newPosition, newPosition);
}

function jumpToSpot(select: boolean, forward: boolean) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  // "\"", "\'", "\(", "\)", "\{", "\}", "\t", "\n", " "];
  let openChars = ["\"", "\'", "\(", "\{", "\t", "\n", " "];
  let closeChars = ["\"", "\'", "\)", "\}", "\t", "\n", " "];
  let charsSet: Map<String, String> = new Map<string, string>([['"', '"'], ["'", "'"], ["(", ")"], ["{", "}"]]);
  if (!forward) {
    closeChars = ["\"", "\'", "\(", "\{", "\t", "\n", " "];
    openChars = ["\"", "\'", "\)", "\}", "\t", "\n", " "];
    charsSet = new Map<string, string>([['"', '"'], ["'", "'"], [")", "("], ["}", "{"]]);
  }


  const document = editor.document;
  const selection = editor.selection;
  const startOffset = document.offsetAt(selection.start);
  const endOffset = document.offsetAt(selection.end);
  const text = document.getText();
  const currentChar = forward ? text[endOffset] : text[startOffset];

  let oppositeChar = charsSet.get(currentChar);
  let nextIndex = -1;
  if (oppositeChar === undefined) {
    nextIndex = findNextWhiteSpace(text, forward ? endOffset : startOffset, forward);
  } else {
    nextIndex = findNextBalancedChar(text, currentChar, oppositeChar.toString(), forward ? endOffset : startOffset, forward);
  }

  if (nextIndex !== -1) {
    if (select) {
      if (forward) {
        editor.selection = new vscode.Selection(selection.start, document.positionAt(nextIndex + 1));
      } else {
        editor.selection = new vscode.Selection(document.positionAt(endOffset + 1), document.positionAt(nextIndex));
      }
    }
    else {
      let newPosition;
      if (forward) {
        newPosition = document.positionAt(nextIndex + 1);
      }
      else {
        newPosition = document.positionAt(nextIndex);
      }
      editor.selection = new vscode.Selection(newPosition, newPosition);
    }
  }

}

export function deactivate() { }