import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  change: vi.fn(),
  list: vi.fn(),
  head: vi.fn(),
  read: vi.fn(),
  del: vi.fn(),
}));
vi.mock("./records", () => ({ changeRecord: m.change, listRecords: m.list }));
vi.mock("@vercel/blob", () => ({ head: m.head }));
vi.mock("../object-store", () => ({
  readArtifact: m.read,
  deleteArtifacts: m.del,
}));
import {
  claimUpload,
  stagedFile,
  cleanupStagedUploads,
  type UploadIntent,
} from "./staged-upload";
const intent: UploadIntent = {
  key: "quarantine/test",
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  input: {},
};
beforeEach(() => {
  vi.clearAllMocks();
  m.del.mockResolvedValue([{ verifiedAbsent: true }]);
});
it("claims uploads atomically under the authenticated owner", async () => {
  m.change.mockImplementation(async (_id, _owner, _category, update) => ({
    data: update({ category: "upload-intent", data: intent }),
  }));
  expect((await claimUpload("alice", "id")).claimed).toBe(true);
  expect(m.change.mock.calls[0].slice(0, 3)).toEqual([
    "id",
    "alice",
    "upload-intent",
  ]);
});
it.each([
  { ...intent, claimed: true },
  { ...intent, revokedAt: "now" },
  { ...intent, expiresAt: "2000-01-01T00:00:00Z" },
])("refuses replayed or expired uploads", async (data) => {
  m.change.mockImplementation(async (_i, _o, _c, update) => ({
    data: update({ category: "upload-intent", data }),
  }));
  await expect(claimUpload("alice", "id")).rejects.toThrow();
});
it("rejects oversized stored content before downloading it", async () => {
  m.head.mockResolvedValue({
    size: 11 * 1024 * 1024,
    contentType: "image/png",
  });
  await expect(stagedFile(intent)).rejects.toThrow();
  expect(m.read).not.toHaveBeenCalled();
});
it("keeps quarantine cleanup records until the upload token has expired", async () => {
  m.list.mockResolvedValue([{ id: "id", owner: "alice", data: intent }]);
  expect(await cleanupStagedUploads()).toEqual({ completed: 0, failed: 0 });
  expect(m.del).not.toHaveBeenCalled();
});
it("retains cleanup records when deletion is not verified", async () => {
  m.list.mockResolvedValue([
    {
      id: "id",
      owner: "alice",
      data: { ...intent, expiresAt: "2000-01-01T00:00:00Z" },
    },
  ]);
  m.del.mockResolvedValue([{ verifiedAbsent: false }]);
  expect(await cleanupStagedUploads()).toEqual({ completed: 0, failed: 1 });
  expect(m.change).not.toHaveBeenCalled();
});
