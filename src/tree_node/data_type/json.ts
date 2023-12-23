import * as vscode from "vscode";
import {
  DBNode,
  DBNodeTreeItem,
  DatastoreNode,
  NodeType,
  intoTreeItem,
} from "../../extension";

const getJsonNodeCollapsibleState: (
  node: JsonNode
) => vscode.TreeItemCollapsibleState = ({ data, isEntry }) => {
  if (isEntry) {
    return vscode.TreeItemCollapsibleState.Expanded;
  }
  switch (jsonDataToType(data)) {
    case JsonDataType.JSON_ARRAY:
      return vscode.TreeItemCollapsibleState.Collapsed;
    case JsonDataType.JSON_OBJ:
      return vscode.TreeItemCollapsibleState.Expanded;
    case JsonDataType.JSON_PRIM:
      return vscode.TreeItemCollapsibleState.None;
  }
};

export interface JsonNode extends DBNode {
  data: any;
  datastore: DatastoreNode;
  isEntry: boolean;
}

enum JsonDataType {
  JSON_PRIM = "prim",
  JSON_ARRAY = "array",
  JSON_OBJ = "obj",
}

const jsonDataToType: (data: any) => JsonDataType = (data) => {
  if (Array.isArray(data)) {
    return JsonDataType.JSON_ARRAY;
  } else if (typeof data === "object" && data !== null) {
    return JsonDataType.JSON_OBJ;
  } else {
    return JsonDataType.JSON_PRIM;
  }
};

const jsonIcon: (data: any, isEntry: boolean) => vscode.ThemeIcon = (
  data,
  isEntry
) => {
  if (isEntry) {
    return new vscode.ThemeIcon("symbol-parameter");
  }
  switch (jsonDataToType(data)) {
    case JsonDataType.JSON_ARRAY:
      return new vscode.ThemeIcon("array");
    case JsonDataType.JSON_OBJ:
      return new vscode.ThemeIcon("json");
    case JsonDataType.JSON_PRIM:
      return new vscode.ThemeIcon("symbol-property");
  }
};

const jsonLabel: (data: any, isEntry: boolean) => string = (data, isEntry) => {
  if (isEntry) {
    return data[0];
  }
  switch (jsonDataToType(data)) {
    case JsonDataType.JSON_ARRAY:
      return "array";
    case JsonDataType.JSON_OBJ:
      return "json";
    case JsonDataType.JSON_PRIM:
      return JSON.stringify(data);
  }
};

export const newJsonNode: (config: {
  data: any;
  datastore: DatastoreNode;
  isEntry?: boolean;
}) => JsonNode = ({ data, datastore, isEntry = false }) => {
  const iconPath = jsonIcon(data, isEntry);
  const label = jsonLabel(data, isEntry);
  const node: JsonNode = {
    data,
    label,
    iconPath,
    nodeType: NodeType.JSON,
    datastore,
    isEntry,
    getCollapsibleState: getJsonNodeCollapsibleState as any,
  };
  return node;
};

export const fetchJsonChildren: (
  node: JsonNode
) => Promise<DBNodeTreeItem[]> = async ({ isEntry, data, datastore }) => {
  const isArray = Array.isArray(data);
  const isObject = typeof data === "object" && data !== null;
  if (!(isArray || isObject)) {
    return [];
  }
  if (isEntry) {
    return [intoTreeItem(newJsonNode({ data: data[1], datastore }), datastore)];
  }
  const jsonNodes = isArray
    ? data.map((child) => newJsonNode({ data: child, datastore }))
    : Object.entries(data).map((entry) =>
        newJsonNode({ data: entry, datastore, isEntry: true })
      );
  return jsonNodes.map((node) => intoTreeItem(node, node.datastore));
};
