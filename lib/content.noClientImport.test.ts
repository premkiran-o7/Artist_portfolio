import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Bundle guard: no `"use client"` module may import a build-time-only module.
 *
 * This exists because of a real regression, not a hypothetical one.
 * components/Contact.tsx was marked `"use client"` so that one clipboard
 * button could hold state, and it also called `getContent()`. lib/content.ts
 * imports zod at module scope, so that single import pulled zod + content.json
 * into the browser bundle: a 305KB raw / ~72KB gzipped chunk, the largest
 * asset on a site whose whole First Load JS budget is 120KB, doing nothing
 * whatsoever at runtime — the schema only validates content.json at build
 * time. It went unnoticed for the entire build because nothing rendered
 * differently; the only symptom was the byte count.
 *
 * lib/db.ts is guarded for the same reason from the other direction: it
 * executes `neon()` from @neondatabase/serverless at module scope, so a client
 * import would ship a database driver to visitors. lib/categories.ts documents
 * that hazard in prose and dodges it with `import type`; prose does not fail a
 * build, so this does.
 *
 * Deliberately a source-text check rather than a bundle-size assertion: it
 * names the offending file and the fix, it cannot flake on a bundler version
 * bump, and it fails at the moment the import is written instead of whenever
 * someone next thinks to weigh the chunks.
 *
 * `import type { X } from "@/lib/db"` is correctly ALLOWED — TypeScript erases
 * it and emits no JS import, which is precisely the technique lib/categories.ts
 * relies on.
 */

const ROOT = join(import.meta.dirname, "..");
const SEARCH_DIRS = ["app", "components", "lib"];

/** Modules that must never be reachable from browser code. */
const BUILD_TIME_ONLY = ["@/lib/content", "@/lib/db", "./content", "./db", "zod", "@neondatabase/serverless"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const sourceFiles = SEARCH_DIRS.flatMap((d) => walk(join(ROOT, d)));

/** True when the file's own first non-trivial statement is the directive. */
function isClientModule(src: string): boolean {
  return /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*|\n)*["']use client["']/.test(src);
}

/**
 * Value imports only. Matches `import x from "m"` / `import {a} from "m"` /
 * `import "m"` but NOT `import type { A } from "m"`, and not a mention of the
 * specifier inside a comment (which every file here has plenty of).
 */
function valueImports(src: string): string[] {
  const found: string[] = [];
  const re = /^[ \t]*import\s+(?!type\s)(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) found.push(m[1]);
  return found;
}

describe("client bundle guard", () => {
  it("finds the source files it is supposed to be scanning", () => {
    // Without this, a bad ROOT or a renamed directory would silently reduce the
    // suite below to a vacuous pass over an empty list.
    expect(sourceFiles.length).toBeGreaterThan(20);
    expect(sourceFiles.some((f) => f.endsWith("Contact.tsx"))).toBe(true);
    expect(sourceFiles.filter((f) => isClientModule(readFileSync(f, "utf8"))).length).toBeGreaterThan(5);
  });

  it("no \"use client\" module imports zod, lib/content or lib/db at runtime", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const src = readFileSync(file, "utf8");
      if (!isClientModule(src)) continue;
      for (const spec of valueImports(src)) {
        if (BUILD_TIME_ONLY.includes(spec)) {
          offenders.push(`${relative(ROOT, file)} imports "${spec}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("recognises a client directive that sits under a licence comment", () => {
    // Guards the detector itself: if isClientModule stopped matching, the test
    // above would pass by scanning nothing.
    expect(isClientModule('"use client";\nimport x from "y";')).toBe(true);
    expect(isClientModule("// leading comment\n'use client'\n")).toBe(true);
    expect(isClientModule('/* block */\n"use client"\n')).toBe(true);
    expect(isClientModule('import x from "y";\n"use client";')).toBe(false);
  });

  it("distinguishes value imports from type-only imports", () => {
    // The whole guard hinges on this: `import type` is free, a value import is not.
    expect(valueImports('import { z } from "zod";')).toContain("zod");
    expect(valueImports('import raw from "@/content.json";')).toContain("@/content.json");
    expect(valueImports('import "@/lib/db";')).toContain("@/lib/db");
    expect(valueImports('import type { VideoRow } from "./db";')).not.toContain("./db");
    expect(valueImports('// import { z } from "zod";')).not.toContain("zod");
  });
});
