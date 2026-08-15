import { getContent } from "@/lib/content";
import Reveal from "@/components/Reveal";

function Rail({ title, items }: {
  title: string;
  items: { from: string; to: string; head: string; sub: string }[];
}) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">{title}</h2>
      <ol className="mt-8 relative border-l border-[var(--rule)] pl-6 space-y-8">
        {items.map((it, index) => (
          <li key={`${it.from}-${it.head}`} className="relative">
            <Reveal delay={index * 60}>
              <span aria-hidden
                className="absolute -left-[1.65rem] top-2 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
              <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
                {it.from} — {it.to}
              </p>
              <p className="mt-1 text-xl">{it.head}</p>
              <p className="text-[var(--ink-dim)]">{it.sub}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Timelines() {
  const c = getContent();
  return (
    <section id="about" className="px-6 md:px-12 py-16 scroll-mt-20">
      <div className="mx-auto grid w-full max-w-6xl gap-14 md:grid-cols-2">
        <Rail title="Work Experience"
          items={c.experience.map((e) => ({ from: e.from, to: e.to, head: e.company, sub: e.role }))} />
        <Rail title="Education"
          items={c.education.map((e) => ({ from: e.from, to: e.to, head: e.institution, sub: e.detail }))} />
      </div>
    </section>
  );
}
