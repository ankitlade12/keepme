import { createClerkClient } from "@clerk/backend";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import postgres from "postgres";
const root = process.cwd(),
  base = "http://localhost:3102",
  hosted = process.env.ASSHOWN_URL;
assert(process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"));
assert(hosted && new URL(hosted).hostname.endsWith(".vercel.app"));
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const users = [],
  checks = [];
let child, temporary, sql, note;
const protection = {
  "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN,
};
async function user() {
  const u = await clerk.users.createUser({
    emailAddress: [`qa-${crypto.randomUUID()}+clerk_test@example.com`],
    skipPasswordRequirement: true,
  });
  users.push(u);
  u.session = (await clerk.sessions.createSession({ userId: u.id })).id;
  return u;
}
async function call(u, route, method = "GET", body, target = base) {
  const jwt = u ? (await clerk.sessions.getToken(u.session)).jwt : null;
  return fetch(`${target}/api/asshown/${route}`, {
    method,
    headers: {
      ...(target === hosted ? protection : {}),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      Origin: target,
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90000),
  });
}
async function expectStatus(p, status) {
  const r = await p;
  assert.equal(r.status, status, await r.clone().text());
  return r;
}
function passed(name) {
  checks.push({ name, status: "passed" });
  console.log("PASS", name);
}
try {
  const [owner, other, mod] = await Promise.all([user(), user(), user()]);
  temporary = await mkdtemp(path.join(tmpdir(), "asshown-role-qa-"));
  const archive = execFileSync("git", ["archive", "HEAD"], {
    cwd: root,
    maxBuffer: 256 * 1024 * 1024,
  });
  execFileSync("tar", ["-x", "-C", temporary], { input: archive });
  await symlink(
    path.join(root, "node_modules"),
    path.join(temporary, "node_modules"),
  );
  const records = path.join(temporary, "test-records");
  const log = createWriteStream(
    path.join(root, "artifacts/full-qa/isolated-server.log"),
  );
  child = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "localhost",
      "--port",
      "3102",
    ],
    {
      cwd: temporary,
      detached: true,
      env: {
        ...process.env,
        NODE_ENV: "development",
        DATABASE_URL: "",
        ASSHOWN_DATA_DIRECTORY: records,
        ASSHOWN_MODERATOR_IDS: mod.id,
        ASSHOWN_MODERATOR_EMAILS: "",
        ASSHOWN_COMMUNITY_ENABLED: "true",
        ASSHOWN_PAID_FEATURES_ENABLED: "true",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`${base}/api/asshown/community`, {
        signal: AbortSignal.timeout(2000),
      });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert(ready, "Isolated server failed to start");
  const workspace = {
    revision: 0,
    products: [],
    requirements: [],
    profiles: [],
    history: [],
    version: 1,
  };
  await expectStatus(call(owner, "workspace", "PUT", workspace), 200);
  assert(
    JSON.parse(await readFile(path.join(records, "records.json"), "utf8")).some(
      (r) => r.owner === `account:${owner.id}`,
    ),
    "Isolation must be proven before moderation tests",
  );
  passed("isolated record storage with real Clerk authentication");
  const makeNote = {
    title: "Synthetic QA item",
    retailer: "QA isolated retailer",
    productId: `qa-${crypto.randomUUID()}`,
    color: "Rust",
    size: "M",
    confirmed: true,
    text: "Machine washable. Synthetic QA report, not a shopping recommendation.",
    date: new Date().toISOString(),
    consent: true,
  };
  await expectStatus(
    call(owner, "community", "POST", { ...makeNote, consent: false }),
    400,
  );
  await expectStatus(
    call(owner, "community", "POST", {
      ...makeNote,
      text: "Contact buyer@example.com for details.",
    }),
    400,
  );
  const unconfirmed = (
    await (
      await expectStatus(
        call(owner, "community", "POST", {
          ...makeNote,
          confirmed: false,
          productId: "unconfirmed-qa",
        }),
        201,
      )
    ).json()
  ).note;
  await expectStatus(
    call(mod, "community", "PATCH", {
      id: unconfirmed.id,
      action: "publish",
      reason: "Must reject unconfirmed variant",
    }),
    403,
  );
  passed("publication consent, personal information and unconfirmed variants");
  // Use an actual hosted-screened product image, then isolate its moderation records.
  const photo = new FormData();
  photo.set("consent", "true");
  photo.set("redactionReviewed", "true");
  photo.set(
    "image",
    new File([await readFile("public/demo/rust-jacket.png")], "qa.png", {
      type: "image/png",
    }),
  );
  const uploaded = await expectStatus(
    call(owner, "community-media", "POST", photo, hosted),
    201,
  );
  const { mediaId } = await uploaded.json();
  sql = postgres(process.env.DATABASE_URL, {
    ssl: "require",
    max: 1,
    prepare: false,
  });
  const [media] =
    await sql`select * from asshown_records where id=${mediaId} and owner=${`account:${owner.id}`} and category='community-media'`;
  assert(
    media,
    "Hosted test media must be found in the configured test database",
  );
  const all = JSON.parse(
    await readFile(path.join(records, "records.json"), "utf8"),
  );
  all.push(media);
  await writeFile(path.join(records, "records.json"), JSON.stringify(all));
  note = (
    await (
      await expectStatus(
        call(owner, "community", "POST", { ...makeNote, mediaId }),
        201,
      )
    ).json()
  ).note;
  await expectStatus(call(other, "community", "POST", makeNote), 409);
  assert.equal((await (await call(other, "community")).json()).queue.length, 0);
  assert(
    (await (await call(mod, "community")).json()).queue.some(
      (n) => n.id === note.id,
    ),
  );
  await expectStatus(call(null, `community/${note.id}/image`), 404);
  await expectStatus(call(mod, `community/${note.id}/image`), 200);
  await expectStatus(
    call(owner, "community", "PATCH", {
      id: note.id,
      action: "publish",
      reason: "Cannot self publish",
    }),
    403,
  );
  await expectStatus(
    call(other, "community", "PATCH", {
      id: note.id,
      action: "correct",
      replacement: "Forged correction",
      reason: "Wrong contributor",
    }),
    403,
  );
  await expectStatus(
    call(mod, "community", "PATCH", {
      id: note.id,
      action: "publish",
      reason: "Image not yet reviewed",
    }),
    403,
  );
  await expectStatus(
    call(mod, "community", "PATCH", {
      id: note.id,
      action: "publish",
      imageReviewed: true,
      reason: "Synthetic product photo reviewed",
    }),
    200,
  );
  await expectStatus(call(null, `community/${note.id}/image`), 200);
  const pub = (await (await call(null, "community")).json()).published.find(
    (n) => n.id === note.id,
  );
  assert(pub);
  assert.equal(pub.owner, undefined);
  assert.equal(pub.audit, undefined);
  passed(
    "moderator image gate, private pending media, publication and public-field minimization",
  );
  await expectStatus(
    call(other, "community", "PATCH", {
      id: note.id,
      action: "dispute",
      reason: "Synthetic disagreement for QA",
    }),
    200,
  );
  await expectStatus(call(null, `community/${note.id}/image`), 404);
  await expectStatus(
    call(mod, "community", "PATCH", {
      id: note.id,
      action: "remove",
      reason: "Synthetic QA removal",
    }),
    200,
  );
  await expectStatus(call(null, `community/${note.id}/image`), 404);
  await expectStatus(
    call(owner, "community", "PATCH", {
      id: note.id,
      action: "appeal",
      reason: "Synthetic QA appeal with evidence",
    }),
    200,
  );
  await expectStatus(
    call(mod, "community", "PATCH", {
      id: note.id,
      action: "publish",
      imageReviewed: true,
      reason: "Synthetic QA appeal reviewed",
    }),
    200,
  );
  await expectStatus(
    call(owner, "community", "PATCH", {
      id: note.id,
      action: "correct",
      replacement: "Dry-clean only. Corrected synthetic report.",
      reason: "Correcting the synthetic care statement",
    }),
    200,
  );
  assert(
    !(await (await call(null, "community")).json()).published.some(
      (n) => n.id === note.id,
    ),
  );
  const own = (await (await call(owner, "community")).json()).own.find(
    (n) => n.id === note.id,
  );
  assert.equal(own.revisions[0].text, makeNote.text);
  assert(own.audit.length >= 6);
  await expectStatus(
    call(owner, "community", "PATCH", {
      id: note.id,
      action: "withdraw",
      reason: "End of isolated QA test",
    }),
    200,
  );
  await expectStatus(
    call(mod, "community", "PATCH", {
      id: note.id,
      action: "publish",
      imageReviewed: true,
      reason: "Must not revive withdrawn evidence",
    }),
    403,
  );
  await expectStatus(call(null, `community/${note.id}/image`), 404);
  passed("dispute, removal, appeal, correction audit and permanent withdrawal");
  const ticket = (
    await (
      await expectStatus(
        call(owner, "support", "POST", {
          category: "accessibility",
          message: "Synthetic support workflow test.",
        }),
        201,
      )
    ).json()
  ).id;
  await expectStatus(
    call(other, "support", "PATCH", {
      id: ticket,
      status: "resolved",
      response: "Unauthorized resolution",
    }),
    403,
  );
  await expectStatus(
    call(mod, "support", "PATCH", {
      id: ticket,
      status: "under_review",
      response: "Reviewing synthetic test issue",
    }),
    200,
  );
  await expectStatus(
    call(mod, "support", "PATCH", {
      id: ticket,
      status: "resolved",
      response: "Synthetic test issue resolved",
    }),
    200,
  );
  const t = (await (await call(owner, "support")).json()).tickets.find(
    (t) => t.id === ticket,
  );
  assert.equal(t.data.audit.length, 2);
  assert.equal(t.data.status, "resolved");
  await expectStatus(call(other, "support", "DELETE", { id: ticket }), 404);
  await expectStatus(call(owner, "support", "DELETE", { id: ticket }), 200);
  passed("support owner isolation, moderator resolution history and deletion");
  await expectStatus(
    call(owner, "operations", "PATCH", {
      paused: true,
      reason: "Unauthorized pause test",
    }),
    403,
  );
  await expectStatus(
    call(mod, "operations", "PATCH", {
      paused: true,
      reason: "Isolated incident-control QA",
    }),
    200,
  );
  await expectStatus(
    call(owner, "assist", "POST", {
      action: "interpret",
      text: "Machine wash only",
      consent: true,
    }),
    503,
  );
  await expectStatus(
    call(mod, "operations", "PATCH", {
      paused: false,
      reason: "Isolated incident-control QA complete",
    }),
    200,
  );
  const control = (await (await call(mod, "operations")).json()).control;
  assert.equal(control.paused, false);
  assert.equal(control.audit.length, 2);
  passed("moderator incident pause blocks AI and resume is audited");
  const maintenance = await fetch(`${base}/api/internal/maintenance`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  assert(maintenance.ok);
  const cleanup = await maintenance.json();
  assert.equal(cleanup.communityMedia.failed, 0);
  passed("withdrawn media storage cleanup");
} finally {
  for (const u of users) {
    try {
      await call(u, "workspace", "DELETE", undefined, hosted);
    } catch {}
  }
  if (child) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  for (const u of users) await clerk.users.deleteUser(u.id);
  if (sql) await sql.end();
  if (temporary) await rm(temporary, { recursive: true, force: true });
  await writeFile(
    "artifacts/full-qa/role-results.json",
    JSON.stringify(
      {
        environment:
          "isolated local Next app, real Clerk and hosted-screened private Blob media",
        checks,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}
