import * as vscode from "vscode";
import { OmegaDocumentProvider } from "./docs";
import { runBuffer } from "./run";

export function activate(context: vscode.ExtensionContext) {
  const documentProvider = new OmegaDocumentProvider();
  vscode.workspace.registerTextDocumentContentProvider(
    "omegaDocuments",
    documentProvider
  );

  const outputChannel = vscode.window.createOutputChannel("OmegaDB Output");
  vscode.commands.registerCommand("omega.runBuffer", () => {
    runBuffer(outputChannel);
  });
}

export function deactivate() {}
