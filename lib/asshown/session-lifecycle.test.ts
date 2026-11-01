import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../database", () => ({
  database: () => null,
  ensureDatabase: async () => {},
}));
import {
  createSession,
  reserveGeneration,
  revokeSession,
  updateSession,
  getSession,
  deleteSession,
} from "../session-store";
describe("generation lifecycle", () => {
  it("only reserves one of two concurrent paid requests", async () => {
    const s = await createSession({
      tenantId: "test",
      accessTokenDigest: "test",
    });
    const results = await Promise.all([
      reserveGeneration(s.id, "a", 2),
      reserveGeneration(s.id, "b", 2),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await getSession(s.id))?.providerTaskCount).toBe(1);
  });
  it("cannot resurrect a session after access revocation", async () => {
    const s = await createSession({
      tenantId: "test",
      accessTokenDigest: "test",
    });
    await revokeSession(s.id);
    expect(await getSession(s.id)).toBeNull();
    expect(await updateSession(s.id, { stage: "result" })).toBeNull();
    expect(await deleteSession(s.id)).toBe(true);
  });
  it("keeps unknown submissions reserved", async () => {
    const s = await createSession({
      tenantId: "test",
      accessTokenDigest: "test",
    });
    await reserveGeneration(s.id, "unknown", 2);
    expect(await reserveGeneration(s.id, "retry", 2)).toBeNull();
  });
});
