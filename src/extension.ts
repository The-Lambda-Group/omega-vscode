import * as vscode from "vscode";
import { OmegaDocumentProvider } from "./docs";
import { DBNodeTreeItem, OmegaTreeViewProvider } from "./tree_node";
import { open } from "fs";

export function activate(context: vscode.ExtensionContext) {
  console.log("activating Omega extension.");
  const documentProvider = new OmegaDocumentProvider();
  vscode.workspace.registerTextDocumentContentProvider(
    "omegaDocuments",
    documentProvider
  );
  const nodeDependenciesProvider = new OmegaTreeViewProvider({
    documentProvider,
  });
  vscode.window.registerTreeDataProvider(
    "omegaDatastores",
    nodeDependenciesProvider
  );
  vscode.commands.registerCommand("omega.fetchDatastore", () => {
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
    jumpToSpot(false, false);
  });
  vscode.commands.registerCommand("omega.navigateSelectRight", () => {
    jumpToSpot(true, true);
  });
  vscode.commands.registerCommand("omega.navigateSelectLeft", () => {
    jumpToSpot(true, false);
  });
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) =>
  {
    /* Get the overall text range to map over */
    let range = event.contentChanges.map((reason) => reason.range).reduce((acc, elem) => {
      let start = acc.start.isBefore(elem.start) ? acc.start : elem.start;
      let end = acc.end.isAfter(elem.end) ? acc.end : elem.end;
      return new vscode.Range(start, end);
    });

    aggressiveIndent(range);
  }));
  vscode.commands.registerCommand("omega.aggressiveIndent", () =>
  {
    aggressiveIndent();
  });
}

/* We want to put in a mapping of every open parenthesis to every close parenthese and the depth, so that we only need to map that chunk. */
function formatBlock(text: string, start_position: number, initial_depth: number): string {
  /* First verify that this is an sexp block */
  if(text[0] !== '(') {
    return text;
  }
  let newText: string[] = [];

  let parenthesis_count = 0;
  for(let i = 0; i < text.length; i++) {
    /* TODO: Add string checking */
    let char = text[i];
    if(char === undefined) { 
      /* This condition should be impossible */
      return newText.join("");
    } else if(char === '(') {
      if(newText.length !== 0) {
        newText.push('\n');
      }

      for(let j = 0; j < parenthesis_count; j++){
        newText.push('\t');
      }
      newText.push('(');
      parenthesis_count++;

    } else if(char === ')') {
      parenthesis_count--;
      /* We can't format if it isn't balanced */
      if(parenthesis_count < 0) {
        return text;
      }
      newText.push(char);
    } else if(text[i] === '\n' || text[i] === '\t'){
      /* Ignore */
    } else {
      newText.push(char);
    }
  }

  if(parenthesis_count !== 0) {
    /* We can't format if it isn't balanced */
    return text;
  }
  return newText.join("");
}

function aggressiveIndent(range: vscode.Range) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  
  const document = editor.document;
  const text = document.getText();
  const startOffset = document.offsetAt(range.start);;
  const endOffset = document.offsetAt(range.end);
  
  let formattedBlock = formatBlock(text.substring(startOffset, endOffset), startOffset, 0);
  editor.edit(editBuilder => {
    let startPosition = document.positionAt(startOffset);
    let endPosition = document.positionAt(endOffset);
    editBuilder.replace(new vscode.Range(startPosition, endPosition), formattedBlock);
  });
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