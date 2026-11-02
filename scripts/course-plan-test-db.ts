// Disposable synthetic SQLite adapter for the production D1 query path.
import {DatabaseSync} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
export function coursePlanTestDb() {
  const sqlite=new DatabaseSync(":memory:");
  const dir=new URL("../drizzle/",import.meta.url);
  for(const file of readdirSync(dir).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(new URL(file,dir),"utf8"));
  const db={prepare(sql:string){
    function statement(args:unknown[]=[]) {
      return {
        bind(...values:unknown[]){return statement(values);},
        async first(){return sqlite.prepare(sql).get(...args as (string|number|null)[])??null;},
        async all(){return {results:sqlite.prepare(sql).all(...args as (string|number|null)[]),success:true};},
        async run(){const r=sqlite.prepare(sql).run(...args as (string|number|null)[]);return {success:true,meta:{changes:Number(r.changes)}};},
      };
    }
    return statement();
  }} as unknown as D1Database;
  return {db,sqlite};
}
