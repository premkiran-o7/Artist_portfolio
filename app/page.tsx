import Hero from "@/components/Hero";
import ShowReel from "@/components/ShowReel";
export default function Page() {
  return (
    <main>
      <Hero />
      <ShowReel src="/showreel-placeholder.mp4" poster="/showreel-poster.jpg" />
    </main>
  );
}
