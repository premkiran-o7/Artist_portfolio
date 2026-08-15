import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { adminFetch } from "./adminFetch";

// Mutation-testing style: each assertion below fails if the corresponding line in
// adminFetch.ts is removed. That is the property that matters — the CSRF header
// and credentials mode are the two things the brief calls "the single most
// likely bug in the whole admin panel" if forgotten at a call site.
describe("adminFetch", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () => new Response(null, { status: 200 }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function lastCall() {
    const mock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    return { url, init, headers: new Headers(init.headers) };
  }

  it("targets the fixed /api/py prefix", async () => {
    await adminFetch("/login", { method: "POST" });
    expect(lastCall().url).toBe("/api/py/login");
  });

  it("always sends credentials: include", async () => {
    await adminFetch("/me");
    expect(lastCall().init.credentials).toBe("include");
  });

  it("always sets X-Requested-With, even on a safe GET", async () => {
    await adminFetch("/me", { method: "GET" });
    expect(lastCall().headers.get("X-Requested-With")).toBe("fetch");
  });

  it("sets X-Requested-With on a mutating POST", async () => {
    await adminFetch("/login", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(lastCall().headers.get("X-Requested-With")).toBe("fetch");
  });

  it("defaults to JSON content-type for a string body", async () => {
    await adminFetch("/login", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(lastCall().headers.get("Content-Type")).toBe("application/json");
  });

  it("does not override an explicit Content-Type", async () => {
    await adminFetch("/uploads/sign", {
      method: "POST",
      body: "raw",
      headers: { "Content-Type": "text/plain" },
    });
    expect(lastCall().headers.get("Content-Type")).toBe("text/plain");
  });

  it("passes the method and preserves a non-string body untouched", async () => {
    const form = new FormData();
    await adminFetch("/uploads", { method: "POST", body: form });
    const { init, headers } = lastCall();
    expect(init.method).toBe("POST");
    expect(init.body).toBe(form);
    expect(headers.has("Content-Type")).toBe(false);
  });
});
