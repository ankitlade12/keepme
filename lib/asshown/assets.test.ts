import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  change: vi.fn(),
  del: vi.fn(),
}));
vi.mock("./records", () => ({
  listRecords: mocks.list,
  changeRecord: mocks.change,
}));
vi.mock("../object-store", () => ({ deleteArtifacts: mocks.del }));
import {
  ownedAsset,
  revokeAsset,
  cleanupPrivateAssets,
  renewAsset,
} from "./assets";
const artifact = {
  key: "private",
  contentType: "image/png",
  size: 10,
  sha256: "hash",
};
const row = {
  id: "asset-1",
  owner: "alice",
  category: "asset",
  revision: 1,
  expires: null,
  data: { original: artifact, processing: artifact },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockImplementation(async (_category, owner) =>
    owner === "bob" ? [] : [row],
  );
  mocks.change.mockImplementation(async (_id, _owner, _category, update) => ({
    ...row,
    data: update(row),
  }));
  mocks.del.mockResolvedValue([{ verifiedAbsent: true }]);
});
describe("private evidence access and deletion", () => {
  it("uses an owner-scoped lookup and hides other accounts", async () => {
    expect(await ownedAsset("bob", "asset-1")).toBeNull();
    expect(mocks.list).toHaveBeenCalledWith("asset", "bob");
  });
  it("hides revoked evidence even before physical deletion", async () => {
    mocks.list.mockResolvedValue([
      { ...row, data: { ...row.data, revokedAt: "now" } },
    ]);
    expect(await ownedAsset("alice", "asset-1")).toBeNull();
  });
  it("revokes access before attempting storage deletion", async () => {
    mocks.del.mockRejectedValue(new Error("storage offline"));
    await expect(revokeAsset(row)).rejects.toThrow();
    expect(mocks.change.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.del.mock.invocationCallOrder[0],
    );
  });
  it("retries pending deletion during maintenance", async () => {
    mocks.list.mockResolvedValue([
      { ...row, data: { ...row.data, revokedAt: "now" } },
    ]);
    expect(await cleanupPrivateAssets()).toEqual({ completed: 1, failed: 0 });
  });
});

it("hides expired private evidence before cleanup runs", async () => {
  mocks.list.mockResolvedValue([
    { ...row, data: { ...row.data, expiresAt: "2000-01-01T00:00:00Z" } },
  ]);
  expect(await ownedAsset("alice", "asset-1")).toBeNull();
});

it("does not erase a deletion tombstone when renewal races with deletion", async () => {
  const revoked = { ...row, data: { ...row.data, revokedAt: "now" } };
  mocks.change.mockImplementation(async (_id, _owner, _category, update) =>
    update(revoked),
  );
  await expect(renewAsset("alice", "asset-1")).rejects.toThrow(
    "no longer available",
  );
  expect(revoked.data.revokedAt).toBe("now");
});
