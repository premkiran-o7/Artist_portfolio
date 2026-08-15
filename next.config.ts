import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
