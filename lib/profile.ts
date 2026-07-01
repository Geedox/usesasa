import { z } from "zod";

// Canonical structured profile (FRD §5.1.3). Stored in profiles.parsedData.
export const experienceSchema = z.object({
  company: z.string().default(""),
  title: z.string().default(""),
  start: z.string().default(""),
  end: z.string().default(""),
  location: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

export const educationSchema = z.object({
  institution: z.string().default(""),
  degree: z.string().default(""),
  field: z.string().default(""),
  start: z.string().default(""),
  end: z.string().default(""),
  location: z.string().default(""),
});

export const languageSchema = z.object({
  language: z.string().default(""),
  proficiency: z.string().default(""),
});

// Custom sections the user adds (e.g. Volunteer Experience).
export const customStructuredItemSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  start: z.string().default(""),
  end: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

export const customSectionSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1),
  format: z.enum(["structured", "bullets"]),
  structuredItems: z.array(customStructuredItemSchema).default([]),
  bulletItems: z.array(z.string()).default([]),
});

export type CustomSection = z.infer<typeof customSectionSchema>;

// Strict schema used to validate on SAVE (full name + email required).
export const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required"),
  email: z.string().trim().email("A valid email is required"),
  phone: z.string().default(""),
  location: z
    .object({ city: z.string().default(""), country: z.string().default("") })
    .default({ city: "", country: "" }),
  links: z
    .object({
      linkedin: z.string().default(""),
      github: z.string().default(""),
      portfolio: z.string().default(""),
    })
    .default({ linkedin: "", github: "", portfolio: "" }),
  summary: z.string().default(""),
  experience: z.array(experienceSchema).default([]),
  education: z.array(educationSchema).default([]),
  skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(languageSchema).default([]),
  customSections: z.array(customSectionSchema).default([]),
});

export type Profile = z.infer<typeof profileSchema>;

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// Tolerant coercion of raw jsonb (possibly partial / from the parser) into the
// full Profile shape so the editor can load it without throwing.
export function normalizeProfile(raw: unknown): Profile {
  const r = (raw ?? {}) as Record<string, any>;
  return {
    full_name: str(r.full_name),
    email: str(r.email),
    phone: str(r.phone),
    location: { city: str(r.location?.city), country: str(r.location?.country) },
    links: {
      linkedin: str(r.links?.linkedin),
      github: str(r.links?.github),
      portfolio: str(r.links?.portfolio),
    },
    summary: str(r.summary),
    experience: arr(r.experience).map((e: any) => ({
      company: str(e?.company),
      title: str(e?.title),
      start: str(e?.start),
      end: str(e?.end),
      location: str(e?.location),
      bullets: arr(e?.bullets).map(str),
    })),
    education: arr(r.education).map((e: any) => ({
      institution: str(e?.institution),
      degree: str(e?.degree),
      field: str(e?.field),
      start: str(e?.start),
      end: str(e?.end),
      location: str(e?.location),
    })),
    skills: arr(r.skills).map(str),
    certifications: arr(r.certifications).map(str),
    languages: arr(r.languages).map((l: any) => ({
      language: str(l?.language),
      proficiency: str(l?.proficiency),
    })),
    customSections: arr(r.customSections).map((s: any, i: number) => ({
      id: str(s?.id) || `cs-${i}`,
      title: str(s?.title),
      format: s?.format === "bullets" ? ("bullets" as const) : ("structured" as const),
      structuredItems: arr(s?.structuredItems).map((it: any) => ({
        title: str(it?.title),
        subtitle: str(it?.subtitle),
        start: str(it?.start),
        end: str(it?.end),
        bullets: arr(it?.bullets).map(str),
      })),
      bulletItems: arr(s?.bulletItems).map(str),
    })),
  };
}

export const emptyExperience = () => ({ company: "", title: "", start: "", end: "", location: "", bullets: [""] });
export const emptyEducation = () => ({ institution: "", degree: "", field: "", start: "", end: "", location: "" });
export const emptyLanguage = () => ({ language: "", proficiency: "" });
