import * as vscode from "vscode";
import axios, { AxiosResponse, AxiosError } from "axios";
import { JsonNode, fetchJsonChildren, newJsonNode } from "./tree_node/data_type/json";

const responseToDBNode: (data: any, datastore: DatastoreNode) => DBNode = (
  data,
  datastore
) => {
  // console.log(data);
  switch (data.type) {
    case "functor":
      return newFunctorNode({
        arity: data.arity,
        name: data.name,
        datastore,
      });
    case "clause":
      return newClauseNode({
        head: responseToDBNode(data.head, datastore) as TermNode,
        body: responseToDBNode(data.body, datastore),
      });
    case "term":
      return newTermNode({
        args: data.args.map(responseToDBNode),
        functor: responseToDBNode(data.functor, datastore) as FunctorNode,
        datastore,
      });
    case "value":
      return newValueNode({
        data: data["value-data"],
        valueType: data["value-type"],
      });
    case "json":
      return newJsonNode({
        data: data["data"],
        datastore,
      });
    default:
      throw new Error(`DATA_TYPE_NOT_RECOGNIZED TYPE=${data.type}`);
  }
};

const fetchRegistryChildren: (
  node: RegistryNode
) => Promise<DBNodeTreeItem[]> = async (node) => {
  let jsonQuery = {
    selector: { type: "term", functor: { name: "is-datastore", arity: 1 } },
  };
  let dsName = node.label;
  let jsonQueryString = JSON.stringify(jsonQuery);
  let query = `
      (= Reg (datastore-record {"backend": "CouchDB", "name": "${dsName}"}))
      (raw-query Reg ${jsonQueryString} Result)
      (return Result)
    `;
  let res: any[] = await axios
    .post(`${node.host}/query`, query, {
      headers: { "Content-Type": "http/plain-text" },
    })
    .catch((e) => {
      return e;
    })
    .then((res) => res.data.result);
  const datastores = res.map((term: any) => {
    const dsName = term.args[0]["ds-name"];
    const result = newDatastoreNode({ dsName, host: node.host });
    return intoTreeItem(result, result);
  });
  return datastores;
};

const fetchDatastoreChildren: (
  node: DatastoreNode
) => Promise<DBNodeTreeItem[]> = async (node) => {
  let jsonQuery = {
    selector: {
      $or: [
        {
          type: "functor",
        },
      ],
    },
  };
  let dsName = node.label;
  // console.log({ dsName });
  let jsonQueryString = JSON.stringify(jsonQuery);
  let query = `
      (= Reg (datastore-record {"backend": "CouchDB", "name": "${dsName}"}))
      (raw-query Reg ${jsonQueryString} Result)
      (return Result)
    `;
  let res: any[] = await axios
    .post(`${node.host}/query`, query, {
      headers: { "Content-Type": "http/plain-text" },
    })
    .catch((e) => {
      return e;
    })
    .then((res) => res.data.result);
  // console.log({ res });
  const nodes = res
    .map((x) => responseToDBNode(x, node))
    .map((x) => intoTreeItem(x, node));
  // console.log({ nodes });
  return nodes;
};

const fetchFunctorChildren: (
  node: FunctorNode
) => Promise<DBNodeTreeItem[]> = async (node) => {
  let jsonQuery = {
    selector: {
      $or: [
        {
          type: "term",
          functor: {
            name: node.name,
            arity: node.arity,
          },
        },
        {
          type: "clause",
          head: {
            functor: {
              name: node.name,
              arity: node.arity,
            },
          },
        },
      ],
    },
  };
  const datastore = node.datastore;
  let dsName = datastore.label;
  let jsonQueryString = JSON.stringify(jsonQuery);
  let query = `
      (= Reg (datastore-record {"backend": "CouchDB", "name": "${dsName}"}))
      (raw-query Reg ${jsonQueryString} Result)
      (return Result)
    `;
  let res: any[] = await axios
    .post(`${datastore.host}/query`, query, {
      headers: { "Content-Type": "http/plain-text" },
    })
    .catch((e) => {
      return e;
    })
    .then((res) => res.data.result);
  const nodes = res
    .map((x) => responseToDBNode(x, datastore))
    .map((x) => intoTreeItem(x, datastore));
  return nodes;
};

const fetchTermChildren: (node: TermNode) => Promise<DBNodeTreeItem[]> = async (
  node
) => {
  const children = node.args.map((arg) => intoTreeItem(arg, node.datastore));
  return children;
};

const fetchDBNodeChildren: (node: DBNode) => Promise<DBNodeTreeItem[]> = async (
  node
) => {
  switch (node.nodeType) {
    case NodeType.DATASTORE:
      return fetchDatastoreChildren(node as DatastoreNode);
    case NodeType.REGISTRY_DATASTORE:
      return fetchRegistryChildren(node as RegistryNode);
    case NodeType.FUNCTOR:
      return fetchFunctorChildren(node as FunctorNode);
    case NodeType.CLAUSE:
      return Promise.resolve([]);
    case NodeType.TERM:
      return fetchTermChildren(node as TermNode);
    case NodeType.JSON:
      return fetchJsonChildren(node as JsonNode);
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
      return fetchDBNodeChildren(element.nodeData!);
    } else {
      let topNode = newRegistryDatastoreNode({
        dsName: "ds.omegadb.io/registry",
        host: "http://localhost:3000",
      });
      return fetchDBNodeChildren(topNode);
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

export enum NodeType {
  DATASTORE,
  REGISTRY_DATASTORE,
  FUNCTOR,
  CLAUSE,
  TERM,
  JSON,
}

export interface DBNode {
  nodeType: NodeType;
  label: string;
  iconPath: string | vscode.ThemeIcon;
  getCollapsibleState?: (node: DBNode) => vscode.TreeItemCollapsibleState;
}

export interface DatastoreNode extends DBNode {
  host: string;
}

interface RegistryNode extends DatastoreNode {}

interface FunctorNode extends DBNode {
  arity: number;
  name: string;
  datastore: DatastoreNode;
}

interface ClauseNode extends DBNode {
  head: TermNode;
  body: DBNode;
}

interface TermNode extends DBNode {
  functor: FunctorNode;
  args: DBNode[];
  datastore: DatastoreNode;
}

enum ValueType {
  SYMBOL = "symbol",
  LIST = "list",
}

interface ValueNode extends DBNode {
  valueType: ValueType;
  data: any;
}

const newValueNode: (config: {
  valueType: ValueType;
  data: any;
}) => ValueNode = ({ valueType, data }) => ({
  valueType,
  data,
  label: "value",
  iconPath: new vscode.ThemeIcon("json"),
  nodeType: NodeType.CLAUSE,
});

const newTermNode: (config: {
  functor: FunctorNode;
  args: DBNode[];
  datastore: DatastoreNode;
}) => TermNode = ({ functor, args, datastore }) => ({
  functor,
  args,
  label: "Terms",
  iconPath: new vscode.ThemeIcon("symbol-array"),
  nodeType: NodeType.TERM,
  datastore,
});

const newClauseNode: (config: {
  head: TermNode;
  body: DBNode;
}) => ClauseNode = ({ head, body }) => ({
  head,
  body,
  label: "Clause",
  iconPath: new vscode.ThemeIcon("code"),
  nodeType: NodeType.CLAUSE,
});

const newDatastoreNode: (config: {
  dsName: string;
  host: string;
}) => DatastoreNode = ({ dsName, host }) => ({
  label: dsName,
  iconPath: new vscode.ThemeIcon("database"),
  nodeType: NodeType.DATASTORE,
  host,
});

const newRegistryDatastoreNode: (config: {
  dsName: string;
  host: string;
}) => RegistryNode = ({ dsName, host }) => ({
  label: dsName,
  iconPath: new vscode.ThemeIcon("cloud"),
  nodeType: NodeType.REGISTRY_DATASTORE,
  host,
});

const newFunctorNode: (config: {
  arity: number;
  name: string;
  datastore: DatastoreNode;
}) => FunctorNode = ({ arity, name, datastore }) => ({
  iconPath: new vscode.ThemeIcon("symbol-method"),
  arity,
  name: name,
  label: `${name}(${arity})`,
  nodeType: NodeType.FUNCTOR,
  datastore,
});

export const intoTreeItem: (
  node: DBNode,
  datastore: DatastoreNode,
  config?: { collapsibleState?: vscode.TreeItemCollapsibleState }
) => DBNodeTreeItem = (
  nodeData,
  datastore,
  { collapsibleState = vscode.TreeItemCollapsibleState.Expanded } = {}
) =>
  new DBNodeTreeItem({
    nodeData,
    collapsibleState,
    datastore,
  });

export class DBNodeTreeItem extends vscode.TreeItem {
  nodeData: DBNode;
  datastore: DatastoreNode;

  constructor({
    nodeData,
    collapsibleState,
    datastore,
  }: {
    nodeData: DBNode;
    collapsibleState: vscode.TreeItemCollapsibleState;
    datastore: DatastoreNode;
  }) {
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
