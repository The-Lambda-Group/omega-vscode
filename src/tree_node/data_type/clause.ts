import axios from "axios";
import * as vscode from "vscode";
import {
  DBNode,
  DBNodeTreeItem,
  intoTreeItem,
  responseToDBNode,
} from "../index";
import { DatastoreNode } from "./datastore";

export enum FunctorNodeType {
  TERM = "term",
  CLAUSE = "clause",
}

export class FunctorNode implements DBNode {
  arity: number;
  name: string;
  datastore: DatastoreNode;
  nodeType: FunctorNodeType;
  label: string;
  iconPath: string | vscode.ThemeIcon;

  constructor({
    arity,
    name,
    datastore,
    nodeType = FunctorNodeType.TERM,
  }: {
    arity: number;
    name: string;
    datastore: DatastoreNode;
    nodeType?: FunctorNodeType;
  }) {
    this.arity = arity;
    this.name = name;
    this.datastore = datastore;
    this.nodeType = nodeType;
    this.label = `${name}(${arity})`;
    this.iconPath = this.getIconPath();
  }

  getIconPath(): vscode.ThemeIcon {
    switch (this.nodeType) {
      case FunctorNodeType.CLAUSE:
        return new vscode.ThemeIcon("symbol-method");
      case FunctorNodeType.TERM:
        return new vscode.ThemeIcon("symbol-array");
    }
  }

  getCollapsibleState?: (() => vscode.TreeItemCollapsibleState) | undefined;

  childrenQuery(): string {
    switch (this.nodeType) {
      case FunctorNodeType.CLAUSE:
        return this.clauseChildrenQuery();
      case FunctorNodeType.TERM:
        return this.termChildrenQuery();
    }
  }

  async fetchChildren(): Promise<DBNodeTreeItem[]> {
    const query = this.childrenQuery();
    let res: any[] = await axios
      .post(`${this.datastore.host}/query`, query, {
        headers: { "Content-Type": "http/plain-text" },
      })
      .catch((e) => {
        console.error(e);
        return e;
      })
      .then((res) => res.data.result);
    const nodes = res
      .map((x) => responseToDBNode(x, this.datastore))
      .map((x) => intoTreeItem(x, this.datastore));
    return nodes;
  }

  termChildrenQuery(): string {
    const datastoreRecordQuery = JSON.stringify({
      backend: "CouchDB",
      name: this.datastore.dsName,
    });
    const couchSelectorQuery = JSON.stringify({
      selector: {
        type: "term",
        functor: { name: this.name, arity: this.arity },
      },
    });
    return `
      (= DS (datastore-record ${datastoreRecordQuery}))
      (raw-query DS ${couchSelectorQuery} QueryResult)
      (return QueryResult)
    `;
  }

  clauseChildrenQuery(): string {
    const datastoreRecordQuery = JSON.stringify({
      backend: "CouchDB",
      name: this.datastore.dsName,
    });
    const couchSelectorQuery = JSON.stringify({
      selector: {
        type: "clause",
        head: {
          functor: { name: this.name, arity: this.arity },
        },
      },
    });
    return `
      (= DS (datastore-record ${datastoreRecordQuery}))
      (raw-query DS ${couchSelectorQuery} QueryResult)
      (return QueryResult)
    `;
  }
}

export class ClauseNode implements DBNode {
  head: TermNode;
  body: DBNode;
  label: string;
  iconPath: string | vscode.ThemeIcon;

  constructor({ head, body }: { head: TermNode; body: DBNode }) {
    this.head = head;
    this.body = body;
    const labelArgs = head.args.map((x: any) => x.data).join(", ");
    const labelFunctorName = head.functor.name;
    this.label = `${labelFunctorName}(${labelArgs})`;
    this.iconPath = new vscode.ThemeIcon("code");
  }

  getCollapsibleState(): vscode.TreeItemCollapsibleState {
    return vscode.TreeItemCollapsibleState.None;
  }

  fetchChildren(): Promise<DBNodeTreeItem[]> {
    return Promise.resolve([]);
  }
}

export class TermNode implements DBNode {
  functor: FunctorNode;
  args: DBNode[];
  datastore: DatastoreNode;
  label: string;
  iconPath: string | vscode.ThemeIcon;

  constructor({
    functor,
    args,
    datastore,
  }: {
    functor: FunctorNode;
    args: DBNode[];
    datastore: DatastoreNode;
  }) {
    this.functor = functor;
    this.args = args;
    this.datastore = datastore;
    this.label = "Terms";
    this.iconPath = new vscode.ThemeIcon("symbol-array");
  }

  buildEditQuery(): string {
    return "Editing Term";
  }

  getCollapsibleState: undefined;

  async fetchChildren(): Promise<DBNodeTreeItem[]> {
    const children = this.args.map((arg) => intoTreeItem(arg, this.datastore));
    return children;
  }
}
