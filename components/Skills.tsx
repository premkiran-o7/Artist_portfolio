import { getContent } from "@/lib/content";
import Reveal from "@/components/Reveal";
import SkillBar from "@/components/SkillBar";

// Three fixed bar widths — never a percentage read from content.json.
const FILL: Record<string, string> = {
  Expert: "100%", Advanced: "72%", Working: "45%",
};

export default function Skills() {
  const c = getContent();
  return (
    <section id="skills" className="px-6 md:px-12 py-16 scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">Software Skills</h2>
        <ul className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {c.skills.map((s, index) => (
            <li key={s.name}>
              <Reveal delay={index * 60}>
                <div className="rounded-xl border border-[var(--rule)] p-5">
                  <img src={`/icons/${s.icon}.svg`} alt="" width={40} height={40} className="h-10 w-10" />
                  <p className="mt-4 text-sm">{s.name}</p>
                  <SkillBar fill={FILL[s.level]} />
                  <p className="mt-2 font-[family-name:var(--font-mono)] text-[0.65rem] uppercase tracking-widest text-[var(--ink-dim)]">
                    {s.level}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
