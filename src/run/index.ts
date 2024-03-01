import * as vscode from "vscode";
import axios from "axios";
import { channel } from "diagnostics_channel";

export const queryContent = (host: string, query: string) =>
  axios
    .post(`${host}/query_clj`, query, {
      headers: { "Content-Type": "http/plain-text" },
    })
    .catch((e) => {
      console.error(e);
      return e;
    })
    .then((r) => r.data.result.data);

export const runBuffer = async (outputChannel: vscode.OutputChannel) => {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const text = editor.document.getText();
    const queryResult = await queryContent("http://localhost:3001", text);
    outputChannel.clear();
    outputChannel.show();
    outputChannel.appendLine(JSON.stringify(queryResult, null, 4));
  } else {
    vscode.window.showErrorMessage("No active text editor.");
  }
};
