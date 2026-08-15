# Manish Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a single-page portfolio for Manish (video editor) with a login-protected admin panel where he adds work himself, running at ₹0/month.

**Architecture:** One repo, one Vercel deploy. Next.js App Router renders the public page statically — it reads Neon Postgres **at build time only**, so visitors never touch a database. FastAPI runs as Vercel Python serverless functions and owns all writes plus R2 upload signing; it serves `/admin` exclusively. Binary files (showreel, photos, thumbnails) go browser → Cloudflare R2 directly via presigned URLs, never through FastAPI.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS 4, Zod, `@neondatabase/serverless`, FastAPI, SQLAlchemy 2 async + asyncpg, PyJWT, argon2-cffi, boto3 (R2), pytest, Vitest, Playwright.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-15-manish-portfolio-design.md`. It governs. Where this plan and the spec disagree, stop and ask.
- **Git commits must NOT contain `Co-Authored-By` or `Claude-Session` trailers.** Message body only.
- **Never commit secrets.** All credentials come from env vars. `.env.local` is gitignored.
- **Vercel serverless request bodies are capped at 4.5MB.** No file ever gets POSTed to FastAPI. Uploads are presigned PUTs direct to R2.
- **Neon must use the pooled connection string** (host contains `-pooler`). With asyncpg behind PgBouncer, `statement_cache_size=0` is **mandatory** or you get `DuplicatePreparedStatementError` at random.
- **Colour ground is `#0B0B0C`** with warm off-white text. Neutral surround is a hard requirement — Manish grades colour and coloured chrome distorts perception of his work.
- **Skill levels are the strings `Expert` | `Advanced` | `Working`.** Never percentages.
- **Categories are exactly:** `color-grade`, `short-form`, `text-tracking`, `3d-modeling`.
- **Video visibility is `public` | `unlisted`.** Never `private` — private videos cannot be embedded.
- **No hover-preview loops.** Static thumbnails only. If you find yourself adding a `loop_url`, stop.
- **Every video element** carries `muted`, `playsInline`, and `loop`. Missing `playsInline` makes iOS hijack the video fullscreen.
- **Accessibility floor:** visible focus rings, alt text on every image, `prefers-reduced-motion` honoured on every animation.
- Python 3.12. Node 20.

---

## File Structure

```
Artist_portfolio/
├── app/
│   ├── layout.tsx                  # fonts, metadata, <html> shell
│   ├── page.tsx                    # the single public page; build-time DB read
│   ├── globals.css                 # design tokens + Tailwind
│   ├── admin/page.tsx              # login form
│   ├── admin/dashboard/page.tsx    # tabbed CRUD UI
│   └── api/revalidate/route.ts     # receives FastAPI's cache-bust ping
├── components/                     # one section per file, presentational
│   ├── SiteHeader.tsx  SiteFooter.tsx
│   ├── Hero.tsx        ShowReel.tsx
│   ├── Timelines.tsx   Skills.tsx
│   ├── CategoryCards.tsx  VideoLightbox.tsx  YouTubeFacade.tsx
│   ├── ClientGrid.tsx  ComingSoon.tsx  Contact.tsx
│   └── admin/VideoForm.tsx  admin/RowList.tsx
├── lib/
│   ├── content.ts                  # Zod schema + typed content.json loader
│   ├── db.ts                       # build-time Neon reads (TypeScript)
│   └── youtube.ts                  # ID parsing + thumbnail URLs (TypeScript)
├── content.json                    # bio, contact, experience, education, skills
├── api/
│   ├── index.py                    # FastAPI app, mounts all routers
│   └── _lib/                       # underscore prefix = not a Vercel function
│       ├── db.py  models.py  auth.py  youtube.py  r2.py  revalidate.py
│       └── routes_videos.py  routes_clients.py  routes_uploads.py
├── tests/                          # pytest
├── migrations/001_init.sql
├── requirements.txt  vercel.json
```

**Why `youtube.ts` and `youtube.py` both exist:** the parser runs in two places — TypeScript at build/admin time for thumbnails, Python at write time to persist `youtube_id`. Task 10 defines one shared test-case table both implementations are tested against, so they cannot drift.

---

## Milestone 1 — Tasks 1–7 produce a complete, deployable static portfolio with no backend. It is genuinely shippable on its own.

---

### Task 1: Scaffold Next.js, design tokens, first deploy

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`, `vercel.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the CSS custom properties `--ground`, `--ink`, `--ink-dim`, `--accent`, `--rule` and the font variables `--font-display`, `--font-body`, `--font-mono`, used by every later component.

- [ ] **Step 1: Scaffold**

```bash
cd /home/ashura/Desktop/Personal/frnd_portfolio/Artist_portfolio
npx create-next-app@latest . --typescript --tailwind --app --eslint \
  --src-dir=false --import-alias "@/*" --turbopack --no-git
```

If it refuses because the directory is non-empty, scaffold into `/tmp/scaffold` and copy everything except `.git`, `LICENSE`, and `docs/` in.

- [ ] **Step 2: Write design tokens**

Replace `app/globals.css`:

```css
@import "tailwindcss";

:root {
  --ground:   #0B0B0C;
  --ink:      #F4F1EC;
  --ink-dim:  #8A8880;
  --accent:   #E8552B;
  --rule:     #24242699;
}

@theme inline {
  --color-ground:  var(--ground);
  --color-ink:     var(--ink);
  --color-ink-dim: var(--ink-dim);
  --color-accent:  var(--accent);
  --font-display:  var(--font-display);
  --font-body:     var(--font-body);
  --font-mono:     var(--font-mono);
}

html { color-scheme: dark; }

body {
  background: var(--ground);
  color: var(--ink);
  font-family: var(--font-body), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Wire fonts and metadata**

`app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-display",
  display: "swap",
});
const body = Geist({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Manish — Video Editor & Motion Designer",
  description: "Colour grading, short-form content and motion graphics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`
Expected: build completes, no type errors. If `axes: ["wdth"]` errors, drop the `axes` line — the width axis is a nice-to-have, not load-bearing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with design tokens and fonts"
```

---

### Task 2: `content.json` and a validated loader

**Files:**
- Create: `content.json`, `lib/content.ts`, `lib/content.test.ts`, `vitest.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `getContent(): Content` and the exported types `Content`, `SkillLevel = "Expert" | "Advanced" | "Working"`, `Experience`, `Education`, `Skill`. Tasks 3, 5, 6, 7 consume `getContent()`.

- [ ] **Step 1: Install Vitest and Zod**

```bash
npm i zod && npm i -D vitest
```

Add to `package.json` scripts: `"test": "vitest run"`.

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { environment: "node" },
});
```

- [ ] **Step 2: Write the failing test**

`lib/content.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ContentSchema, getContent } from "./content";

describe("content", () => {
  it("parses the real content.json", () => {
    const c = getContent();
    expect(c.name).toBe("Manish");
    expect(c.bio).toHaveLength(3);
    expect(c.skills.length).toBeGreaterThan(0);
  });

  it("rejects a percentage skill level", () => {
    const bad = { level: 85, name: "AE", icon: "ae" };
    expect(ContentSchema.shape.skills.safeParse([bad]).success).toBe(false);
  });

  it("rejects a bio that is not exactly three lines", () => {
    const r = ContentSchema.shape.bio.safeParse(["one", "two"]);
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './content'`.

- [ ] **Step 4: Write `content.json`**

Real values where known; Manish fills the rest. Bio must be exactly three lines — the hero layout depends on it.

```json
{
  "name": "Manish",
  "tagline": "Colour · Motion graphics · Short-form",
  "bio": [
    "I cut short-form video and build motion graphics from scratch.",
    "Colour grading, text tracking and storyboarding for brands and creators.",
    "Based in India, working with clients everywhere."
  ],
  "dob": "01.01.2001",
  "phone": "+91 00000 00000",
  "email": "manish@example.com",
  "socials": {
    "instagram": "https://instagram.com/",
    "youtube": "https://youtube.com/",
    "linkedin": "https://linkedin.com/in/"
  },
  "experience": [
    { "from": "2024", "to": "Present", "company": "XXX Company", "role": "Video Editor" }
  ],
  "education": [
    { "from": "2020", "to": "2024", "institution": "XXX", "detail": "Self-taught via YouTube" }
  ],
  "skills": [
    { "name": "DaVinci Resolve", "icon": "davinci",   "level": "Expert" },
    { "name": "After Effects",   "icon": "ae",        "level": "Expert" },
    { "name": "Premiere Pro",    "icon": "premiere",  "level": "Advanced" },
    { "name": "CapCut",          "icon": "capcut",    "level": "Advanced" },
    { "name": "Blender",         "icon": "blender",   "level": "Working" },
    { "name": "Lightroom",       "icon": "lightroom", "level": "Working" },
    { "name": "Canva",           "icon": "canva",     "level": "Advanced" }
  ]
}
```

- [ ] **Step 5: Write the loader**

`lib/content.ts`:

```ts
import { z } from "zod";
import raw from "@/content.json";

export const SkillLevel = z.enum(["Expert", "Advanced", "Working"]);

export const ContentSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().min(1),
  bio: z.array(z.string().min(1)).length(3),
  dob: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  socials: z.object({
    instagram: z.string().url(),
    youtube: z.string().url(),
    linkedin: z.string().url(),
  }),
  experience: z.array(z.object({
    from: z.string(), to: z.string(), company: z.string(), role: z.string(),
  })),
  education: z.array(z.object({
    from: z.string(), to: z.string(), institution: z.string(), detail: z.string(),
  })),
  skills: z.array(z.object({
    name: z.string(), icon: z.string(), level: SkillLevel,
  })).min(1),
});

export type Content    = z.infer<typeof ContentSchema>;
export type Skill      = Content["skills"][number];
export type Experience = Content["experience"][number];
export type Education  = Content["education"][number];

let cached: Content | null = null;

/** Throws at build time if content.json is malformed — a bad edit fails the deploy
 *  rather than shipping a broken page. */
export function getContent(): Content {
  if (!cached) cached = ContentSchema.parse(raw);
  return cached;
}
```

Add `"resolveJsonModule": true` to `tsconfig.json` `compilerOptions` if absent.

- [ ] **Step 6: Run tests, expect pass**

Run: `npm test`
Expected: 3 passed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add content.json with schema-validated loader"
```

---

### Task 3: Section 1 — Hero

**Files:**
- Create: `components/Hero.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getContent()` from Task 2.
- Produces: `<Hero />` (no props — reads content itself).

- [ ] **Step 1: Build the component**

`components/Hero.tsx`. Height is **88vh** so the showreel's top edge peeks into the fold.

```tsx
import Image from "next/image";
import { getContent } from "@/lib/content";

export default function Hero() {
  const c = getContent();
  return (
    <section id="hero" className="min-h-[88vh] flex items-center px-6 md:px-12 pt-24 pb-12">
      <div className="mx-auto w-full max-w-6xl grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center">
        <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl border border-white/10">
          <Image
            src="/profile-placeholder.jpg"
            alt={`Portrait of ${c.name}`}
            fill
            priority
            sizes="(max-width: 768px) 80vw, 33vw"
            className="object-cover"
          />
        </div>

        <div>
          <h1 className="font-[family-name:var(--font-display)] font-semibold tracking-tight leading-[0.95] text-[clamp(3.5rem,9vw,7rem)]">
            {c.name}
          </h1>
          <p className="mt-3 text-[var(--ink-dim)] text-lg">{c.tagline}</p>

          <div className="mt-6 space-y-1.5 text-balance text-[clamp(1rem,1.6vw,1.25rem)] leading-relaxed">
            {c.bio.map((line) => <p key={line}>{line}</p>)}
          </div>

          <dl className="mt-8 border-t border-white/10 pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
            <div><dt className="sr-only">Date of birth</dt><dd>{c.dob}</dd></div>
            <span aria-hidden className="opacity-30">|</span>
            <div><dt className="sr-only">Phone</dt>
              <dd><a className="hover:text-[var(--ink)]" href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a></dd>
            </div>
            <span aria-hidden className="opacity-30">|</span>
            <div><dt className="sr-only">Email</dt>
              <dd><a className="hover:text-[var(--ink)]" href={`mailto:${c.email}`}>{c.email}</a></dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add a placeholder portrait**

Put any 3:4 JPEG at `public/profile-placeholder.jpg` (a solid dark rectangle is fine). Without it `next/image` throws at build.

- [ ] **Step 3: Render it**

`app/page.tsx`:

```tsx
import Hero from "@/components/Hero";
export default function Page() {
  return <main><Hero /></main>;
}
```

- [ ] **Step 4: Verify**

Run: `npm run build && npm run dev`
Check at 375px, 768px and 1440px: name never overflows, the meta row wraps instead of scrolling horizontally, and the section is 88vh so content is visibly cut off at the bottom edge.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add hero section"
```

---

### Task 4: Section 2 — Show Reel with 2-second autoplay

This is the most behaviour-heavy component on the site. Read every step.

**Files:**
- Create: `components/ShowReel.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `<ShowReel src={string} poster={string} youtubeUrl={string} />`. Task 18 keeps this signature when the URL moves to R2.

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";

type Props = { src: string; poster: string; youtubeUrl?: string };

export default function ShowReel({ src, poster, youtubeUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);

  // Start 2s after mount — unless the visitor asked for less motion or less data.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData === true;
    if (reduced || saveData) return;

    const t = setTimeout(() => {
      videoRef.current?.play().then(() => setStarted(true)).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  // Never let it play off-screen — that is pure wasted mobile data.
  useEffect(() => {
    const el = sectionRef.current;
    const v = videoRef.current;
    if (!el || !v) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { if (started) v.play().catch(() => {}); }
        else v.pause();
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [started]);

  return (
    <section ref={sectionRef} id="showreel" className="px-6 md:px-12 py-16 scroll-mt-20">
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            muted={muted}
            loop
            playsInline
            preload="metadata"
            aria-label="Showreel"
            className="h-full w-full object-cover"
          />
          {!started && (
            <button
              onClick={() => videoRef.current?.play().then(() => setStarted(true))}
              className="absolute inset-0 grid place-items-center bg-black/30 focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              aria-label="Play showreel"
            >
              <span className="rounded-full border border-white/40 px-6 py-3 backdrop-blur">Play reel</span>
            </button>
          )}
          <button
            onClick={() => {
              const v = videoRef.current; if (!v) return;
              v.muted = !v.muted; setMuted(v.muted);
            }}
            aria-pressed={!muted}
            className="absolute bottom-4 right-4 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm backdrop-blur hover:border-white/50 focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            {muted ? "🔇 Unmute" : "🔊 Mute"}
          </button>
        </div>
        {youtubeUrl && (
          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer"
             className="mt-4 inline-block font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)] hover:text-[var(--ink)]">
            Watch full reel ↗
          </a>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add placeholder media**

Put any short MP4 at `public/showreel-placeholder.mp4` and a JPEG at `public/showreel-poster.jpg`. Generate them if needed:

```bash
ffmpeg -f lavfi -i color=c=0x141416:s=1280x720:d=5 -c:v libx264 -pix_fmt yuv420p public/showreel-placeholder.mp4
ffmpeg -i public/showreel-placeholder.mp4 -frames:v 1 public/showreel-poster.jpg
```

- [ ] **Step 3: Render it**

In `app/page.tsx`, after `<Hero />`:

```tsx
<ShowReel src="/showreel-placeholder.mp4" poster="/showreel-poster.jpg" />
```

- [ ] **Step 4: Verify all four behaviours by hand**

Run `npm run dev`, then confirm:
1. Poster is visible immediately; playback begins ~2s after load.
2. Scroll it off-screen → playback pauses (check via DevTools: `$0.paused`).
3. DevTools → Rendering → *Emulate prefers-reduced-motion* → reload → it does **not** auto-start, and the "Play reel" button works.
4. Tab to the mute button — a visible focus ring appears; Enter toggles it.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add showreel with delayed muted autoplay"
```

---

### Task 5: Section 3 — Work Experience and Education timelines

**Files:**
- Create: `components/Timelines.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getContent()`, types `Experience` and `Education` from Task 2.
- Produces: `<Timelines />`.

- [ ] **Step 1: Build it**

Two dot-and-rail columns that stack on mobile, exactly as drawn.

```tsx
import { getContent } from "@/lib/content";

function Rail({ title, items }: {
  title: string;
  items: { from: string; to: string; head: string; sub: string }[];
}) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">{title}</h2>
      <ol className="mt-8 relative border-l border-white/15 pl-6 space-y-8">
        {items.map((it) => (
          <li key={`${it.from}-${it.head}`} className="relative">
            <span aria-hidden
              className="absolute -left-[1.65rem] top-2 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
              {it.from} — {it.to}
            </p>
            <p className="mt-1 text-xl">{it.head}</p>
            <p className="text-[var(--ink-dim)]">{it.sub}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Timelines() {
  const c = getContent();
  return (
    <section id="about" className="px-6 md:px-12 py-16 scroll-mt-20">
      <div className="mx-auto grid w-full max-w-6xl gap-14 md:grid-cols-2">
        <Rail title="Work Experience"
          items={c.experience.map((e) => ({ from: e.from, to: e.to, head: e.company, sub: e.role }))} />
        <Rail title="Education"
          items={c.education.map((e) => ({ from: e.from, to: e.to, head: e.institution, sub: e.detail }))} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add the shared scroll-reveal wrapper**

Spec §9 calls for entries fading up 8px on scroll, staggered 60ms. Build it once here;
Task 6 reuses it. `components/Reveal.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";

export default function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-[opacity,transform] duration-500 ease-out ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
      {children}
    </div>
  );
}
```

Reduced-motion visitors get `shown = true` immediately — the content appears, it just does
not animate. Content must never depend on an animation to become visible.

Wrap each `<li>` in `Rail` with `<Reveal delay={index * 60}>`.

- [ ] **Step 3: Render and verify**

Add `<Timelines />` to `app/page.tsx`. Run `npm run build`. At 375px the two rails stack; the dots stay aligned to the rail at every width. Entries fade in as you scroll; with *Emulate prefers-reduced-motion* on, they are simply present.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add work experience and education timelines"
```

---

### Task 6: Section 4 — Software Skills

**Files:**
- Create: `components/Skills.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getContent()`, `Skill` type from Task 2.
- Produces: `<Skills />`.

- [ ] **Step 1: Build it**

Three fixed bar widths — **never** a percentage from data.

```tsx
import { getContent } from "@/lib/content";

const FILL: Record<string, string> = {
  Expert: "100%", Advanced: "72%", Working: "45%",
};

export default function Skills() {
  const c = getContent();
  return (
    <section id="skills" className="px-6 md:px-12 py-16 scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">Software Skills</h2>
        <ul className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {c.skills.map((s) => (
            <li key={s.name} className="rounded-xl border border-white/10 p-5">
              <img src={`/icons/${s.icon}.svg`} alt="" width={40} height={40} className="h-10 w-10" />
              <p className="mt-4 text-sm">{s.name}</p>
              <SkillBar fill={FILL[s.level]} />
              <p className="mt-2 font-[family-name:var(--font-mono)] text-[0.65rem] uppercase tracking-widest text-[var(--ink-dim)]">
                {s.level}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

The icon is `alt=""` because the adjacent text already names the software — a screen reader announcing "DaVinci Resolve DaVinci Resolve" is worse than silence.

- [ ] **Step 2: Build `SkillBar` — the bar fills on scroll-into-view (spec §9)**

`components/SkillBar.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";

export default function SkillBar({ fill }: { fill: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-700 ease-out"
        style={{ width: shown ? fill : "0%" }}
      />
    </div>
  );
}
```

Import it in `Skills.tsx`. Reduced-motion visitors see the final width immediately.

- [ ] **Step 3: Add the icons**

Place seven SVGs in `public/icons/`: `davinci.svg`, `ae.svg`, `premiere.svg`, `capcut.svg`, `blender.svg`, `lightroom.svg`, `canva.svg`. Grab them from Simple Icons:

```bash
mkdir -p public/icons
for i in davinciresolve adobeaftereffects adobepremierepro capcut blender adobelightroom canva; do
  curl -sL "https://cdn.simpleicons.org/$i/F4F1EC" -o "public/icons/$i.svg"
done
```

Then rename to match the `icon` values in `content.json`. If any 404s, use a plain rounded-square placeholder — do not block the task on an icon.

- [ ] **Step 4: Render, verify, commit**

Add `<Skills />` to `app/page.tsx`, run `npm run build`, confirm 7 tiles reflow 2→3→4 across breakpoints and each bar animates from 0 as it scrolls into view.

```bash
git add -A && git commit -m "Add software skills grid with proficiency labels"
```

---

### Task 7: Header, footer, contact — Milestone 1 complete

**Files:**
- Create: `components/SiteHeader.tsx`, `components/SiteFooter.tsx`, `components/Contact.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getContent()`.
- Produces: `<SiteHeader />`, `<SiteFooter />`, `<Contact />`.

- [ ] **Step 1: Contact section**

No form — a large mailto converts better and has zero moving parts.

```tsx
"use client";
import { useState } from "react";
import { getContent } from "@/lib/content";

export default function Contact() {
  const c = getContent();
  const [copied, setCopied] = useState(false);
  return (
    <section id="contact" className="px-6 md:px-12 py-24 scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">Contact</h2>
        <a href={`mailto:${c.email}`}
           className="mt-8 block font-[family-name:var(--font-display)] text-[clamp(1.75rem,6vw,4rem)] leading-tight hover:text-[var(--accent)] break-all">
          {c.email}
        </a>
        <div className="mt-6 flex flex-wrap items-center gap-6 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
          <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:text-[var(--ink)]">{c.phone}</a>
          <button
            onClick={() => { navigator.clipboard.writeText(c.email); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
            {copied ? "Copied ✓" : "Copy email"}
          </button>
          <a href={c.socials.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--ink)]">Instagram</a>
          <a href={c.socials.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--ink)]">YouTube</a>
          <a href={c.socials.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--ink)]">LinkedIn</a>
        </div>
        <p aria-live="polite" className="sr-only">{copied ? "Email copied to clipboard" : ""}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Header and footer**

`components/SiteHeader.tsx` — sticky, name left, jump links right, hidden below `md`:

```tsx
import { getContent } from "@/lib/content";

const LINKS = [
  ["Reel", "#showreel"], ["About", "#about"], ["Skills", "#skills"],
  ["Work", "#work"], ["Clients", "#clients"], ["Contact", "#contact"],
] as const;

export default function SiteHeader() {
  const c = getContent();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[var(--ground)]/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-12">
        <a href="#hero" className="font-[family-name:var(--font-display)] text-lg">{c.name}</a>
        <ul className="hidden gap-6 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)] md:flex">
          {LINKS.map(([label, href]) => (
            <li key={href}><a href={href} className="hover:text-[var(--ink)]">{label}</a></li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
```

`components/SiteFooter.tsx`: a bordered strip with `© {new Date().getFullYear()} {c.name}`.

- [ ] **Step 3: Assemble the page**

```tsx
import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import ShowReel from "@/components/ShowReel";
import Timelines from "@/components/Timelines";
import Skills from "@/components/Skills";
import Contact from "@/components/Contact";
import SiteFooter from "@/components/SiteFooter";

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <ShowReel src="/showreel-placeholder.mp4" poster="/showreel-poster.jpg" />
        <Timelines />
        <Skills />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 4: Deploy**

```bash
npm run build
npx vercel --yes          # link the project, accept defaults
npx vercel --prod
```

Open the production URL on a phone. **Milestone 1 is done: a real, shareable portfolio.**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add header, footer and contact section"
```

---

## Milestone 2 — Tasks 8–14 add the backend. Nothing visible changes for visitors.

---

### Task 8: FastAPI on Vercel + pytest harness

**Files:**
- Create: `api/index.py`, `api/_lib/__init__.py`, `requirements.txt`, `tests/test_health.py`, `pytest.ini`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the FastAPI `app` object in `api/index.py`, mounted at `/api/py/*`. Tasks 11–14 register routers on it.

- [ ] **Step 1: Write the failing test**

`tests/test_health.py`:

```python
from fastapi.testclient import TestClient
from api.index import app

client = TestClient(app)

def test_health_returns_ok():
    r = client.get("/api/py/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install fastapi "uvicorn[standard]" pytest httpx
pytest tests/test_health.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'api.index'`.

- [ ] **Step 3: Create the app**

`api/index.py`:

```python
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))  # make _lib importable on Vercel

from fastapi import FastAPI

app = FastAPI(title="Manish Portfolio API", docs_url=None, redoc_url=None)


@app.get("/api/py/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

Routes carry the full `/api/py` prefix so the paths are identical locally and on Vercel.

Create empty `api/_lib/__init__.py` and `tests/__init__.py`, plus `pytest.ini`:

```ini
[pytest]
pythonpath = .
testpaths = tests
```

`requirements.txt`:

```
fastapi==0.115.6
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
pyjwt==2.10.1
argon2-cffi==23.1.0
boto3==1.35.80
httpx==0.28.1
pydantic==2.10.4
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pytest tests/ -v` → PASS.

- [ ] **Step 5: Wire the Vercel rewrite**

`vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/py/:path*", "destination": "/api/index" }
  ]
}
```

- [ ] **Step 6: Deploy and verify live**

```bash
npx vercel --prod
curl -s https://<your-deployment>/api/py/health
```
Expected: `{"status":"ok"}`. **If this returns Next.js HTML instead, stop and fix the rewrite before continuing** — every later task depends on it.

- [ ] **Step 7: Commit**

```bash
echo ".venv/" >> .gitignore
git add -A && git commit -m "Add FastAPI serverless function with health check"
```

---

### Task 9: Database schema and models

**Files:**
- Create: `migrations/001_init.sql`, `api/_lib/db.py`, `api/_lib/models.py`, `tests/test_models.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `get_session()` async dependency; models `Video`, `Playlist`, `Client`, `ComingSoon`, `LoginAttempt`; enums `Category`, `Visibility`.

- [ ] **Step 1: Write the migration**

`migrations/001_init.sql` — copy verbatim from spec §6.2. Run it against Neon:

```bash
psql "$DATABASE_URL_UNPOOLED" -f migrations/001_init.sql
```

Use the **unpooled** string for DDL; pooled for runtime.

- [ ] **Step 2: Write the failing test**

`tests/test_models.py`:

```python
from api._lib.models import Video, Category, Visibility

def test_category_enum_values():
    assert {c.value for c in Category} == {
        "color-grade", "short-form", "text-tracking", "3d-modeling"
    }

def test_visibility_has_no_private_option():
    # private videos cannot be embedded — see spec §4
    assert {v.value for v in Visibility} == {"public", "unlisted"}

def test_video_defaults_to_unlisted():
    assert Video.__table__.c.visibility.default.arg == Visibility.unlisted
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pytest tests/test_models.py -v` → FAIL, no module `api._lib.models`.

- [ ] **Step 4: Write the models**

`api/_lib/models.py`:

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Category(str, enum.Enum):
    color_grade = "color-grade"
    short_form = "short-form"
    text_tracking = "text-tracking"
    three_d = "3d-modeling"


class Visibility(str, enum.Enum):
    public = "public"
    unlisted = "unlisted"


class Video(Base):
    __tablename__ = "videos"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[Category] = mapped_column(Enum(Category, name="category", values_callable=lambda e: [m.value for m in e]), nullable=False)
    youtube_url: Mapped[str] = mapped_column(String, nullable=False)
    youtube_id: Mapped[str] = mapped_column(String, nullable=False)
    visibility: Mapped[Visibility] = mapped_column(
        Enum(Visibility, name="visibility", values_callable=lambda e: [m.value for m in e]),
        nullable=False, default=Visibility.unlisted,
    )
    thumb_url: Mapped[str | None] = mapped_column(String)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

`values_callable` is required — without it SQLAlchemy sends the Python member *names*
(`color_grade`) instead of the values (`color-grade`) and every insert fails.

Add `Playlist`, `Client`, `ComingSoon`, `LoginAttempt` in the same file, matching spec §6.2 column-for-column.

- [ ] **Step 5: Write the session factory**

`api/_lib/db.py`:

```python
import os
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool


def _url() -> str:
    raw = os.environ["DATABASE_URL"]
    return raw.replace("postgresql://", "postgresql+asyncpg://", 1)


# NullPool: PgBouncer already pools. statement_cache_size=0 is mandatory behind
# PgBouncer in transaction mode, or asyncpg raises DuplicatePreparedStatementError.
engine = create_async_engine(
    _url(), poolclass=NullPool, connect_args={"statement_cache_size": 0}
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
```

- [ ] **Step 6: Run tests, expect pass. Then commit.**

```bash
pytest tests/ -v
git add -A && git commit -m "Add database models and session factory"
```

---

### Task 10: YouTube URL parsing — one spec, two implementations

**Files:**
- Create: `api/_lib/youtube.py`, `lib/youtube.ts`, `tests/test_youtube.py`, `lib/youtube.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: Python `parse_youtube_id(url: str) -> str` (raises `ValueError`); TypeScript `parseYouTubeId(url: string): string | null` and `thumbnailUrl(id: string): string`.

- [ ] **Step 1: Write both failing tests against the same table**

`tests/test_youtube.py`:

```python
import pytest
from api._lib.youtube import parse_youtube_id

CASES = [
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLabc", "dQw4w9WgXcQ"),
    ("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("http://youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
]

@pytest.mark.parametrize("url,expected", CASES)
def test_parses_every_known_url_shape(url, expected):
    assert parse_youtube_id(url) == expected

@pytest.mark.parametrize("bad", [
    "https://vimeo.com/12345", "not a url", "", "https://youtube.com/watch?v=short",
])
def test_rejects_bad_input(bad):
    with pytest.raises(ValueError):
        parse_youtube_id(bad)
```

`lib/youtube.test.ts` mirrors the **same seven cases** and the same four rejections.

- [ ] **Step 2: Run both, watch both fail**

Run: `pytest tests/test_youtube.py -v` and `npm test`. Both FAIL on missing modules.

- [ ] **Step 3: Implement Python**

```python
import re

_PATTERNS = [
    re.compile(r"(?:youtube\.com|youtube-nocookie\.com)/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})"),
    re.compile(r"youtu\.be/([A-Za-z0-9_-]{11})"),
    re.compile(r"youtube\.com/shorts/([A-Za-z0-9_-]{11})"),
    re.compile(r"youtube\.com/embed/([A-Za-z0-9_-]{11})"),
]


def parse_youtube_id(url: str) -> str:
    """Extract the 11-character video ID. Raises ValueError if absent."""
    if not isinstance(url, str) or not url.strip():
        raise ValueError("empty url")
    for pattern in _PATTERNS:
        if match := pattern.search(url):
            return match.group(1)
    raise ValueError(f"not a recognisable YouTube URL: {url!r}")
```

- [ ] **Step 4: Implement TypeScript**

```ts
const PATTERNS = [
  /(?:youtube\.com|youtube-nocookie\.com)\/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
  /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
];

export function parseYouTubeId(url: string): string | null {
  if (!url?.trim()) return null;
  for (const p of PATTERNS) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** hqdefault always exists; maxresdefault 404s on many videos. Do not "upgrade" this. */
export function thumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function embedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
}
```

- [ ] **Step 5: Run both suites, expect pass. Commit.**

```bash
pytest tests/ -v && npm test
git add -A && git commit -m "Add YouTube URL parsing in Python and TypeScript"
```

---

### Task 11: Admin authentication

**Files:**
- Create: `api/_lib/auth.py`, `tests/test_auth.py`
- Modify: `api/index.py`

**Interfaces:**
- Consumes: `get_session` (Task 9).
- Produces: `require_admin` FastAPI dependency; routes `POST /api/py/login`, `POST /api/py/logout`, `GET /api/py/me`. Tasks 12–13 protect every route with `Depends(require_admin)`.

- [ ] **Step 1: Write the failing tests**

`tests/test_auth.py`:

```python
import os
import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient

os.environ.setdefault("ADMIN_USERNAME", "manish")
os.environ.setdefault("ADMIN_PASSWORD_HASH", PasswordHasher().hash("correct-horse"))
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")

from api.index import app  # noqa: E402

client = TestClient(app)


def test_login_with_correct_credentials_sets_httponly_cookie():
    r = client.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert r.status_code == 200
    cookie = r.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie.lower()


def test_login_with_wrong_password_is_rejected():
    r = client.post("/api/py/login", json={"username": "manish", "password": "wrong"})
    assert r.status_code == 401


def test_me_without_cookie_is_rejected():
    fresh = TestClient(app)
    assert fresh.get("/api/py/me").status_code == 401


def test_me_with_cookie_succeeds():
    c = TestClient(app)
    c.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert c.get("/api/py/me").status_code == 200
```

**Every authenticated write from the browser must send `X-Requested-With: fetch`.** Tasks 16
and 17 depend on this — put it in a shared `adminFetch()` wrapper in the admin UI rather
than remembering it at each call site. Add the matching test once Task 12's routes exist:

```python
def test_write_without_csrf_header_is_rejected(admin_client_no_csrf):
    r = admin_client_no_csrf.post("/api/py/videos", json={
        "title": "X", "category": "short-form",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ"})
    assert r.status_code == 403
```

- [ ] **Step 2: Run and watch fail**

Run: `pip install argon2-cffi pyjwt && pytest tests/test_auth.py -v` → FAIL (404s).

- [ ] **Step 3: Implement**

`api/_lib/auth.py`:

```python
import os
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

COOKIE_NAME = "manish_admin"
TOKEN_DAYS = 7
_hasher = PasswordHasher()
router = APIRouter()


class LoginBody(BaseModel):
    username: str
    password: str


def _issue_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")


async def require_admin(request: Request) -> str:
    """Gate for every mutating route. Returns the admin username."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(401, "not authenticated")
    try:
        claims = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid session")

    # CSRF defence (spec §8). SameSite=Lax already blocks cross-site POSTs in modern
    # browsers, but a custom header cannot be set by a plain cross-origin <form>, so
    # requiring one closes the gap for anything Lax misses. Safe methods are exempt.
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        if request.headers.get("x-requested-with") != "fetch":
            raise HTTPException(403, "missing X-Requested-With header")

    return claims["sub"]


@router.post("/api/py/login")
async def login(body: LoginBody, response: Response) -> dict[str, bool]:
    if body.username != os.environ["ADMIN_USERNAME"]:
        raise HTTPException(401, "invalid credentials")
    try:
        _hasher.verify(os.environ["ADMIN_PASSWORD_HASH"], body.password)
    except VerifyMismatchError:
        raise HTTPException(401, "invalid credentials")

    response.set_cookie(
        COOKIE_NAME, _issue_token(body.username),
        httponly=True, secure=True, samesite="lax",
        max_age=TOKEN_DAYS * 86400, path="/",
    )
    return {"ok": True}


@router.post("/api/py/logout")
async def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/api/py/me")
async def me(username: str = Depends(require_admin)) -> dict[str, str]:
    return {"username": username}
```

Register it in `api/index.py`:

```python
from _lib.auth import router as auth_router
app.include_router(auth_router)
```

- [ ] **Step 4: Run tests, expect 4 passed.**

- [ ] **Step 5: Generate the real password hash and set env vars**

```bash
python -c "from argon2 import PasswordHasher; print(PasswordHasher().hash('<manish-real-password>'))"
npx vercel env add ADMIN_USERNAME production
npx vercel env add ADMIN_PASSWORD_HASH production
npx vercel env add JWT_SECRET production   # openssl rand -hex 32
npx vercel env add DATABASE_URL production # Neon POOLED string
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add single-admin JWT authentication"
```

> **Deferred from spec §8:** IP lockout via the `login_attempts` table is **Task 12, Step 6**. The table exists from Task 9; nothing here writes to it yet.

---

### Task 12: Video, playlist, client and coming-soon CRUD

**Files:**
- Create: `api/_lib/routes_videos.py`, `api/_lib/routes_clients.py`, `tests/test_videos.py`
- Modify: `api/index.py`, `api/_lib/auth.py`

**Interfaces:**
- Consumes: `require_admin`, `get_session`, `parse_youtube_id`, models.
- Produces: `GET/POST/PATCH/DELETE /api/py/videos`, `PUT /api/py/playlists/{category}`, `GET/POST/PATCH/DELETE /api/py/clients`, `GET/POST/PATCH /api/py/coming-soon`.

- [ ] **Step 1: Write failing tests**

`tests/test_videos.py` — cover, at minimum:

```python
def test_create_video_requires_auth(client_no_cookie):
    r = client_no_cookie.post("/api/py/videos", json={
        "title": "Test", "category": "color-grade",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ",
    })
    assert r.status_code == 401


def test_create_video_derives_youtube_id(admin_client):
    r = admin_client.post("/api/py/videos", json={
        "title": "Grade reel", "category": "color-grade",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ",
    })
    assert r.status_code == 201
    assert r.json()["youtube_id"] == "dQw4w9WgXcQ"


def test_create_video_defaults_to_unlisted(admin_client):
    r = admin_client.post("/api/py/videos", json={
        "title": "X", "category": "short-form",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ",
    })
    assert r.json()["visibility"] == "unlisted"


def test_rejects_private_visibility(admin_client):
    r = admin_client.post("/api/py/videos", json={
        "title": "X", "category": "short-form",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ", "visibility": "private",
    })
    assert r.status_code == 422


def test_rejects_unparseable_url(admin_client):
    r = admin_client.post("/api/py/videos", json={
        "title": "X", "category": "short-form", "youtube_url": "https://vimeo.com/1",
    })
    assert r.status_code == 422


def test_setting_featured_clears_the_previous_one_in_that_category(admin_client):
    a = admin_client.post("/api/py/videos", json={"title": "A", "category": "color-grade",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ", "is_featured": True}).json()
    b = admin_client.post("/api/py/videos", json={"title": "B", "category": "color-grade",
        "youtube_url": "https://youtu.be/oHg5SJYRHA0", "is_featured": True}).json()
    listed = admin_client.get("/api/py/videos?category=color-grade").json()
    featured = [v for v in listed if v["is_featured"]]
    assert len(featured) == 1 and featured[0]["id"] == b["id"]
```

Add fixtures `admin_client` and `client_no_cookie` in `tests/conftest.py`, plus a session-scoped fixture that truncates the tables between tests.

- [ ] **Step 2: Run, watch fail.** `pytest tests/test_videos.py -v`

- [ ] **Step 3: Implement `routes_videos.py`**

Pydantic request model — note `visibility` is typed as the `Visibility` enum, which is
what makes `"private"` return 422 automatically:

```python
class VideoIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: Category
    youtube_url: str
    visibility: Visibility = Visibility.unlisted
    thumb_url: str | None = None
    is_featured: bool = False
    sort_order: int = 0

    @field_validator("youtube_url")
    @classmethod
    def _must_parse(cls, v: str) -> str:
        parse_youtube_id(v)  # raises ValueError → FastAPI returns 422
        return v
```

On create/update: derive `youtube_id` via `parse_youtube_id`; if `is_featured` is true, first
`UPDATE videos SET is_featured = false WHERE category = :category` in the same transaction.
`GET /api/py/videos` accepts an optional `?category=` filter and orders by `sort_order, created_at`.

- [ ] **Step 4: Run tests, expect pass.**

- [ ] **Step 5: Implement `routes_clients.py`** — plain CRUD for `clients` and `coming_soon`, plus `PUT /api/py/playlists/{category}` upserting one row. Every route `Depends(require_admin)` except the `GET`s.

- [ ] **Step 6: Add login lockout**

In `auth.py`, on failed login: upsert `login_attempts` for `request.client.host`, increment
`failures`; at 10, set `locked_until = now() + 15 minutes`. On any login attempt, reject with
429 if `locked_until > now()`. On success, delete the row. Test:

```python
def test_locks_out_after_ten_failures(client_no_cookie):
    for _ in range(10):
        client_no_cookie.post("/api/py/login", json={"username": "manish", "password": "x"})
    r = client_no_cookie.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert r.status_code == 429
```

- [ ] **Step 7: Commit**

```bash
pytest tests/ -v
git add -A && git commit -m "Add CRUD routes for videos, clients and coming-soon"
```

---

### Task 13: R2 presigned uploads

**Files:**
- Create: `api/_lib/r2.py`, `api/_lib/routes_uploads.py`, `tests/test_uploads.py`
- Modify: `api/index.py`

**Interfaces:**
- Consumes: `require_admin` (Task 11).
- Produces: `POST /api/py/uploads/sign` → `{"uploadUrl": str, "publicUrl": str, "key": str}`.

**Note:** the upload `category` field is a **wider set** than the `Category` enum — it also
accepts `clients`, `showreel` and `profile`. Validate it against the `FOLDERS` dict below,
not against `Category`, or uploading the showreel and the portrait becomes impossible.

- [ ] **Step 1: Write failing tests**

```python
ALLOWED = ["video/mp4", "image/jpeg", "image/png", "image/webp"]

def test_sign_requires_auth(client_no_cookie):
    assert client_no_cookie.post("/api/py/uploads/sign", json={
        "filename": "a.jpg", "contentType": "image/jpeg",
        "category": "color-grade", "sizeBytes": 1000}).status_code == 401

def test_rejects_disallowed_mime(admin_client):
    r = admin_client.post("/api/py/uploads/sign", json={
        "filename": "x.svg", "contentType": "image/svg+xml",
        "category": "color-grade", "sizeBytes": 1000})
    assert r.status_code == 422

def test_rejects_oversize(admin_client):
    r = admin_client.post("/api/py/uploads/sign", json={
        "filename": "big.mp4", "contentType": "video/mp4",
        "category": "showreel", "sizeBytes": 21_000_000})
    assert r.status_code == 422

def test_key_is_derived_from_category_not_client_input(admin_client):
    r = admin_client.post("/api/py/uploads/sign", json={
        "filename": "../../evil.jpg", "contentType": "image/jpeg",
        "category": "color-grade", "sizeBytes": 1000})
    assert r.status_code == 200
    assert r.json()["key"].startswith("color-grade/thumbs/")
    assert ".." not in r.json()["key"]
```

- [ ] **Step 2: Run, watch fail.**

- [ ] **Step 3: Implement `r2.py`**

```python
import os
import boto3
from botocore.config import Config

_client = None


def client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )
    return _client


def presign_put(key: str, content_type: str, expires: int = 300) -> str:
    return client().generate_presigned_url(
        "put_object",
        Params={"Bucket": os.environ["R2_BUCKET"], "Key": key, "ContentType": content_type},
        ExpiresIn=expires,
    )


def public_url(key: str) -> str:
    return f"{os.environ['R2_PUBLIC_BASE'].rstrip('/')}/{key}"
```

- [ ] **Step 4: Implement `routes_uploads.py`**

The key is built server-side from an enum-validated `category` plus a fresh UUID. The
client's `filename` contributes **only** a sanitised extension — never a path.

```python
MAX_BYTES = 20 * 1024 * 1024
ALLOWED = {"video/mp4": ".mp4", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
FOLDERS = {
    "color-grade": "color-grade/thumbs", "short-form": "short-form/thumbs",
    "text-tracking": "text-tracking/thumbs", "3d-modeling": "3d-modeling/thumbs",
    "clients": "clients/thumbs", "showreel": "showreel", "profile": "profile",
}
```

Validate `contentType in ALLOWED`, `sizeBytes <= MAX_BYTES`, `category in FOLDERS`; then
`key = f"{FOLDERS[category]}/{uuid4().hex}{ALLOWED[content_type]}"`.

- [ ] **Step 5: Run tests, expect pass.**

- [ ] **Step 6: Create the bucket and CORS**

Create bucket `manish-portfolio` in Cloudflare R2. Under Settings → CORS, allow `PUT` from
your Vercel domain and `http://localhost:3000`, `AllowedHeaders: ["content-type"]`. **Without
this the browser's PUT is blocked and the admin upload fails with an opaque network error.**
Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE`
in Vercel env.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "Add R2 presigned upload signing"
```

---

### Task 14: Build-time DB reads and the revalidation webhook

**Files:**
- Create: `lib/db.ts`, `app/api/revalidate/route.ts`, `api/_lib/revalidate.py`
- Modify: `app/page.tsx`, `api/_lib/routes_videos.py`, `api/_lib/routes_clients.py`

**Interfaces:**
- Consumes: `parseYouTubeId`, `thumbnailUrl` (Task 10).
- Produces: `getVideos()`, `getPlaylists()`, `getClients()`, `getComingSoon()` — all async, called from server components. Tasks 18–20 consume these.

- [ ] **Step 1: Install the driver**

```bash
npm i @neondatabase/serverless
```

- [ ] **Step 2: Write `lib/db.ts`**

```ts
import { neon } from "@neondatabase/serverless";
import { thumbnailUrl } from "./youtube";

export type VideoRow = {
  id: string; title: string; category: string;
  youtube_url: string; youtube_id: string; visibility: string;
  thumb_url: string | null; is_featured: boolean; sort_order: number;
};

const sql = () => neon(process.env.DATABASE_URL!);

/** Thumbnail precedence: Manish's upload wins; otherwise YouTube's own. */
export function resolveThumb(v: VideoRow): string {
  return v.thumb_url ?? thumbnailUrl(v.youtube_id);
}

export async function getVideos(): Promise<VideoRow[]> {
  return (await sql()`
    SELECT id::text, title, category::text, youtube_url, youtube_id,
           visibility::text, thumb_url, is_featured, sort_order
    FROM videos ORDER BY sort_order ASC, created_at DESC
  `) as VideoRow[];
}
```

Add `getPlaylists()`, `getClients()`, `getComingSoon()` in the same shape.

**If `DATABASE_URL` is unset at build time, every function must return `[]` rather than
throw** — a missing env var should not break the whole site build. Add that guard.

- [ ] **Step 3: Set the page to ISR**

In `app/page.tsx`:

```tsx
export const revalidate = 3600; // hourly backstop if the webhook ever fails
```

- [ ] **Step 4: Write the Next.js revalidation route**

`app/api/revalidate/route.ts`:

```ts
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidatePath("/");
  return NextResponse.json({ revalidated: true, at: Date.now() });
}
```

- [ ] **Step 5: Call it from FastAPI after every write**

`api/_lib/revalidate.py`:

```python
import os
import httpx


async def bust_cache() -> None:
    """Fire-and-forget. A failed revalidation must never fail the admin's save —
    the hourly ISR backstop will catch it."""
    base = os.environ.get("SITE_URL")
    secret = os.environ.get("REVALIDATE_SECRET")
    if not base or not secret:
        return
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            await c.post(f"{base}/api/revalidate", headers={"x-revalidate-secret": secret})
    except httpx.HTTPError:
        pass
```

Call `await bust_cache()` at the end of every POST/PATCH/DELETE handler.

- [ ] **Step 6: Test the guard**

```python
async def test_bust_cache_is_silent_without_env(monkeypatch):
    monkeypatch.delenv("SITE_URL", raising=False)
    await bust_cache()  # must not raise
```

- [ ] **Step 7: Set env and commit**

```bash
npx vercel env add REVALIDATE_SECRET production   # openssl rand -hex 32
npx vercel env add SITE_URL production            # https://<domain>
git add -A && git commit -m "Add build-time DB reads and cache revalidation"
```

---

## Milestone 3 — Tasks 15–19 add the admin panel and the database-driven sections.

---

### Task 15: Admin login page

**Files:** Create `app/admin/page.tsx`, `middleware.ts`

**Interfaces:** Consumes `POST /api/py/login`. Produces the `/admin` route; on success redirects to `/admin/dashboard`.

- [ ] **Step 1: Build the login form** — a client component posting `{username, password}` to `/api/py/login` with `credentials: "include"`, showing the error text on 401 and a distinct "Too many attempts, try again in 15 minutes" on 429.
- [ ] **Step 2: Add `middleware.ts`** redirecting `/admin/dashboard` to `/admin` when the `manish_admin` cookie is absent. This is UX only — the real gate is `require_admin` on the API, which the middleware cannot replace.
- [ ] **Step 3: Add `export const metadata = { robots: { index: false, follow: false } }`** to both admin pages so the login never lands in Google.
- [ ] **Step 4: Verify** wrong password shows an error, correct one lands on the dashboard, and visiting `/admin/dashboard` logged out bounces to `/admin`.
- [ ] **Step 5: Commit** — `git commit -m "Add admin login page"`

---

### Task 16: Admin dashboard — videos tab

**Files:** Create `app/admin/dashboard/page.tsx`, `components/admin/VideoForm.tsx`, `components/admin/RowList.tsx`

**Interfaces:** Consumes every route from Tasks 12–13 and `parseYouTubeId`/`thumbnailUrl` from Task 10.

- [ ] **Step 1: Build `VideoForm`** with fields: YouTube URL, title, category select, visibility radio (public/unlisted — **no private option**), optional thumbnail file input, featured checkbox.
- [ ] **Step 2: Add paste-to-autofill.** On URL blur, run `parseYouTubeId`; if it returns an ID, immediately set the thumbnail preview from `thumbnailUrl(id)` and attempt a title fetch:

```ts
const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
if (r.ok) setTitle((await r.json()).title);
// Unlisted videos may 401/404 here — that is expected, not an error.
// The thumbnail always works because it is derived from the ID, not from oEmbed.
```

Never surface a failed oEmbed as an error; just leave the title for Manish to type.

- [ ] **Step 3: Wire the upload.** On submit with a file: `POST /api/py/uploads/sign` → `PUT` the file directly to `uploadUrl` with `Content-Type` matching exactly what was signed → send the returned `publicUrl` as `thumb_url` in the video POST. Show upload progress; a 30s clip on a slow connection is not instant.
- [ ] **Step 4: Build `RowList`** — table of existing videos with inline delete (confirm first), a featured toggle, and up/down arrows adjusting `sort_order`. Arrows, not drag-and-drop: drag is fiddly on touch and this list will have a handful of rows.
- [ ] **Step 5: Verify end to end** — add a real video, confirm the row appears, then confirm it appears on the public site within a few seconds (revalidation).
- [ ] **Step 6: Commit** — `git commit -m "Add admin dashboard videos tab"`

---

### Task 17: Admin dashboard — clients, playlists, coming-soon tabs

**Files:** Modify `app/admin/dashboard/page.tsx`; add tab components.

- [ ] **Step 1: Clients tab** — name, Instagram URL (validate it is an `instagram.com` URL), thumbnail upload via the same signing flow, reorder, delete.
- [ ] **Step 2: Playlists tab** — four rows, one per category, each with a single YouTube playlist URL field saved via `PUT /api/py/playlists/{category}`.
- [ ] **Step 3: Coming-soon tab** — title, blurb, thumbnail, and the `is_live` toggle. Label the toggle plainly: *"Live — show this in the main work grid."*
- [ ] **Step 4: Verify** each tab round-trips and triggers revalidation.
- [ ] **Step 5: Commit** — `git commit -m "Add clients, playlists and coming-soon admin tabs"`

---

### Task 18: Section 5 — Category cards, lightbox, YouTube facade

**Files:** Create `components/CategoryCards.tsx`, `components/VideoLightbox.tsx`, `components/YouTubeFacade.tsx`; modify `app/page.tsx`

**Interfaces:** Consumes `getVideos()`, `getPlaylists()`, `resolveThumb()` (Task 14) and `embedUrl()` (Task 10).

- [ ] **Step 1: Build `YouTubeFacade`** — renders a thumbnail plus a play button; **only on click** does it swap in the real `<iframe>` with `embedUrl(id)`. This is the whole point: YouTube's ~1MB of JS is never loaded until someone chooses to watch.

```tsx
"use client";
import { useState } from "react";
import { embedUrl } from "@/lib/youtube";

export default function YouTubeFacade({ id, thumb, title }: { id: string; thumb: string; title: string }) {
  const [active, setActive] = useState(false);
  if (active) {
    return (
      <iframe
        className="absolute inset-0 h-full w-full"
        src={embedUrl(id)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <button onClick={() => setActive(true)} className="group absolute inset-0" aria-label={`Play ${title}`}>
      <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
      <span className="absolute inset-0 grid place-items-center bg-black/30 group-hover:bg-black/20">
        <span className="rounded-full border border-white/50 px-5 py-2.5 backdrop-blur">▶ Play</span>
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Build `CategoryCards`** — three cards (`color-grade`, `short-form`, `text-tracking`) matching the wireframe: media area showing the category's `is_featured` thumbnail (falling back to the lowest `sort_order` video), title, a rule, and a **Full Playlist** link below it. Clicking the card body opens the lightbox; clicking "Full Playlist" opens the YouTube playlist in a new tab. Stop propagation on the playlist link so it does not also open the lightbox.
- [ ] **Step 3: Build `VideoLightbox`** — a `<dialog>` listing that category's videos as a grid of facades. Must: close on Escape, trap focus while open, restore focus to the triggering card on close, and lock body scroll.
- [ ] **Step 4: Handle the empty state.** A category with zero videos renders the card with a muted "Coming soon" plate instead of a broken image, and the card is not clickable.
- [ ] **Step 5: Verify** in DevTools Network that no `youtube.com` request fires until a facade is clicked.
- [ ] **Step 6: Commit** — `git commit -m "Add category cards with lightbox and YouTube facade"`

---

### Task 19: Sections 6 and 7 — client grid and coming soon

**Files:** Create `components/ClientGrid.tsx`, `components/ComingSoon.tsx`; modify `app/page.tsx`

- [ ] **Step 1: `ClientGrid`** — cards with uploaded thumbnail, client name, Instagram glyph; the whole card is one `<a target="_blank" rel="noopener noreferrer">` to the post. **No Instagram embed script anywhere.**
- [ ] **Step 2: `ComingSoon`** — the "3D Modeling" card with dashed border, reduced opacity and a "Working on it" pill, plus the **View** button from the wireframe. Rows with `is_live = true` are excluded here (they belong in the main grid instead).
- [ ] **Step 3: Empty states** — if there are no clients, omit the whole section rather than rendering an empty heading.
- [ ] **Step 4: Verify** section order matches the wireframe numbering: Hero, ShowReel, Timelines, Skills, CategoryCards, ClientGrid, ComingSoon, Contact.
- [ ] **Step 5: Commit** — `git commit -m "Add client grid and coming-soon sections"`

---

### Task 20: Performance, accessibility and launch

**Files:** Modify components as findings require. Create `e2e/smoke.spec.ts`.

- [ ] **Step 1: Playwright smoke test**

```bash
npm i -D @playwright/test && npx playwright install chromium
```

Assert: all eight sections render; the showreel is playing ~3s after load; **zero requests to `youtube.com` before any click**; `/admin/dashboard` redirects to `/admin` when logged out.

- [ ] **Step 2: Lighthouse on the production URL, mobile preset.** Record LCP and CLS. Targets from spec §11: LCP < 2.0s, CLS = 0.
- [ ] **Step 3: Fix what it finds.** The likely culprits, in order: the hero portrait missing `priority`, the showreel MP4 lacking `preload="metadata"`, and unsized images causing shift. Give every `<img>` explicit `width`/`height` or an aspect-ratio container.
- [ ] **Step 4: Keyboard pass.** Tab through the entire page. Every interactive element must show a visible focus ring; the lightbox must trap focus and return it on close.
- [ ] **Step 5: Verify the JS budget.** `npm run build` and check the First Load JS for `/` is under 120KB.
- [ ] **Step 6: Final content pass** — replace every placeholder in `content.json` with Manish's real details, swap in his real portrait and the real 30s showreel, and confirm the showreel is watermarked (spec §14).
- [ ] **Step 7: Commit and ship**

```bash
git add -A && git commit -m "Performance and accessibility pass"
npx vercel --prod
```

---

## Deferred / explicitly not built

These are recorded so nobody adds them by accident:

- Hover-preview loops on cards (rejected in brainstorming).
- Contact form (a mailto link is the decision).
- Percentage skill bars (labels replaced them).
- Instagram embeds (links only).
- Multi-user accounts, signup, password reset.
- Custom domain on the R2 bucket — **revisit before real traffic**, since `r2.dev` is
  rate-limited and not intended for production (spec §14).
