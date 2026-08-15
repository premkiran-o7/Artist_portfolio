import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/**
 * Hit by `bust_cache()` (api/_lib/revalidate.py) after every admin write. Also
 * safe to call manually. `export const revalidate = 3600` on the page is the
 * backstop if this webhook is ever unreachable or misconfigured.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidatePath("/");
  return NextResponse.json({ revalidated: true, at: Date.now() });
}
