import * as vscode from "vscode";
import { DBNode, DBNodeTreeItem, intoTreeItem } from "../../extension";
import { DatastoreNode } from "./datastore";

export class JsonNode implements DBNode {
  data: any;
  datastore: DatastoreNode;
  isEntry: boolean;
  label: string;
  iconPath: string | vscode.ThemeIcon;

  constructor({
    data,
    datastore,
    isEntry = false,
  }: {
    data: any;
    datastore: DatastoreNode;
    isEntry?: boolean;
  }) {
    this.data = data;
    this.datastore = datastore;
    this.isEntry = isEntry;
    this.iconPath = jsonIcon(data, isEntry);
    this.label = jsonLabel(data, isEntry);
  }

  getCollapsibleState(): vscode.TreeItemCollapsibleState {
    if (this.isEntry) {
      return vscode.TreeItemCollapsibleState.Expanded;
    }
    switch (jsonDataToType(this.data)) {
      case JsonDataType.JSON_ARRAY:
        return vscode.TreeItemCollapsibleState.Collapsed;
      case JsonDataType.JSON_OBJ:
        return vscode.TreeItemCollapsibleState.Expanded;
      case JsonDataType.JSON_PRIM:
        return vscode.TreeItemCollapsibleState.None;
    }
  }

  async fetchChildren(): Promise<DBNodeTreeItem[]> {
    const isArray = Array.isArray(this.data);
    const isObject = typeof this.data === "object" && this.data !== null;
    if (!(isArray || isObject)) {
      return [];
    }
    if (this.isEntry) {
      return [
        intoTreeItem(
          new JsonNode({ data: this.data[1], datastore: this.datastore }),
          this.datastore
        ),
      ];
    }
    const jsonNodes = isArray
      ? this.data.map(
          (child: any) =>
            new JsonNode({ data: child, datastore: this.datastore })
        )
      : Object.entries(this.data).map(
          (entry) =>
            new JsonNode({
              data: entry,
              datastore: this.datastore,
              isEntry: true,
            })
        );
    return jsonNodes.map((node: any) => intoTreeItem(node, node.datastore));
  }
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
