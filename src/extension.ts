import * as vscode from "vscode";
import { OmegaDocumentProvider } from "./docs";
import { DBNodeTreeItem, OmegaTreeViewProvider } from "./tree_node";
import { DatastoreNode } from "./tree_node/data_type/datastore";
import { runBuffer } from "./run";
import {
  TokenType,
  format_doc,
  get_node_document_pos,
  get_selected_node,
  parseText,
} from "./editing/ast";
import { getSexpEnd, getSexpStart } from "./editing/editor";

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
    DBNode.fetchChildren()
      .then
      /* Finished Getting Children */
      ();
    vscode.window.showInformationMessage("NOT_IMPLEMENTED");
  });
  vscode.commands.registerCommand(
    "omega.editEntry",
    (treeItem: DBNodeTreeItem) => {
      nodeDependenciesProvider.edit(treeItem);
    }
  );

  const outputChannel = vscode.window.createOutputChannel("OmegaDB Output");
  vscode.commands.registerCommand("omega.runBuffer", () => {
    runBuffer(outputChannel);
  });

  vscode.commands.registerCommand("omega.navigateRight", () => {});
  vscode.commands.registerCommand("omega.navigateLeft", () => {});
  vscode.commands.registerCommand("omega.navigateSelectRight", () => {});
  vscode.commands.registerCommand("omega.navigateSelectLeft", () => {});
  vscode.commands.registerCommand("omega.sexpStart", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    getSexpStart(editor);
  });
  vscode.commands.registerCommand("omega.sexpEnd", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    getSexpEnd(editor);
  });

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(
      (event: vscode.TextDocumentChangeEvent) => {
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
        });
      }
    )
  );
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
    editor.edit((editBuilder) => {
      let document = editor.document;
      let range = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );

      const selection = editor.selection;
      let line = selection.start.line;
      let pos = selection.start.character;
      const lineText = document.lineAt(selection.start).text;
      let n = get_selected_node(ast, line, pos, lineText.substring(0, pos));

      editBuilder.replace(range, format_doc(ast, maxLine));
    });
  });
}

export function deactivate() {}
function formatRange(
  editor: vscode.TextEditor,
  document: vscode.TextDocument,
  range: vscode.Range,
  newText: string
) {
  throw new Error("Function not implemented.");
}
