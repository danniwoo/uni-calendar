// Optional, local-only QA server. Open its printed URL with a browser.
// Does not launch a browser, read browser profiles, or contact Canvas.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const allowed = new Set(["preview.html", "preview.js", "preview.css", "reader.js", "model.js",
  "tests/browser-qa.html", "tests/browser-fixtures.js"]);
const server = createServer(async (req, res) => {
  const name = new URL(req.url, "http://localhost").pathname.slice(1);
  if (name === "fixture-reader.js") {
    const source = await readFile(new URL("reader.js", root), "utf8");
    // Lexical test doubles only. The serialized reader body is unchanged and
    // uses the browser's real DOMParser, not a DOM contract stub.
    res.setHeader("Content-Type", "text/javascript");
    res.end(`export function fixtureReader(fetch) {
      const location = { origin: "https://canvas.sydney.edu.au" };
      ${source.replaceAll("export ", "")}
      return readCanvas;
    }`);
    return;
  }
  if (!allowed.has(name)) { res.writeHead(404).end(); return; }
  try {
    let body = await readFile(new URL(name, root), "utf8");
    if (name === "preview.html") body = body.replace('<script type="module" src="preview.js"></script>',
      '<script type="module">import { installPreviewFixture } from "./tests/browser-fixtures.js"; installPreviewFixture(); await import("./preview.js");</script>');
    res.setHeader("Content-Type", name.endsWith(".html") ? "text/html" : name.endsWith(".css") ? "text/css" : "text/javascript");
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
  } catch { res.writeHead(500).end("Fixture could not load"); }
});
server.listen(0, "127.0.0.1", () => {
  console.log(`Synthetic reader QA: http://127.0.0.1:${server.address().port}/tests/browser-qa.html`);
  console.log(`Synthetic preview: http://127.0.0.1:${server.address().port}/preview.html?tab=10`);
});
