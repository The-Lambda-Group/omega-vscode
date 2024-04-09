import * as vscode from "vscode";
import { DBNodeTreeItem } from "./tree_node";

export class OmegaDocumentProvider
  implements vscode.TextDocumentContentProvider
{
  onDidChange?: vscode.Event<vscode.Uri> | undefined;
  provideTextDocumentContent(
    uri: vscode.Uri,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<string> {
    throw new Error("Method not implemented.");
  }

  async edit(treeItem: DBNodeTreeItem) {
    vscode.window.showInformationMessage("EDITING DOCUMENT");
    console.log({ treeItem });
    const doc = await vscode.workspace.openTextDocument();

    await vscode.window.showTextDocument(doc);
    const editor = vscode.window.activeTextEditor;
    editor?.edit((editBuilder) => {
      const position = new vscode.Position(0, 0);
      const query =
        treeItem.nodeData.buildEditQuery?.() ?? "No Edit query for Node";
      editBuilder.insert(position, query);
    });
  }
}
