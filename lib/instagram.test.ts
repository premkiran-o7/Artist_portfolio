import { describe, it, expect } from "vitest";
import { isInstagramUrl } from "./instagram";

describe("isInstagramUrl", () => {
  it("accepts a plain https instagram.com URL", () => {
    expect(isInstagramUrl("https://instagram.com/someclient")).toBe(true);
  });

  it("accepts www.instagram.com", () => {
    expect(isInstagramUrl("https://www.instagram.com/someclient/")).toBe(true);
  });

  it("accepts http (not just https)", () => {
    expect(isInstagramUrl("http://instagram.com/someclient")).toBe(true);
  });

  it("accepts a reels/post path and query string", () => {
    expect(isInstagramUrl("https://www.instagram.com/reel/Cabc123/?utm_source=ig")).toBe(true);
  });

  it("rejects a non-Instagram URL", () => {
    expect(isInstagramUrl("https://youtube.com/someclient")).toBe(false);
  });

  it("rejects a host that merely contains the string instagram.com", () => {
    expect(isInstagramUrl("https://evilinstagram.com/someclient")).toBe(false);
  });

  it("rejects instagram.com used as a query param on another host", () => {
    expect(isInstagramUrl("https://evil.example/?redirect=instagram.com")).toBe(false);
  });

  it("rejects instagram.com as a subdomain-suffix trick on another host", () => {
    expect(isInstagramUrl("https://instagram.com.evil.example/someclient")).toBe(false);
  });

  it("rejects a bare handle with no protocol", () => {
    expect(isInstagramUrl("instagram.com/someclient")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isInstagramUrl("")).toBe(false);
  });

  it("rejects a non-http(s) protocol", () => {
    expect(isInstagramUrl("javascript:alert(1)//instagram.com")).toBe(false);
  });
});
