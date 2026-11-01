import assert from "node:assert/strict";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
async function session() {
  const r = await fetch(`${base}/api/asshown/workspace`);
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
const a = await session(),
  b = await session();
async function call(cookie, path, method = "GET", data) {
  return fetch(`${base}/api/asshown/${path}`, {
    method,
    headers: { cookie, "Content-Type": "application/json", origin: base },
    body: data ? JSON.stringify(data) : undefined,
  });
}
const payload = {
  revision: 0,
  products: [],
  requirements: [],
  version: 1,
  profiles: [],
  history: [],
};
const saved = await call(a, "workspace", "PUT", payload);
assert.equal(saved.status, 200);
assert.equal((await (await call(a, "workspace")).json()).workspace.revision, 1);
assert.equal((await (await call(b, "workspace")).json()).workspace, null);
assert.equal((await call(a, "workspace", "PUT", payload)).status, 409);
const forged = await fetch(`${base}/api/asshown/workspace`, {
  method: "PUT",
  headers: {
    cookie: a,
    origin: "https://evil.example",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
assert.equal(forged.status, 403);
assert.equal(
  (await call(a, "import", "POST", { url: "https://127.0.0.1/secret" })).status,
  422,
);
assert.equal(
  (await call(a, "community", "POST", { text: "Publish this" })).status,
  401,
);
assert.equal(
  (await call(a, "assist", "POST", { action: "translate", text: "hello" }))
    .status,
  400,
);
const ticket = await call(a, "support", "POST", {category:"accessibility",message:"The reading order needs a review."});
assert.equal(ticket.status,201);
const ticketId = (await ticket.json()).id;
assert.equal((await (await call(b,"support")).json()).tickets.length,0);
assert.equal((await call(b,"support","DELETE",{id:ticketId})).status,404);
assert.equal((await call(a,"support","PATCH",{id:ticketId,status:"resolved",response:"Resolved by owner"})).status,403);
assert.equal((await call(a,"support","DELETE",{id:ticketId})).status,200);
assert.equal((await call(a, "workspace", "DELETE")).status, 200);
assert.equal((await (await call(a, "workspace")).json()).workspace, null);
console.log(
  "Guest isolation, persistence, version conflict, CSRF, URL guard, moderation auth, consent, deletion: passed",
);
