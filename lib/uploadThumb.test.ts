import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateFile, uploadThumb, MAX_BYTES } from "./uploadThumb";

describe("validateFile", () => {
  it("accepts every content type in the allowlist", () => {
    for (const type of ["video/mp4", "image/jpeg", "image/png", "image/webp"]) {
      expect(validateFile({ type, size: 1024 })).toBeNull();
    }
  });

  it("rejects a content type outside the allowlist", () => {
    expect(validateFile({ type: "image/gif", size: 1024 })).toMatch(/unsupported/i);
  });

  it("rejects an empty file", () => {
    expect(validateFile({ type: "image/jpeg", size: 0 })).toMatch(/empty/i);
  });

  it("accepts a file exactly at the MAX_BYTES boundary", () => {
    expect(validateFile({ type: "image/jpeg", size: MAX_BYTES })).toBeNull();
  });

  it("rejects a file one byte over MAX_BYTES", () => {
    expect(validateFile({ type: "image/jpeg", size: MAX_BYTES + 1 })).toMatch(/20MB/);
  });
});

// Mutation-testing style, matching adminFetch.test.ts: each case below is
// written so that removing the corresponding line in uploadThumb.ts fails it.
describe("uploadThumb", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetch(responses: Response[]) {
    const mock = vi.fn();
    for (const r of responses) mock.mockResolvedValueOnce(r);
    global.fetch = mock;
    return mock;
  }

  function signOk(overrides: Partial<{ uploadUrl: string; publicUrl: string; key: string }> = {}) {
    return new Response(
      JSON.stringify({
        uploadUrl: "https://storage.example.com/bucket/clients/thumbs/abc.jpg?sig=xyz",
        publicUrl: "https://cdn.example.com/clients/thumbs/abc.jpg",
        key: "clients/thumbs/abc.jpg",
        ...overrides,
      }),
      { status: 200 }
    );
  }

  it("rejects an invalid file WITHOUT making any network call", async () => {
    const file = new File(["x"], "bad.gif", { type: "image/gif" });
    const mock = mockFetch([]);
    await expect(uploadThumb(file, "clients")).rejects.toThrow(/unsupported/i);
    expect(mock).not.toHaveBeenCalled();
  });

  it("resolves to the signed publicUrl on the happy path", async () => {
    const file = new File(["x".repeat(100)], "logo.jpg", { type: "image/jpeg" });
    mockFetch([signOk(), new Response(null, { status: 200 })]);
    const url = await uploadThumb(file, "clients");
    expect(url).toBe("https://cdn.example.com/clients/thumbs/abc.jpg");
  });

  it("POSTs to /api/py/uploads/sign with the file's own type/size/category as the first call", async () => {
    const file = new File(["x".repeat(50)], "logo.png", { type: "image/png" });
    const mock = mockFetch([signOk(), new Response(null, { status: 200 })]);
    await uploadThumb(file, "3d-modeling");

    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/py/uploads/sign");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      filename: "logo.png",
      contentType: "image/png",
      category: "3d-modeling",
      sizeBytes: 50,
    });
  });

  it("PUTs the second call straight to uploadUrl, bypassing adminFetch entirely", async () => {
    const file = new File(["x".repeat(10)], "logo.jpg", { type: "image/jpeg" });
    const mock = mockFetch([signOk(), new Response(null, { status: 200 })]);
    await uploadThumb(file, "clients");

    const [url, init] = mock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://storage.example.com/bucket/clients/thumbs/abc.jpg?sig=xyz");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(file);
  });

  it("sets the PUT's Content-Type to exactly the file's type — no drift from what was signed", async () => {
    const file = new File(["x".repeat(10)], "logo.webp", { type: "image/webp" });
    const mock = mockFetch([signOk(), new Response(null, { status: 200 })]);
    await uploadThumb(file, "clients");

    const [, init] = mock.mock.calls[1] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("image/webp");
  });

  it("never attaches adminFetch's credentials/CSRF header to the PUT", async () => {
    const file = new File(["x".repeat(10)], "logo.jpg", { type: "image/jpeg" });
    const mock = mockFetch([signOk(), new Response(null, { status: 200 })]);
    await uploadThumb(file, "clients");

    const [, init] = mock.mock.calls[1] as [string, RequestInit];
    expect(init.credentials).toBe("omit");
    const headers = new Headers(init.headers);
    expect(headers.has("X-Requested-With")).toBe(false);
  });

  it("maps a 401 from /uploads/sign to a session-expired message", async () => {
    const file = new File(["x".repeat(10)], "logo.jpg", { type: "image/jpeg" });
    mockFetch([new Response(null, { status: 401 })]);
    await expect(uploadThumb(file, "clients")).rejects.toThrow(/session/i);
  });

  it("maps a non-401 error status from /uploads/sign to a generic rejection message", async () => {
    const file = new File(["x".repeat(10)], "logo.jpg", { type: "image/jpeg" });
    mockFetch([new Response(null, { status: 422 })]);
    await expect(uploadThumb(file, "clients")).rejects.toThrow(/rejected/i);
  });

  it("maps a network failure on the sign request to a connection message", async () => {
    const file = new File(["x".repeat(10)], "logo.jpg", { type: "image/jpeg" });
    global.fetch = vi.fn().mockRejectedValueOnce(new TypeError("network down"));
    await expect(uploadThumb(file, "clients")).rejects.toThrow(/connection|reach/i);
  });

  it("maps a network failure on the PUT itself to a partway-through message", async () => {
    const file = new File(["x".repeat(10)], "logo.jpg", { type: "image/jpeg" });
    const mock = vi.fn();
    mock.mockResolvedValueOnce(signOk());
    mock.mockRejectedValueOnce(new TypeError("connection reset"));
    global.fetch = mock;
    await expect(uploadThumb(file, "clients")).rejects.toThrow(/partway/i);
  });

  it("maps a non-ok PUT response to a storage-rejected message", async () => {
    const file = new File(["x".repeat(10)], "logo.jpg", { type: "image/jpeg" });
    mockFetch([signOk(), new Response(null, { status: 403 })]);
    await expect(uploadThumb(file, "clients")).rejects.toThrow(/storage/i);
  });
});
