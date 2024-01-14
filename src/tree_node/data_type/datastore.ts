import axios from "axios";
import * as vscode from "vscode";
import { DBNode, DBNodeTreeItem, intoTreeItem } from "../index";
import { FunctorNode, FunctorNodeType } from "./clause";

export class DatastoreNode implements DBNode {
  dsName: string;
  host: string;
  label: string;
  iconPath: string | vscode.ThemeIcon;

  constructor({ host, dsName }: { dsName: string; host: string }) {
    this.host = host;
    this.dsName = dsName;
    this.label = dsName;
    this.iconPath = new vscode.ThemeIcon("database");
  }

  getCollapsibleState?: (() => vscode.TreeItemCollapsibleState) | undefined;

  async fetchChildren(): Promise<DBNodeTreeItem[]> {
    const jsonQuery = JSON.stringify({
      selector: { type: { $or: ["term", "clause"] } },
    });
    const datastoreRecordQuery = JSON.stringify({
      backend: "CouchDB",
      name: this.dsName,
    });
    const query = `
        (= DS (datastore-record ${datastoreRecordQuery}))
        (raw-query DS ${jsonQuery} QueryResult)
        (serialize QueryResult Serial)
        (or (and (destructure Serial {"head": {"functor": Functor}})
                 (= Type "clause"))
            (and (destructure Serial {"functor": Functor})
                 (= Type "term")))
        (destructure Functor {"name": Name, "arity": Arity})
        (return {"name": Name,
                 "arity": Arity,
                 "type": Type})
      `;
    const res: any[] = await axios
      .post(`${this.host}/query`, query, {
        headers: { "Content-Type": "http/plain-text" },
      })
      .catch((e) => {
        console.error(e);
        throw e;
      })
      .then((res) => res.data.result);
    const nodes = res
      .map((x) => x.data)
      .map((x) => this.readFunctorResponse(x))
      .map((x) => intoTreeItem(x, this));
    // console.log({ nodes });
    return nodes;
  }

  readFunctorResponse({
    name,
    arity,
    type: nodeType,
  }: {
    name: string;
    arity: number;
    type: FunctorNodeType;
  }): DBNode {
    return new FunctorNode({
      arity,
      datastore: this,
      name,
      nodeType,
    });
  }
}

export class RegistryNode implements DBNode {
  dsName: string;
  host: string;
  label: string;
  iconPath: string | vscode.ThemeIcon;

  constructor({ host, dsName }: { dsName: string; host: string }) {
    this.host = host;
    this.dsName = dsName;
    this.label = dsName;
    this.iconPath = new vscode.ThemeIcon("cloud");
  }

  getCollapsibleState?: (() => vscode.TreeItemCollapsibleState) | undefined;

  async fetchChildren(): Promise<DBNodeTreeItem[]> {
    let jsonQuery = {
      selector: { type: "term", functor: { name: "is-datastore", arity: 1 } },
    };
    let dsName = this.label;
    let jsonQueryString = JSON.stringify(jsonQuery);
    let query = `
            (= Reg (datastore-record {"backend": "CouchDB", "name": "${dsName}"}))
            (raw-query Reg ${jsonQueryString} Result)
            (return Result)
          `;
    let res: any[] = await axios
      .post(`${this.host}/query`, query, {
        headers: { "Content-Type": "http/plain-text" },
      })
      .catch((e) => {
        console.error(e);
        throw e;
      })
      .then((res) => res.data.result);
    const datastores = res.map((term: any) => {
      const dsName = term.args[0]["ds-name"];
      const result = new DatastoreNode({ dsName, host: this.host });
      return intoTreeItem(result as any, result);
    });
    return datastores;
  }
}
