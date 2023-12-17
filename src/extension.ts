import * as vscode from "vscode";
import axios, { AxiosResponse, AxiosError } from "axios";

const fetchDatastoreChildren: (
  node: DBNode
) => Promise<DBNodeTreeItem[]> = async (node) => {
  switch (node.nodeType) {
    case NodeType.DATASTORE:
      const nodeCasted: DatastoreNode = node as DatastoreNode;
      let query = `
        (= Reg (datastore-record {"backend": "CouchDB", "name": "${nodeCasted.label}"}))
        (raw-query Reg {"selector": {"type": "term", "functor": {"name": "is-datastore", "arity": 1}}} Result)
        (return Result)
      `;
      let res = await axios
        .post(`${nodeCasted.host}/query`, query, {
          headers: { "Content-Type": "http/plain-text" },
        })
        .catch((e) => {
          return e;
        })
        .then((res) => res.data.result);
      console.log({ res });
      const datastores = res.map((term: any) => {
        const dsName = term.args[0]["ds-name"];
        const result = newDatastoreNode({ dsName, host: nodeCasted.host });
        return result;
      });
      console.log({ datastores });
      return datastores;
  }
};

export class NodeDependenciesProvider
  implements vscode.TreeDataProvider<DBNodeTreeItem>
{
  getTreeItem(element: DBNodeTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DBNodeTreeItem): Thenable<DBNodeTreeItem[]> {
    if (element) {
      return fetchDatastoreChildren(element.nodeData!);
    } else {
      let topNode = newDatastoreNode({
        dsName: "ds.omegadb.io/registry",
        host: "http://localhost:3000",
      });
      return fetchDatastoreChildren(topNode);
    }
  }

  private _onDidChangeTreeData: vscode.EventEmitter<
    DBNodeTreeItem | undefined | null | void
  > = new vscode.EventEmitter<DBNodeTreeItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<
    DBNodeTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}

enum NodeType {
  DATASTORE,
}

interface DBNode {
  nodeType: NodeType;
  label: string;
  iconPath: string | vscode.ThemeIcon;
}

interface DatastoreNode extends DBNode {
  host: string;
}

const newDatastoreNode: (config: {
  dsName: string;
  host: string;
}) => DatastoreNode = ({ dsName, host }) => ({
  label: dsName,
  iconPath: new vscode.ThemeIcon("database"),
  nodeType: NodeType.DATASTORE,
  host,
});

const intoTreeItem: (node: DBNode) => DBNodeTreeItem = (nodeData) =>
  new DBNodeTreeItem({
    nodeData,
    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
  });

class DBNodeTreeItem extends vscode.TreeItem {
  nodeData: DBNode;

  constructor({
    nodeData,
    collapsibleState,
  }: {
    nodeData: DBNode;
    collapsibleState: vscode.TreeItemCollapsibleState;
  }) {
    super(nodeData.label, collapsibleState);
    this.iconPath = nodeData.iconPath;
    this.nodeData = nodeData;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "omega" is now active!');
  const rootPath =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;
  const nodeDependenciesProvider = new NodeDependenciesProvider();
  vscode.window.registerTreeDataProvider(
    "omegaDatastores",
    nodeDependenciesProvider
  );
  vscode.commands.registerCommand("omega.helloWorld", () => {
    vscode.window.showInformationMessage("Hello World from Omega!");
  });
  vscode.commands.registerCommand("omega.fetchDatastore", () => {
    vscode.window.showInformationMessage("Running TreeView!");
    // nodeDependenciesProvider.refresh();
  });
}

export function deactivate() {}
