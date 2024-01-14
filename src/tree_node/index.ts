import * as vscode from "vscode";
import { ClauseNode, FunctorNode, TermNode } from "./data_type/clause";
import { DatastoreNode, RegistryNode } from "./data_type/datastore";
import { JsonNode } from "./data_type/json";
import { ValueNode } from "./data_type/primitive";
import { OmegaDocumentProvider } from "../docs";

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

export class OmegaTreeViewProvider
  implements vscode.TreeDataProvider<DBNodeTreeItem>
{
  documentProvider: OmegaDocumentProvider;

  constructor({
    documentProvider,
  }: {
    documentProvider: OmegaDocumentProvider;
  }) {
    this.documentProvider = documentProvider;
  }

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

  async edit(treeItem: DBNodeTreeItem) {
    await this.documentProvider.edit(treeItem);
  }
}

export interface DBNode {
  label: string;
  iconPath: string | vscode.ThemeIcon;
  getCollapsibleState?: () => vscode.TreeItemCollapsibleState;
  buildEditQuery?: () => string;
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
