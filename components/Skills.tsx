import { getContent } from "@/lib/content";
import Reveal from "@/components/Reveal";
import SkillBar from "@/components/SkillBar";

// Bars show Manish's own self-assessed percentages, read straight from content.json.
// (This replaced three fixed widths mapped from Expert/Advanced/Working labels. Labels
// were the right call while the levels were our guesses — an invented "85%" is worse
// than an invented "Expert". Once he supplied real figures, the numbers became the
// honest thing to show, and banding them only threw away detail he had given us.)

/**
 * Monogram glyph tint, keyed by `icon` (the stable per-software slug from
 * content.json). Each app's brand hue, muted/desaturated only as far as
 * needed to clear 4.5:1 against solid --ground -- everything else in the
 * tile (background, border, the SkillBar fill) stays neutral/--accent so
 * seven saturated brand colours don't fight the site's near-black,
 * one-accent art direction. Ratios measured against --ground (#0B0B0C);
 * see task-6-report.md for the full working.
 *
 *   davinci   #5F81A3  4.83:1  lightened from Blackmagic's official navy
 *                              #233A51 (1.68:1 -- fails outright on its own)
 *   ae        #CF96FD  8.84:1  Adobe's After Effects CC-icon lilac, as-is
 *   premiere  #DB76FA  7.48:1  Adobe's Premiere Pro CC-icon violet, as-is
 *   lightroom #B4D6E0 12.77:1  Adobe's Lightroom CC-icon sky blue, as-is
 *   blender   #E87D0D  6.90:1  Blender Foundation's official orange, as-is
 *   canva     #995CE8  4.73:1  lightened from Canva Violet #7D2AE7
 *                              (3.15:1 -- fails on its own)
 *   capcut    var(--ink)  17.46:1  FALLBACK -- CapCut's only documented
 *                              brand colour is flat black, which can't be
 *                              muted toward --ground and still read as
 *                              "CapCut's colour" rather than just grey
 */
const MONO_COLOR: Record<string, string> = {
  davinci: "#5F81A3",
  ae: "#CF96FD",
  premiere: "#DB76FA",
  capcut: "var(--ink)",
  blender: "#E87D0D",
  lightroom: "#B4D6E0",
  canva: "#995CE8",
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
                  {/* aria-hidden: the adjacent name text below already names the
                      software, same reasoning as the alt="" it replaces. */}
                  <div
                    aria-hidden="true"
                    style={{ color: MONO_COLOR[s.icon] ?? "var(--ink)" }}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--rule)] font-[family-name:var(--font-display)] text-sm font-semibold"
                  >
                    {s.mono}
                  </div>
                  <p className="mt-4 text-sm">{s.name}</p>
                  <SkillBar fill={`${s.level}%`} />
                  <p className="mt-2 font-[family-name:var(--font-mono)] text-[0.65rem] uppercase tracking-widest text-[var(--ink-dim)]">
                    {s.level}%
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
