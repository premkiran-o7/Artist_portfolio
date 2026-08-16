"use client";

import { useRef, useState } from "react";
import Reveal from "@/components/Reveal";
import PhotoLightbox from "@/components/PhotoLightbox";
import YouTubeFacade from "@/components/YouTubeFacade";
import { byCategory, type CategoryVideo, type PhotoCard } from "@/lib/categories";

const THREE_D_CATEGORY = "3d-modeling";

type Props = {
  /** Raw `photos` rows (any category); filtered to 3d-modeling here, not by
   *  the caller — same convention as CategoryCards/ComingSoon's is_live split. */
  photos: PhotoCard[];
  /** Raw video rows (already resolved to CategoryVideo by app/page.tsx), same
   *  full list CategoryCards receives. Filtered to 3d-modeling here. */
  videos: CategoryVideo[];
};

/**
 * Section 7a of the wireframe (spec revision 2026-08-16): Manish's finished 3D
 * work, which is stills rather than YouTube footage and so cannot live in
 * `videos` (every row there requires a `youtube_url`/`youtube_id` — see
 * migrations/002_photos.sql). This section renders BOTH: photos from the new
 * `photos` table, and any video that also happens to carry `3d-modeling` —
 * there are none of the latter today, but the schema and this component both
 * support it, since a turntable animation belongs here too, not in the
 * Work grid above.
 *
 * Photos vs. videos, rendered differently, on purpose:
 *   - A photo is a plain <img> in a fixed-aspect tile — nothing to lazily
 *     activate, so clicking it opens PhotoLightbox for a larger look.
 *   - A video uses YouTubeFacade directly in its own tile, exactly as
 *     CategoryCards' lightbox does — YouTubeFacade IS the click-to-expand
 *     control (thumbnail -> iframe on click), so wrapping it in a second
 *     lightbox would just be two layers of "click to open" for one action.
 *
 * Mixed aspect ratios (CLS): Manish's renders arrive at whatever size he
 * exported — some portrait (e.g. 1080x1350), some landscape (e.g. 1599x899) —
 * and the `photos` table stores no width/height (see the migration; it was a
 * deliberate omission, not an oversight). Since the real dimensions aren't
 * known until the image itself loads, giving each <img> explicit width/height
 * isn't an option here. Instead every photo tile is a fixed `aspect-square`
 * box (same idiom as ClientGrid's logo tiles) with `object-contain`, never
 * `object-cover`: the box's size comes from CSS alone, so it never depends on
 * an image finishing its download, and `contain` means a photo is letterboxed
 * to fit rather than cropped or stretched — a portrait render never loses its
 * top/bottom, a landscape one never loses its sides. Task 20 measured this
 * site's CLS at 0.00; a fixed-size box before the image resolves is what
 * keeps it there.
 */
export default function ThreeDGallery({ photos, videos }: Props) {
  const threeDPhotos = byCategory(photos, THREE_D_CATEGORY);
  const threeDVideos = byCategory(videos, THREE_D_CATEGORY);

  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Empty state: render NOTHING, heading included — same rule ClientGrid and
  // ComingSoon follow, and it must hold whether photos are empty, videos are
  // empty, or (today) both.
  if (threeDPhotos.length === 0 && threeDVideos.length === 0) return null;

  const openPhoto = threeDPhotos.find((p) => p.id === openPhotoId) ?? null;

  const closeLightbox = () => {
    const justClosed = openPhotoId;
    setOpenPhotoId(null);
    // Restore focus to the card that opened the lightbox, not just "focus
    // moved somewhere reasonable" — mirrors CategoryCards' closeLightbox.
    if (justClosed) triggerRefs.current[justClosed]?.focus();
  };

  return (
    <section id="3d" className="px-6 md:px-12 py-16 scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">3D Modeling</h2>
        <ul className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {threeDPhotos.map((photo, index) => (
            <li key={`photo-${photo.id}`}>
              <Reveal delay={index * 60}>
                <button
                  ref={(el) => {
                    triggerRefs.current[photo.id] = el;
                  }}
                  type="button"
                  onClick={() => setOpenPhotoId(photo.id)}
                  aria-haspopup="dialog"
                  className="group block w-full overflow-hidden rounded-xl border border-[var(--rule)] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  <div className="relative aspect-square bg-black">
                    {/* alt="": the title is printed directly below inside the
                        same control, same reasoning as ClientGrid's cards. */}
                    <img
                      src={photo.image_url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20"
                    />
                  </div>
                  <div className="border-t border-[var(--rule)] px-4 py-3">
                    <h3 className="truncate text-sm">{photo.title}</h3>
                  </div>
                </button>
              </Reveal>
            </li>
          ))}

          {threeDVideos.map((video, index) => (
            <li key={`video-${video.id}`}>
              <Reveal delay={(threeDPhotos.length + index) * 60}>
                <div className="overflow-hidden rounded-xl border border-[var(--rule)]">
                  <div className="relative aspect-video bg-black">
                    <YouTubeFacade id={video.youtube_id} thumb={video.thumb} title={video.title} />
                  </div>
                  <div className="border-t border-[var(--rule)] px-4 py-3">
                    <h3 className="truncate text-sm">{video.title}</h3>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>

      <PhotoLightbox
        open={openPhotoId !== null}
        onClose={closeLightbox}
        title={openPhoto?.title ?? ""}
        imageUrl={openPhoto?.image_url ?? null}
      />
    </section>
  );
}
