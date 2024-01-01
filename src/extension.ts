import * as vscode from "vscode";
import {
  ClauseNode,
  FunctorNode,
  TermNode,
} from "./tree_node/data_type/clause";
import { DatastoreNode, RegistryNode } from "./tree_node/data_type/datastore";
import { JsonNode } from "./tree_node/data_type/json";
import { ValueNode } from "./tree_node/data_type/primitive";

export const responseToDBNode: (
  data: any,
  datastore: DatastoreNode
) => DBNode = (data, datastore) => {
  // console.log(data);
  switch (data.type) {
    case "functor":
      return new FunctorNode({
        arity: data.arity,
        name: data.name,
        datastore,
      });
    case "clause":
      return new ClauseNode({
        head: responseToDBNode(data.head, datastore) as any,
        body: responseToDBNode(data.body, datastore),
      });
    case "term":
      return new TermNode({
        args: data.args.map(responseToDBNode),
        functor: responseToDBNode(data.functor, datastore) as any,
        datastore,
      });
    case "value":
      return new ValueNode({
        data: data["value-data"],
        valueType: data["value-type"],
      });
    case "json":
      return new JsonNode({
        data: data["data"],
        datastore,
      });
    default:
      throw new Error(`DATA_TYPE_NOT_RECOGNIZED TYPE=${data.type}`);
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
      return element.nodeData.fetchChildren();
    } else {
      let topNode = new RegistryNode({
        dsName: "ds.omegadb.io/registry",
        host: "http://localhost:3000",
      });
      return topNode.fetchChildren();
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

export interface DBNode {
  label: string;
  iconPath: string | vscode.ThemeIcon;
  getCollapsibleState?: () => vscode.TreeItemCollapsibleState;
  fetchChildren: () => Promise<DBNodeTreeItem[]>;
}

export const intoTreeItem: (
  node: DBNode,
  datastore: DatastoreNode
) => DBNodeTreeItem = (nodeData, datastore) =>
  new DBNodeTreeItem({
    nodeData,
    datastore,
  });

export class DBNodeTreeItem extends vscode.TreeItem {
  nodeData: DBNode;
  datastore: DatastoreNode;

  constructor({
    nodeData,
    datastore,
  }: {
    nodeData: DBNode;
    datastore: DatastoreNode;
  }) {
    const overrideCollapsibleState =
      nodeData.getCollapsibleState && nodeData.getCollapsibleState();
    const collapsibleState =
      overrideCollapsibleState ?? vscode.TreeItemCollapsibleState.Expanded;
    super(nodeData.label, collapsibleState);
    this.iconPath = nodeData.iconPath;
    this.nodeData = nodeData;
    this.datastore = datastore;
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
