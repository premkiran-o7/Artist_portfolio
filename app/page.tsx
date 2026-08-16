import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import Timelines from "@/components/Timelines";
import Skills from "@/components/Skills";
import CategoryCards from "@/components/CategoryCards";
import ClientGrid from "@/components/ClientGrid";
import ThreeDGallery from "@/components/ThreeDGallery";
import ComingSoon from "@/components/ComingSoon";
import Contact from "@/components/Contact";
import SiteFooter from "@/components/SiteFooter";
import { getVideos, getPlaylists, getClients, getComingSoon, getPhotos, resolveThumb } from "@/lib/db";
import { CARD_CATEGORIES, type CardCategoryValue, type CategoryVideo } from "@/lib/categories";

// Hourly backstop if the revalidation webhook (app/api/revalidate) ever fails
// to fire or gets missed — see api/_lib/revalidate.py's bust_cache().
export const revalidate = 3600;

/**
 * This page is statically generated (see `revalidate` above) — getVideos()/
 * getPlaylists() run at BUILD time (and again on each revalidation), never
 * on a visitor's request. Both already degrade to `[]` on any failure
 * (safeQuery in lib/db.ts), so a missing DATABASE_URL or an empty table
 * renders a sane, empty CategoryCards section rather than breaking the
 * build.
 *
 * resolveThumb() is called HERE, server-side, rather than inside
 * CategoryCards — CategoryCards is a client component, and lib/db.ts pulls
 * in @neondatabase/serverless at module scope. Resolving each video's thumb
 * URL up front means the client only ever receives plain strings, never an
 * import path back to the database driver.
 */
export default async function Page() {
  const [videos, playlists, clients, comingSoon, photos] = await Promise.all([
    getVideos(),
    getPlaylists(),
    getClients(),
    getComingSoon(),
    getPhotos(),
  ]);

  const categoryVideos: CategoryVideo[] = videos.map((v) => ({
    id: v.id,
    title: v.title,
    category: v.category,
    youtube_id: v.youtube_id,
    is_featured: v.is_featured,
    sort_order: v.sort_order,
    thumb: resolveThumb(v),
  }));

  const playlistUrls: Partial<Record<CardCategoryValue, string>> = {};
  for (const p of playlists) {
    const known = CARD_CATEGORIES.find((c) => c.value === p.category);
    if (known) playlistUrls[known.value] = p.youtube_playlist_url;
  }

  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Timelines />
        <Skills />
        {/* Both sections get the RAW coming-soon rows and apply their own half
            of the is_live split — CategoryCards takes the promoted ones,
            ComingSoon the pending ones. Splitting here instead would put that
            rule in a third place and let the two halves drift apart, which is
            precisely how promoted items came to belong to no section at all. */}
        <CategoryCards
          videos={categoryVideos}
          playlistUrls={playlistUrls}
          comingSoon={comingSoon}
        />
        <ClientGrid clients={clients} />
        <ThreeDGallery photos={photos} videos={categoryVideos} />
        <ComingSoon items={comingSoon} />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}
