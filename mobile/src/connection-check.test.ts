import test from "node:test";
import assert from "node:assert/strict";
import {
  API_CHECK_URL,
  classifyConnection,
  checkNativeConnection,
  connectionLabel,
} from "./connection-check";

test("a redirect, HTML page or unverified URL never becomes a native login success", () => {
  assert.equal(
    classifyConnection(200, "text/html", API_CHECK_URL).kind,
    "not-api",
  );
  assert.equal(
    classifyConnection(
      200,
      "application/json",
      "https://example.invalid/signin?token=do-not-retain",
    ).kind,
    "redirected",
  );
  assert.equal(
    classifyConnection(200, "application/json", "").kind,
    "inconclusive",
  );
  const reached = classifyConnection(
    200,
    "application/json; charset=utf-8",
    API_CHECK_URL,
  );
  assert.equal(reached.kind, "json-response");
  assert.match(connectionLabel(reached), /identity unverified/);
  assert.deepEqual(classifyConnection(403, "application/json", API_CHECK_URL), {
    kind: "denied",
    status: 403,
  });
  assert.equal(
    classifyConnection(401, "application/json", API_CHECK_URL).kind,
    "sign-in-needed",
  );
  assert.equal(
    classifyConnection(405, "text/html", API_CHECK_URL).kind,
    "head-unsupported",
  );
  assert.equal(
    classifyConnection(503, "application/json", API_CHECK_URL).kind,
    "server-error",
  );
});

test("the native probe sends only HEAD and never reads response data or creates credentials", async () => {
  const result = await checkNativeConnection({
    fetcher: (async (url, init) => {
      assert.equal(url, API_CHECK_URL);
      assert.equal(init?.method, "HEAD");
      assert.equal(init?.body, undefined);
      assert.equal(init?.credentials, "include");
      assert.deepEqual(init?.headers, { Accept: "application/json" });
      return {
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        url: API_CHECK_URL,
        json: () => {
          throw new Error("Body must not be read");
        },
        text: () => {
          throw new Error("Body must not be read");
        },
      } as unknown as Response;
    }) as typeof fetch,
  });
  assert.deepEqual(result, { kind: "json-response", status: 200 });
});

test("network failures, timeout and cancellation remain distinct from authentication rejection", async () => {
  assert.equal(
    (
      await checkNativeConnection({
        fetcher: (async () => {
          throw new Error("sensitive URL must not be returned");
        }) as typeof fetch,
      })
    ).kind,
    "network-error",
  );
  const controller = new AbortController();
  controller.abort();
  assert.equal(
    (
      await checkNativeConnection({
        signal: controller.signal,
        fetcher: (async () => {
          throw new Error("must not start");
        }) as typeof fetch,
      })
    ).kind,
    "cancelled",
  );
  const pending = new AbortController();
  const cancelled = checkNativeConnection({
    signal: pending.signal,
    fetcher: (() => new Promise(() => {})) as typeof fetch,
  });
  pending.abort();
  assert.equal((await cancelled).kind, "cancelled");
  assert.equal(
    (
      await checkNativeConnection({
        timeoutMs: 5,
        fetcher: (() => new Promise(() => {})) as typeof fetch,
      })
    ).kind,
    "timeout",
  );
});
