"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const UUIDS = [
  "f437b5c8-a89d-4e25-9289-65e91bb9e1d1",
  "4bd83e54-b622-4b32-a0b4-3f95fb3196e5",
];

function makeStorage(initial = null) {
  const values = new Map();
  if (initial !== null) values.set("boopbox.room-browser-id.v1", initial);
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

function makeLocks() {
  let previous = Promise.resolve();
  return {
    request(_name, callback) {
      const current = previous.then(callback);
      previous = current.catch(() => {});
      return current;
    },
  };
}

function environment(storage, idSource = () => UUIDS[0], locks = makeLocks()) {
  return {
    localStorage: storage,
    crypto: { randomUUID: idSource },
    navigator: { locks },
  };
}

test("room browser identity persists and is shared by concurrent tabs", async () => {
  const { getRoomBrowserIdentity } = await import("../../web/src/pages/Rooms/browserIdentity.ts");
  const storage = makeStorage();
  let generated = 0;
  const env = environment(storage, () => {
    generated += 1;
    return UUIDS[generated - 1];
  });

  const [first, second] = await Promise.all([
    getRoomBrowserIdentity(env),
    getRoomBrowserIdentity(env),
  ]);

  assert.equal(first, UUIDS[0]);
  assert.equal(second, first);
  assert.equal(generated, 1);
  assert.equal(await getRoomBrowserIdentity(env), first);
});

test("room browser identity replaces malformed storage values under the tab lock", async () => {
  const { getRoomBrowserIdentity } = await import("../../web/src/pages/Rooms/browserIdentity.ts");
  const storage = makeStorage("not-an-id");
  const identity = await getRoomBrowserIdentity(environment(storage));

  assert.equal(identity, UUIDS[0]);
  assert.equal(storage.getItem("boopbox.room-browser-id.v1"), UUIDS[0]);
});

test("room browser identity fails clearly when storage or tab coordination is unavailable", async () => {
  const { getRoomBrowserIdentity } = await import("../../web/src/pages/Rooms/browserIdentity.ts");
  await assert.rejects(getRoomBrowserIdentity({}), /browser storage and tab coordination/);
  await assert.rejects(
    getRoomBrowserIdentity({ localStorage: makeStorage(), crypto: { randomUUID: () => UUIDS[0] }, navigator: {} }),
    /browser storage and tab coordination/,
  );
});
