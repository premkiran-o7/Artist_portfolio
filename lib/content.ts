import { z } from "zod";
import raw from "@/content.json";

/**
 * A self-assessed proficiency percentage, 0-100.
 *
 * This was previously an enum of Expert/Advanced/Working. Labels were correct while
 * the values were our own guesses — an invented "85%" claims a precision nobody has,
 * whereas "Expert" is a defensible summary. Once Manish supplied his own figures the
 * calculus inverted: the numbers are his, and banding them discarded detail he gave us.
 */
export const SkillLevel = z.number().int().min(0).max(100);
export type SkillLevel = z.infer<typeof SkillLevel>;

export const ContentSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().min(1),
  bio: z.array(z.string().min(1)).length(3),
  // Optional: Manish's CV carries no date of birth, and the hero omits the field
  // entirely when it is empty rather than rendering a placeholder dash.
  dob: z.string(),
  phone: z.string().min(1),
  email: z.string().email(),
  socials: z.object({
    instagram: z.string().url(),
    youtube: z.string().url(),
    linkedin: z.string().url(),
  }),
  experience: z.array(z.object({
    from: z.string(), to: z.string(), company: z.string(), role: z.string(),
  })),
  education: z.array(z.object({
    from: z.string(), to: z.string(), institution: z.string(), detail: z.string(),
  })),
  skills: z.array(z.object({
    name: z.string(), icon: z.string(), level: SkillLevel, mono: z.string().min(1),
  })).min(1),
});

export type Content    = z.infer<typeof ContentSchema>;
export type Skill      = Content["skills"][number];
export type Experience = Content["experience"][number];
export type Education  = Content["education"][number];

let cached: Content | null = null;

/** Throws at build time if content.json is malformed — a bad edit fails the deploy
 *  rather than shipping a broken page. */
export function getContent(): Content {
  if (!cached) cached = ContentSchema.parse(raw);
  return cached;
}
