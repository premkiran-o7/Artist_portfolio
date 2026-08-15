# Manish — Video Editor Portfolio: Design Spec

**Date:** 2026-08-15
**Repo:** `premkiran-o7/Artist_portfolio`
**Status:** Approved design, ready for implementation planning

---

## 1. Goal

A single-page portfolio for Manish, a video editor / motion designer, built from his
hand-drawn wireframes (8 sections). He must be able to add new work himself through a
login-protected admin panel without touching code. Total running cost: ₹0/month.

## 2. Constraints

- **Zero monthly cost.** Free tiers only. A custom domain (~₹800/yr) is optional.
- **Owner is a Python/FastAPI developer.** The backend is FastAPI by explicit choice.
- **Manish is not technical.** Adding a video must be: log in → paste URL → pick category → save.
- **Video is the product.** Page must load fast on Indian mobile networks; a client tapping
  the link on 4G is the primary visitor.

## 3. Non-goals (explicitly out of scope)

- Multi-user accounts, signup, password reset. **One seeded admin, hardcoded.**
- Contact form. A large mailto link converts better and has no moving parts.
- Video transcoding. YouTube does it; we never touch a video pipeline.
- DRM / anti-piracy beyond watermarking. Not achievable at any realistic budget.
- Hover-preview loops on cards. Considered and **rejected** — added export work for Manish
  for a marginal gain. Static thumbnails only.
- Full CMS over bio/experience/skills. Those live in `content.json`.

---

## 4. Key decisions and rationale

| Decision | Choice | Why |
|---|---|---|
| Video hosting | **Unlisted YouTube + one self-hosted hero clip** | YouTube is free, unlimited, adaptive-streaming, CDN-backed, and never throttles. Google Drive was rejected: it throttles popular files ("too many recent views"), shows a download button, exposes Google's player chrome, and has no adaptive streaming. |
| Video privacy | **Per-video toggle: public or unlisted** | Private videos *cannot be embedded* — they show "Video unavailable" to all visitors. Unlisted is invisible to YouTube search/channel/recommendations but embeds fine. Public is left available per-video because discoverability is a freelancer's marketing channel. Manish decides per upload. |
| Backend | **FastAPI on Vercel Python serverless functions** | Owner's language. Avoids Render's ~50s cold starts (spin-down) — serverless cold start is ~1s with no sleep state. Ships in the same repo and same deploy as the frontend. |
| Database | **Neon Postgres (free tier)** | Auto-suspends when idle but resumes in <1s transparently. Rejected Supabase free: pauses after 7 days of inactivity and requires a **manual** dashboard restore — a guaranteed failure mode for a low-traffic portfolio. |
| File storage | **Cloudflare R2** | 10GB free and, critically, **zero egress fees**. Every other free tier meters bandwidth, which is exactly what a media-heavy portfolio produces. |
| Frontend | **Next.js (App Router) + TypeScript + Tailwind** | Static generation for the public site; good SEO so clients can find him by name. |
| Rendering | **Public pages statically generated; no DB call on page load** | Two payoffs: instant loads from CDN edge, and the site survives database downtime. FastAPI exists only to serve `/admin`. |

---

## 5. Architecture

```
                 ┌──────────────── ONE GitHub repo, ONE Vercel deploy ─────────────┐
                 │                                                                 │
  Visitor ──────►│  Next.js  (statically generated — no DB call on page load)       │
                 │      ▲                                                          │
                 │      │ on-demand revalidation webhook when Manish saves          │
                 │      │                                                          │
  Manish ───────►│  /admin  ──► FastAPI  (Python serverless functions)              │
   (login)       │              ├── JWT in httpOnly cookie, one seeded admin        │
                 │              ├── CRUD: videos, playlists, clients, coming_soon   │
                 │              └── presigns R2 uploads                             │
                 └──────────────┬─────────────────────┬───────────────────────────┘
                                │                     │
                          Neon Postgres         Cloudflare R2
                        (lists Manish edits)  (clip, photos, thumbnails)
```

**Three stores, three jobs, no overlap:**

- `content.json` (in repo) — text that changes roughly never. Edited by the owner.
- **Neon Postgres** — the lists Manish edits through the admin panel.
- **Cloudflare R2** — the binary files Manish uploads.

### Data freshness — how "static" stays current

The public page queries Neon **once, at build time**, and the resulting video/client lists are
baked into the HTML. The section-5 lightbox therefore reads from data already in the page —
it does not fetch. When Manish saves in `/admin`, FastAPI issues a server-to-server
`POST /api/revalidate` to Next.js with a shared `REVALIDATE_SECRET`; Next.js calls
`revalidatePath('/')` and regenerates the page. This is cache invalidation, not a full
redeploy, so the live site reflects the change within a few seconds. If that call fails, an
ISR `revalidate: 3600` backstop means the page self-heals within the hour.

### Vercel wiring

- `api/index.py` exposes the FastAPI ASGI app on Vercel's Python runtime.
- `vercel.json` rewrites `/api/py/:path*` → `/api/index` so Next.js and FastAPI coexist.
- Neon's **pooled** connection string is mandatory — serverless invocations would otherwise
  exhaust Postgres connections.

---

## 6. Data model

### 6.1 `content.json` — committed to the repo

```jsonc
{
  "name": "Manish",
  "tagline": "Motion graphics · Colour · Short-form",
  "bio": ["line one", "line two", "line three"],
  "dob": "…", "phone": "…", "email": "…",
  "socials": { "instagram": "…", "youtube": "…", "linkedin": "…" },
  "experience": [{ "from": "2024", "to": "Present", "company": "…", "role": "…" }],
  "education":  [{ "from": "…", "to": "…", "institution": "…", "detail": "…" }],
  "skills": [
    { "name": "DaVinci Resolve", "icon": "davinci",   "level": "Expert" },
    { "name": "After Effects",   "icon": "ae",        "level": "Expert" },
    { "name": "Premiere Pro",    "icon": "premiere",  "level": "Advanced" },
    { "name": "Blender",         "icon": "blender",   "level": "Working" },
    { "name": "CapCut",          "icon": "capcut",    "level": "Advanced" },
    { "name": "Lightroom",       "icon": "lightroom", "level": "Working" },
    { "name": "Canva",           "icon": "canva",     "level": "Advanced" }
  ]
}
```

`level` is one of `Expert | Advanced | Working` — **not a percentage**. Percentage skill bars
are unfalsifiable ("what is 85% Premiere?") and read as filler; the bar still renders at three
fixed fill widths, so the visual from the reference is preserved.

### 6.2 Postgres schema

```sql
CREATE TYPE category   AS ENUM ('color-grade','short-form','text-tracking','3d-modeling');
CREATE TYPE visibility AS ENUM ('public','unlisted');

CREATE TABLE videos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  category    category NOT NULL,
  youtube_url text NOT NULL,
  youtube_id  text NOT NULL,          -- parsed on save
  visibility  visibility NOT NULL DEFAULT 'unlisted',
  thumb_url   text,                   -- R2 URL; falls back to YouTube's thumbnail
  is_featured boolean NOT NULL DEFAULT false,   -- this video's thumbnail becomes the
                                                -- category card cover in section 5.
                                                -- Exactly one per category; setting a new
                                                -- one clears the previous. If none is set,
                                                -- the lowest sort_order video is used.
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON videos (category, sort_order);

CREATE TABLE playlists (              -- the three "Full Playlist" links
  category             category PRIMARY KEY,
  youtube_playlist_url text NOT NULL
);

CREATE TABLE clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  instagram_url text NOT NULL,
  thumb_url     text,
  sort_order    integer NOT NULL DEFAULT 0
);

CREATE TABLE coming_soon (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,           -- e.g. "3D Modeling"
  blurb      text,
  thumb_url  text,
  is_live    boolean NOT NULL DEFAULT false   -- flip to promote into the main grid
);

CREATE TABLE login_attempts (         -- serverless has no shared memory; lockout needs a table
  ip           text PRIMARY KEY,
  failures     integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);
```

### 6.3 R2 bucket layout

Mirrors the categories from the wireframe. The admin panel derives the path from the
category dropdown — Manish never types a path.

```
r2://manish-portfolio/
├── showreel/
│   ├── showreel-30s.mp4       ← the hero clip, target ≤8MB
│   └── showreel-poster.jpg
├── profile/manish.jpg
├── color-grade/thumbs/
├── short-form/thumbs/
├── text-tracking/thumbs/
├── 3d-modeling/thumbs/
└── clients/thumbs/
```

---

## 7. Upload flow — presigned URLs

**Vercel serverless functions cap request bodies at 4.5MB.** The 30s showreel is 5–8MB, so
uploading *through* FastAPI fails with an opaque 413. Files therefore go browser → R2 directly:

```
Browser                       FastAPI                      R2
   ├─ POST /api/py/uploads/sign ──►│  verify admin JWT
   │   {filename, contentType,     │  validate MIME + size
   │    category}                  │  build key from category
   │◄── {uploadUrl, publicUrl} ────┤  sign 5-minute PUT
   ├─ PUT file direct to R2 ───────────────────────────────►│
   ├─ POST /api/py/videos ────────►│  persist publicUrl, revalidate site
```

Server-side validation on signing: MIME must be in an allowlist (`video/mp4`, `image/jpeg`,
`image/png`, `image/webp`), declared size under 20MB, key derived from the enum category —
never from client input.

---

## 8. Auth

- **One admin.** Credentials from env: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` (Argon2id),
  `JWT_SECRET`. No signup route, no user table, no password reset.
- JWT in an **httpOnly, Secure, SameSite=Lax** cookie, 7-day expiry.
- Mutations additionally require a custom header (`X-Requested-With`) so a cross-site form
  post cannot ride the cookie.
- Lockout: 10 failed attempts from an IP → locked 15 minutes, tracked in `login_attempts`
  because serverless functions share no memory.
- Every route except `POST /login` sits behind one FastAPI dependency.

---

## 9. Public site — section by section

Numbering follows Manish's wireframes.

**1 + 2 — Hero with the show reel as its background.** *(Amended 2026-08-15 — see Decision
Revision below. Manish's wireframe drew these as two sections; they are now one.)*

Full-viewport (`100vh`, `100dvh` on mobile). The 30-second reel plays **full-bleed behind
everything**, under a dark scrim heavy enough to hold text contrast (target ≥ 4.5:1 against
`--ink`). Over it: the portrait as a smaller card, the name at `clamp(3.5rem, 9vw, 7rem)`,
three bio lines, a hairline rule, then `DOB · Phone · Email` in monospace with vertical
dividers. A sound toggle and "Watch full reel ↗" sit in a corner of the hero.

Poster image is the LCP element and loads immediately; the video begins at **2 seconds —
muted, looping, `playsinline`** (required, or iOS forces fullscreen). `IntersectionObserver`
pauses playback once the hero scrolls away. Honours `prefers-reduced-motion` and
`navigator.connection.saveData` by holding on the poster with a play button instead.

> **Decision revision (2026-08-15).** The original design put the reel in its own section
> below an 88vh hero, so its top edge would "peek" into the fold and the motion would invite a
> scroll. Browser instrumentation during Task 4 proved this never fires: at 1440×1100 only
> ~68px of the video card was visible — 17.7%, below the `0.25` observer threshold — and on
> mobile the stacked hero overflows 88vh so **0%** peeked. The reel started and was paused 9ms
> later, on every realistic viewport. The client's headline request ("a clip that starts
> playing 2 seconds after someone visits") was therefore not delivered by the specified
> design. Making the reel the hero background removes the visibility precondition entirely.
> Cost, accepted knowingly: it departs from Manish's wireframe and his portrait loses
> prominence. The standalone 16:9 section is dropped rather than showing the same 30 seconds
> twice in a row.

**3 — Work Experience + Education.** Two dot-and-rail vertical timelines side by side,
stacking on mobile. Entries fade up 8px on scroll, staggered 60ms. Source: `content.json`.

**4 — Software Skills.** 4-then-3 grid of tiles: brand SVG icon, name, and a bar that fills to
one of three fixed widths on scroll-into-view, labelled Expert / Advanced / Working.

**5 — Category cards.** Three cards — Colour Grade, Short Form Content, Text Tracking — each
with a media area, title, rule, and a **Full Playlist** link beneath, exactly as drawn.
Behaviour: static thumbnail at rest (the category's `is_featured` video) → click the card
opens an in-page lightbox listing that category's videos → clicking a video loads the
YouTube iframe behind a
**facade** (custom thumbnail + play button), so YouTube's ~1MB of JS is only paid for on
demand. "Full Playlist" links out to the real YouTube playlist from the `playlists` table.

**6 — Client work.** Grid of cards: uploaded thumbnail, client name, Instagram glyph, opening
the post in a new tab. **No Instagram embeds** — the wireframe says "links", and Instagram
embeds cannot autoplay, carry Meta's chrome, are heavy, and break when the embed API changes.

**7 — Coming Soon.** The "3D Modeling" card with a **View** button, deliberately styled
unfinished: dashed border, reduced opacity, "Working on it" pill. Setting `is_live` promotes
it into the main category grid.

**8 — Contact.** Email set large with copy-to-clipboard, phone, and social links. No form.

Plus a sticky minimal header (name + jump links) and a footer.

---

## 10. Art direction

**Near-black `#0B0B0C` ground, warm off-white type, one accent sampled from the showreel.**
This is a working constraint, not a taste call: Manish grades colour, and coloured chrome
around a video contaminates perception of the grade inside it — the same reason grading suites
are painted neutral grey.

- **Display:** Archivo Expanded (name, section headers).
- **Body:** Geist Sans.
- **Meta rows:** monospace — the detail that makes the hero read like the reference card.
- **Motion:** scroll reveals only. A motion designer's site should demonstrate restraint;
  showing off every easing curve reads as a student reel.

Reference note: the resume image supplied was used **only** for the two circled elements — the
hero card and the software-skills grid. Its pastel/scrapbook styling is not being copied.

---

## 11. Quality targets

- LCP < 2.0s on simulated 4G; **zero** cumulative layout shift.
- < 120KB JS on the public page (before any YouTube iframe is requested).
- Keyboard-reachable sound toggle; visible focus rings; alt text on every thumbnail;
  `prefers-reduced-motion` honoured throughout.
- Semantic landmarks so screen readers can jump between the eight sections.

## 12. Testing

- **pytest** for FastAPI: auth (success, failure, lockout), each CRUD route's authorised and
  unauthorised paths, YouTube URL/ID parsing across URL shapes (`watch?v=`, `youtu.be`,
  `/shorts/`, with extra params), presign MIME/size rejection, revalidation trigger.
- **Vitest** for pure frontend logic: thumbnail fallback, category grouping.
- **Playwright** smoke: page renders all 8 sections; showreel starts within ~2s; lightbox
  opens and loads the iframe only after click; admin login redirects correctly.

---

## 13. Cost

| Piece | Free tier | Where it actually breaks |
|---|---|---|
| Vercel (site + FastAPI) | 100GB bandwidth/mo | Hobby is licensed non-commercial. A portfolio is universally tolerated; adding checkout/payments is not. |
| Neon Postgres | 0.5GB | Thousands of rows away. Suspends idle, resumes <1s. |
| Cloudflare R2 | 10GB, **no egress fees** | ~1000 thumbnails plus the clip. |
| YouTube | Unlimited | Never. |

**Total: ₹0/month.** Domain optional at ~₹800/year.

## 14. Risks

| Risk | Mitigation |
|---|---|
| R2's `r2.dev` public URL is rate-limited and not intended for production traffic. | Attach a custom domain to the bucket once a domain is bought. Acceptable at launch traffic; revisit before promoting the site. |
| Vercel Hobby non-commercial licensing. | Portfolio-only is fine. If Manish adds paid packages/checkout, move to Cloudflare Pages or Vercel Pro. |
| The self-hosted showreel MP4 is the most copyable asset on the site (URL is in page source). | Burn a name/logo watermark into the export. Real DRM is unavailable at this budget; watermarking makes a stolen copy useless as someone else's portfolio. |
| Manish uploads a 4K export as the "30s clip" and destroys mobile load times. | Hard server-side size cap at signing time, plus a clear admin hint stating the ≤8MB target. |
| Neon free tier idles/suspends. | Public pages are static and never query it. Only `/admin` would see the <1s resume. |

## 15. Deliverable order

1. Next.js scaffold, art direction, `content.json`, sections 1–4 and 8 (static only).
2. Section 2 showreel behaviour (2s autoplay, muted, reduced-motion fallbacks).
3. FastAPI + Neon: schema, auth, CRUD, tests.
4. R2 presigned uploads.
5. `/admin` UI.
6. Sections 5–7 wired to the database, YouTube facade, lightbox.
7. Revalidation webhook, performance and accessibility pass.
