// Pure Greenhouse field-mapping logic (no DOM here, so it's unit-testable).
// The content script extracts field metadata from the page and calls classifyField.

export type FieldRole =
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "phone"
  | "linkedin"
  | "github"
  | "portfolio"
  | "twitter"
  | "facebook"
  | "instagram"
  | "address"
  | "city"
  | "state"
  | "postalCode"
  | "country"
  | "resume"
  | "coverLetter"
  | null;

export type FieldMeta = {
  name?: string;
  id?: string;
  label?: string;
  type?: string;
  placeholder?: string;
  autocomplete?: string;
};

// Classify a single form field into a known role (or null = unknown/custom).
export function classifyField(meta: FieldMeta): FieldRole {
  const hay = [meta.name, meta.id, meta.label, meta.placeholder].filter(Boolean).join(" ").toLowerCase();
  const type = (meta.type ?? "").toLowerCase();
  const ac = (meta.autocomplete ?? "").toLowerCase();

  // Standard HTML autocomplete hints are the most reliable signal when present.
  if (ac === "given-name") return "firstName";
  if (ac === "family-name") return "lastName";
  if (ac === "name") return "fullName";
  if (ac === "email") return "email";
  if (ac === "tel" || ac.startsWith("tel-")) return "phone";
  if (ac === "street-address" || ac.startsWith("address-line")) return "address";
  if (ac === "address-level2") return "city";
  if (ac === "address-level1") return "state";
  if (ac === "postal-code") return "postalCode";
  if (ac === "country" || ac === "country-name") return "country";

  if (type === "file") {
    if (/cover\s*letter/.test(hay)) return "coverLetter";
    // A lone file input on a job application is the résumé.
    return "resume";
  }
  if (/first[\s_]*name|given[\s_]*name/.test(hay)) return "firstName";
  if (/last[\s_]*name|surname|family[\s_]*name/.test(hay)) return "lastName";
  // Single full-name field: Greenhouse "name", Lever name="name", Ashby id="_systemfield_name".
  if (/full[\s_]*name|legal[\s_]*name|systemfield[_\s]*name/.test(hay) || hay.trim() === "name") return "fullName";
  if (type === "email" || /e[\s-]?mail/.test(hay)) return "email";
  // type="tel" catches international phone widgets whose input has no phone-ish name/label.
  if (type === "tel" || /phone|mobile|\btel\b/.test(hay)) return "phone";
  if (/linkedin/.test(hay)) return "linkedin";
  if (/github/.test(hay)) return "github";
  if (/twitter|x\s*handle|x\.com/.test(hay)) return "twitter";
  if (/facebook|fb\.com/.test(hay)) return "facebook";
  if (/instagram|insta(gram)?\b/.test(hay)) return "instagram";
  if (/portfolio|personal\s*(web)?site|\bwebsite\b/.test(hay)) return "portfolio";
  // Address block (after email/phone/links so those win their fields first).
  if (/postal|\bzip\b|post\s*code/.test(hay)) return "postalCode";
  if (/\bcity\b|town/.test(hay)) return "city";
  if (/\bstate\b|province|region/.test(hay)) return "state";
  if (/\bcountry\b|nationality/.test(hay)) return "country";
  if (/street|address\s*line|mailing\s*address|home\s*address|^\s*address\s*$/.test(hay)) return "address";
  if (/cover\s*letter/.test(hay)) return "coverLetter";
  return null;
}

export type FillData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

// The text value to type for a classified role (file roles handled separately).
export function valueForRole(role: FieldRole, data: FillData): string | null {
  switch (role) {
    case "firstName": return data.firstName;
    case "lastName": return data.lastName;
    case "fullName": return `${data.firstName} ${data.lastName}`.trim();
    case "email": return data.email;
    case "phone": return data.phone;
    case "linkedin": return data.linkedin;
    case "github": return data.github;
    case "portfolio": return data.portfolio;
    case "twitter": return data.twitter ?? null;
    case "facebook": return data.facebook ?? null;
    case "instagram": return data.instagram ?? null;
    case "address": return data.address ?? null;
    case "city": return data.city ?? null;
    case "state": return data.state ?? null;
    case "postalCode": return data.postalCode ?? null;
    case "country": return data.country ?? null;
    default: return null;
  }
}
