import axios from "axios";
import * as vscode from "vscode";

const constructUrlParams = (
  baseUrl: string,
  params: { [key: string]: string }
) => {
  const queryString = Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");

  return `${baseUrl}?${queryString}`;
};

export const queryContent = (
  host: string,
  query: string,
  config: { oqlEnvName?: string } = {}
) => {
  const { oqlEnvName } = config;
  const envNameHeaders: any = oqlEnvName ? { oql_env_name: oqlEnvName } : {};
  const fullUrl = constructUrlParams(`${host}/query_clj`, envNameHeaders);
  const headers = { "Content-Type": "http/plain-text", ...envNameHeaders };
  return axios
    .post(fullUrl, query, { headers })
    .catch((e) => ({ error: e.response.data }))
    .then((r: any) => r?.data?.result?.data || r?.data?.result || r);
};

export const runBuffer = async (outputChannel: vscode.OutputChannel) => {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const host =
      vscode.workspace.getConfiguration().get("omega.host") ||
      "http://localhost:3001";
    const oqlEnvName = vscode.workspace
      .getConfiguration()
      .get("omega.envName") as string | undefined;
    const text = editor.document.getText();
    const queryResult = await queryContent(host as string, text, {
      oqlEnvName,
    });
    outputChannel.clear();
    outputChannel.show(true);
    if (queryResult.error) {
      outputChannel.appendLine(queryResult.error.reason);
      outputChannel.appendLine(queryResult.error.stack);
    } else {
      outputChannel.appendLine(JSON.stringify(queryResult, null, 2));
    }
  } else {
    vscode.window.showErrorMessage("No active text editor.");
  }
};
