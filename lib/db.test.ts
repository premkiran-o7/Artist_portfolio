import { describe, it, expect, vi, afterEach } from "vitest";
import type { Mock } from "vitest";
import { neon } from "@neondatabase/serverless";
import { getVideos, getPlaylists, getClients, getComingSoon, resolveThumb } from "./db";
import type { VideoRow } from "./db";

// The page is statically generated, so every getter below runs at *build* time.
// A missing DATABASE_URL, a rejected query, or an empty table must all degrade
// to an empty array — never throw and fail the deploy.
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));

const mockedNeon = neon as unknown as Mock;

const SAMPLE_VIDEO: VideoRow = {
  id: "1",
  title: "Sample",
  category: "short-form",
  youtube_url: "https://youtu.be/dQw4w9WgXcQ",
  youtube_id: "dQw4w9WgXcQ",
  visibility: "public",
  thumb_url: null,
  is_featured: false,
  sort_order: 0,
};

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

afterEach(() => {
  if (ORIGINAL_DATABASE_URL === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  }
  mockedNeon.mockReset();
});

describe("build-time reads never throw", () => {
  it("return [] from every getter when DATABASE_URL is unset", async () => {
    delete process.env.DATABASE_URL;

    await expect(getVideos()).resolves.toEqual([]);
    await expect(getPlaylists()).resolves.toEqual([]);
    await expect(getClients()).resolves.toEqual([]);
    await expect(getComingSoon()).resolves.toEqual([]);

    // The driver must never even be constructed when there's nothing to connect to —
    // neon() throws synchronously on an undefined connection string, so this also
    // proves the guard runs before that call, not just around it.
    expect(mockedNeon).not.toHaveBeenCalled();
  });

  it("return [] when neon() itself throws synchronously on a malformed URL", async () => {
    process.env.DATABASE_URL = "not-a-postgres-url";
    mockedNeon.mockImplementation(() => {
      throw new Error("Database connection string format for `neon()` should be: ...");
    });

    await expect(getVideos()).resolves.toEqual([]);
    await expect(getClients()).resolves.toEqual([]);
  });

  it("return [] when the query rejects (network failure, missing table, etc.)", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@host/db";
    const sqlFn = vi.fn().mockRejectedValue(new Error("fetch failed"));
    mockedNeon.mockReturnValue(sqlFn);

    await expect(getVideos()).resolves.toEqual([]);
    await expect(getPlaylists()).resolves.toEqual([]);
    await expect(getComingSoon()).resolves.toEqual([]);
  });

  it("return [] when the query succeeds but the table is empty", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@host/db";
    const sqlFn = vi.fn().mockResolvedValue([]);
    mockedNeon.mockReturnValue(sqlFn);

    await expect(getClients()).resolves.toEqual([]);
  });
});

describe("build-time reads resolve with driver rows on the happy path", () => {
  it("returns rows exactly as the driver resolves them", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@host/db";
    const rows = [SAMPLE_VIDEO];
    const sqlFn = vi.fn().mockResolvedValue(rows);
    mockedNeon.mockReturnValue(sqlFn);

    await expect(getVideos()).resolves.toEqual(rows);
    expect(mockedNeon).toHaveBeenCalledWith("postgresql://user:pass@host/db");
  });
});

describe("resolveThumb", () => {
  it("prefers Manish's uploaded thumbnail when present", () => {
    const withUpload: VideoRow = { ...SAMPLE_VIDEO, thumb_url: "https://example.com/mine.jpg" };
    expect(resolveThumb(withUpload)).toBe("https://example.com/mine.jpg");
  });

  it("falls back to the YouTube thumbnail when none is uploaded", () => {
    expect(resolveThumb(SAMPLE_VIDEO)).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});
