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
    .then((r) => r?.data?.result?.data || r?.data?.result || r);

export const runBuffer = async (outputChannel: vscode.OutputChannel) => {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const host =
      vscode.workspace.getConfiguration().get("omega.host") ||
      "http://localhost:3001";
    const text = editor.document.getText();
    const queryResult = await queryContent(host as string, text).catch((e) => {
      return { error: { message: e.message, stack: e.stack } };
    });
    outputChannel.clear();
    outputChannel.show(true);
    outputChannel.appendLine(JSON.stringify(queryResult, null, 2));
  } else {
    vscode.window.showErrorMessage("No active text editor.");
  }
};
