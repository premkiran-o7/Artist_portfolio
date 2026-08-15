import { describe, it, expect } from "vitest";
import { parseYouTubeId, thumbnailUrl, embedUrl } from "./youtube";

// Shared table — must mirror tests/test_youtube.py CASES exactly. If you add a
// case to one, add it to the other.
const CASES: [string, string][] = [
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLabc", "dQw4w9WgXcQ"],
  ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ["http://youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
];

// Shared table — must mirror tests/test_youtube.py's bad-input list exactly.
const BAD_INPUTS: string[] = [
  "https://vimeo.com/12345", "not a url", "", "https://youtube.com/watch?v=short",
];

describe("parseYouTubeId", () => {
  it.each(CASES)("parses %s", (url, expected) => {
    expect(parseYouTubeId(url)).toBe(expected);
  });

  it.each(BAD_INPUTS)("returns null for %s", (bad) => {
    expect(parseYouTubeId(bad)).toBeNull();
  });
});

describe("thumbnailUrl", () => {
  it("uses hqdefault, not maxresdefault", () => {
    const url = thumbnailUrl("dQw4w9WgXcQ");
    expect(url).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(url).not.toContain("maxresdefault");
  });
});

describe("embedUrl", () => {
  it("uses the youtube-nocookie privacy domain with rel=0", () => {
    const url = embedUrl("dQw4w9WgXcQ");
    expect(url).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&modestbranding=1"
    );
    expect(url).toContain("youtube-nocookie.com");
    expect(url).toContain("rel=0");
  });
});
