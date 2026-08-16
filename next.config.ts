import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // *** DO NOT REMOVE without re-testing /_next/image ON A REAL DEPLOY. ***
    //
    // In production /_next/image?url=%2Fportrait.jpg 404s — and it 404s with
    // THIS APP'S OWN HTML 404 page, not the image optimizer's plain-text error,
    // which proves the request reaches the Next.js server function rather than
    // Vercel's optimizer. The hero portrait — the LCP element, and the one
    // photo of Manish on the page — was simply missing in production.
    //
    // Cause: vercel.json's catch-all `{"source": "/(.*)", "destination":
    // {"service": "web"}}`. Requests for /_next/static/* survive it because
    // they are real files resolved in the filesystem phase, which runs first;
    // /_next/image is a ROUTE, so the catch-all claims it and forwards it to
    // the Next.js server, which on Vercel does not carry the image handler
    // (the platform normally serves that route itself).
    //
    // `unoptimized` sidesteps the route entirely: next/image emits the raw
    // src, and /portrait.jpg is a plain static file that already returns 200.
    // The cost is near zero here — there is exactly ONE next/image in the whole
    // public site (Hero's portrait), and it is already a hand-tuned 92KB
    // progressive JPEG. `priority` still emits its preload link.
    //
    // The narrower fix is to stop the catch-all shadowing the route, e.g.
    // `"source": "/((?!_next/).*)"`, and then drop this flag. That could not be
    // verified from here: it is a platform-routing change, only observable on a
    // deploy, and this task was scoped to commit without deploying. Try it, and
    // confirm /_next/image returns an image before removing `unoptimized`.
    unoptimized: true,
  },

  // Local-dev-only convenience. In production, vercel.json's `services` rewrite
  // routes /api/py/* to the FastAPI service at the Vercel platform level, before
  // the request ever reaches this Next.js app — so this branch never fires
  // there regardless of NODE_ENV, and is a no-op in `next build`/`next start`.
  // `next dev` has no equivalent to that platform routing, so without this,
  // admin pages have nothing to talk to on localhost. Points at a FastAPI
  // instance run locally with `uvicorn index:app --port 8000` from api/.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [{ source: "/api/py/:path*", destination: "http://127.0.0.1:8000/api/py/:path*" }];
  },
};

export default nextConfig;
