import { describe, it, expect, vi, afterEach } from "vitest";
import type { Mock } from "vitest";
import { neon } from "@neondatabase/serverless";
import { getVideos, getPlaylists, getClients, getComingSoon, getPhotos, resolveThumb } from "./db";
import type { VideoRow, PhotoRow } from "./db";

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

const SAMPLE_PHOTO: PhotoRow = {
  id: "1",
  title: "Sushi Board",
  category: "3d-modeling",
  image_url: "https://example.com/sushi.jpg",
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
    await expect(getPhotos()).resolves.toEqual([]);

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
    await expect(getPhotos()).resolves.toEqual([]);
  });

  it("return [] when the query rejects (network failure, missing table, etc.)", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@host/db";
    const sqlFn = vi.fn().mockRejectedValue(new Error("fetch failed"));
    mockedNeon.mockReturnValue(sqlFn);

    await expect(getVideos()).resolves.toEqual([]);
    await expect(getPlaylists()).resolves.toEqual([]);
    await expect(getComingSoon()).resolves.toEqual([]);
    await expect(getPhotos()).resolves.toEqual([]);
  });

  it("return [] when the query succeeds but the table is empty", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@host/db";
    const sqlFn = vi.fn().mockResolvedValue([]);
    mockedNeon.mockReturnValue(sqlFn);

    await expect(getClients()).resolves.toEqual([]);
    await expect(getPhotos()).resolves.toEqual([]);
  });
});

// Swallowing the error is the contract; swallowing it SILENTLY is the bug.
// A failing query and an empty table both render an empty section, and before
// this there was no way to tell them apart — a schema drift or a typo blanked a
// whole section of the live site with completely clean build output.
describe("a swallowed failure still leaves a trace", () => {
  it("names the failing getter on stderr when the query rejects", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@host/db";
    mockedNeon.mockReturnValue(vi.fn().mockRejectedValue(new Error("relation \"videos\" does not exist")));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getVideos()).resolves.toEqual([]);

    expect(spy).toHaveBeenCalledTimes(1);
    // The label is the point: a bare driver stack trace does not say which
    // query died, and all four getters fail identically.
    const [message, cause] = spy.mock.calls[0];
    expect(String(message)).toContain("getVideos");
    expect((cause as Error).message).toContain("does not exist");
    spy.mockRestore();
  });

  it("uses a distinct label per getter", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@host/db";
    mockedNeon.mockReturnValue(vi.fn().mockRejectedValue(new Error("boom")));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await getVideos();
    await getPlaylists();
    await getClients();
    await getComingSoon();
    await getPhotos();

    const labels = spy.mock.calls.map((c) => String(c[0]));
    expect(labels.some((l) => l.includes("getVideos"))).toBe(true);
    expect(labels.some((l) => l.includes("getPlaylists"))).toBe(true);
    expect(labels.some((l) => l.includes("getClients"))).toBe(true);
    expect(labels.some((l) => l.includes("getComingSoon"))).toBe(true);
    expect(labels.some((l) => l.includes("getPhotos"))).toBe(true);
    // Five distinct labels, not one label reused — this is what fails if a
    // copy-paste gives two getters the same name.
    expect(new Set(labels).size).toBe(5);
    spy.mockRestore();
  });

  it("stays silent on the legitimate empty-table and no-DATABASE_URL paths", async () => {
    // Otherwise the signal is worthless: a site with genuinely empty tables —
    // which is production today — would log on every single build.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    delete process.env.DATABASE_URL;
    await getVideos();

    process.env.DATABASE_URL = "postgresql://user:pass@host/db";
    mockedNeon.mockReturnValue(vi.fn().mockResolvedValue([]));
    await getClients();
    await getPhotos();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
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

  it("returns photo rows exactly as the driver resolves them", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@host/db";
    const rows = [SAMPLE_PHOTO];
    const sqlFn = vi.fn().mockResolvedValue(rows);
    mockedNeon.mockReturnValue(sqlFn);

    await expect(getPhotos()).resolves.toEqual(rows);
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

  it("treats an empty-string thumb_url as absent (falls back to YouTube)", () => {
    // The PATCH endpoints silently ignore an explicit `null` (see
    // api/_lib/routes_videos.py), so "" is the only value the admin dashboard
    // can send to clear a thumbnail. `??` would treat "" as present and skip
    // the fallback, rendering a broken image — this is the regression test
    // for switching resolveThumb from `??` to `||`.
    const cleared: VideoRow = { ...SAMPLE_VIDEO, thumb_url: "" };
    expect(resolveThumb(cleared)).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});
