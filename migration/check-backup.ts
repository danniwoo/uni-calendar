import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { readBackup, backupText } from "../lib/backup";
import { previewBackup } from "./backup-preview";

const file = process.argv[2];
if (!file) throw new Error("Supply a saved-semester JSON file.");
const text = readFileSync(file, "utf8");
const preview = previewBackup(text);
const db = new DatabaseSync(":memory:");
try {
  db.exec("CREATE TABLE rehearsal (owner TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)))");
  db.prepare("INSERT INTO rehearsal VALUES (?, ?)").run("local-test-owner", backupText(readBackup(text)));
  const row = db.prepare("SELECT data FROM rehearsal WHERE owner = ?").get("local-test-owner");
  assert.equal(typeof row?.data, "string");
  const result = readBackup(row!.data as string);
  assert.deepStrictEqual(result, {...JSON.parse(text), feedUrl: ""});
  console.log(JSON.stringify({...preview, sqliteRoundTrip: "passed"}, null, 2));
} finally {
  db.close();
}
