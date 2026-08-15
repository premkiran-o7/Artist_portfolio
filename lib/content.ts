import { z } from "zod";
import raw from "@/content.json";

export const SkillLevel = z.enum(["Expert", "Advanced", "Working"]);
export type SkillLevel = z.infer<typeof SkillLevel>;

export const ContentSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().min(1),
  bio: z.array(z.string().min(1)).length(3),
  dob: z.string().min(1),
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
