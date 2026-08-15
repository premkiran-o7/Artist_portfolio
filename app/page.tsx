import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import Timelines from "@/components/Timelines";
import Skills from "@/components/Skills";
import Contact from "@/components/Contact";
import SiteFooter from "@/components/SiteFooter";

// Hourly backstop if the revalidation webhook (app/api/revalidate) ever fails
// to fire or gets missed — see api/_lib/revalidate.py's bust_cache().
export const revalidate = 3600;

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Timelines />
        <Skills />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}
