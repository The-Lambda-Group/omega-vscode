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
  if (openChars.includes(currentChar)) {
    let oppositeChar = charsSet.get(currentChar);
    let nextIndex = -1;
    if (oppositeChar === undefined) {
      nextIndex = findNextWhiteSpace(text, forward ? endOffset : startOffset, forward);
    } else {
      nextIndex = findNextBalancedChar(text, currentChar, oppositeChar.toString(), forward ? endOffset : startOffset, forward);
    }
     
    if (nextIndex !== -1) {
      const newPosition = document.positionAt(nextIndex);
      if (select) {
        editor.selection = new vscode.Selection(forward ? selection.start : selection.end, document.positionAt(nextIndex + 1));
      }
      else {
        editor.selection = new vscode.Selection(newPosition, newPosition);
      }
    }
  }
}

export function deactivate() { }