import * as vscode from "vscode";
import { DBNode, DBNodeTreeItem } from "../../extension";

export enum ValueType {
  SYMBOL = "symbol",
  LIST = "list",
}

export class ValueNode implements DBNode {
  valueType: ValueType;
  data: any;
  label: string;
  iconPath: string | vscode.ThemeIcon;

  constructor({ valueType, data }: { valueType: ValueType; data: any }) {
    this.valueType = valueType;
    this.data = data;
    this.iconPath = new vscode.ThemeIcon("json");
    this.label = "value";
  }

  getCollapsibleState?: (() => vscode.TreeItemCollapsibleState) | undefined;

  fetchChildren(): Promise<DBNodeTreeItem[]> {
    return Promise.resolve([]);
  }
}
