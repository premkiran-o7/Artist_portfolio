import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getContent } from "@/lib/content";

/**
 * The link preview card — 1200x630, the size every platform expects.
 *
 * This is the highest-traffic surface on the whole site and the least
 * obvious one. Manish's portfolio is shared as a LINK: pasted into WhatsApp,
 * an Instagram DM, his Instagram bio, a LinkedIn message, an email to a
 * client. Before this file existed the page had no og:image at all, so every
 * one of those shares rendered as a grey box with a URL under it — for someone
 * whose entire pitch is that he makes things look good.
 *
 * Generated rather than committed as a static JPEG so it cannot drift: it
 * reads the same content.json the hero does, so when his name, role or bio
 * change, the card changes with them. It is prerendered at build time (the
 * route has no dynamic data), so this costs a visitor nothing at runtime.
 *
 * Composition mirrors the hero deliberately — portrait on the left, name and
 * role on the right, the same near-black ground and single warm accent — so a
 * preview and the page it opens read as the same object.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const content = getContent();

// Used as the og:image alt text. A real description, not "og image": screen
// reader users on Slack/Twitter/LinkedIn hear this in place of the card.
export const alt = `${content.name} — ${content.tagline}`;

export default async function OpenGraphImage() {
  // Read at BUILD time (this route prerenders), so neither file needs to be
  // reachable from a running function.
  const [archivo, portrait] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Archivo-SemiBold.ttf")),
    readFile(join(process.cwd(), "public/portrait.jpg")),
  ]);

  // Satori has no filesystem and no next/image — the portrait has to arrive
  // inline, as bytes.
  const portraitSrc = `data:image/jpeg;base64,${portrait.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          // The hero's own no-reel backdrop gradient, so the card and the page
          // it links to share a ground rather than merely both being dark.
          backgroundImage: "linear-gradient(to bottom, #141416, #0B0B0C 55%, #000000)",
          color: "#F4F1EC",
        }}
      >
        <div style={{ display: "flex", width: 430, height: "100%", overflow: "hidden" }}>
          <img
            src={portraitSrc}
            width={430}
            height={630}
            alt=""
            style={{ width: 430, height: 630, objectFit: "cover", objectPosition: "center 25%" }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            padding: "0 72px",
          }}
        >
          {/* The site's one accent, used here exactly as it is used there:
              sparingly, as a mark rather than as decoration. */}
          <div style={{ display: "flex", width: 72, height: 6, backgroundColor: "#E8552B" }} />

          <div
            style={{
              fontFamily: "Archivo",
              fontSize: 82,
              lineHeight: 1.02,
              letterSpacing: -2,
              marginTop: 34,
              // Explicit wrap point: "Manish Ravalkol" breaking wherever the
              // column happens to run out is how the hero looks on mobile, and
              // it is not what this card should do.
              display: "flex",
              flexDirection: "column",
            }}
          >
            {content.name.split(" ").map((word) => (
              <span key={word}>{word}</span>
            ))}
          </div>

          <div style={{ fontSize: 36, marginTop: 26 }}>{content.tagline}</div>

          <div style={{ fontSize: 24, lineHeight: 1.4, marginTop: 20, color: "#8A8880" }}>
            {content.bio[0]}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      // Only the display face is supplied. Everything else falls through to the
      // Geist that @vercel/og bundles by default — which is the site's body
      // font, so the card lands on the same Archivo/Geist pairing as the page
      // without shipping a second font file.
      fonts: [{ name: "Archivo", data: archivo, weight: 600, style: "normal" }],
    }
  );
}
