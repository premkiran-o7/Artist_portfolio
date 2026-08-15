import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
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
        <Timelines />
        <Skills />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}
