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
  | "resume"
  | "coverLetter"
  | null;

export type FieldMeta = {
  name?: string;
  id?: string;
  label?: string;
  type?: string;
  placeholder?: string;
};

// Classify a single form field into a known role (or null = unknown/custom).
export function classifyField(meta: FieldMeta): FieldRole {
  const hay = [meta.name, meta.id, meta.label, meta.placeholder].filter(Boolean).join(" ").toLowerCase();
  const type = (meta.type ?? "").toLowerCase();

  if (type === "file") {
    if (/cover\s*letter/.test(hay)) return "coverLetter";
    // A lone file input on a job application is the résumé.
    return "resume";
  }
  if (/first[\s_]*name|given[\s_]*name/.test(hay)) return "firstName";
  if (/last[\s_]*name|surname|family[\s_]*name/.test(hay)) return "lastName";
  // Single full-name field: Greenhouse "name", Lever name="name", Ashby id="_systemfield_name".
  if (/full[\s_]*name|legal[\s_]*name|systemfield[_\s]*name/.test(hay) || hay.trim() === "name") return "fullName";
  if (/e[\s-]?mail/.test(hay)) return "email";
  if (/phone|mobile|\btel\b/.test(hay)) return "phone";
  if (/linkedin/.test(hay)) return "linkedin";
  if (/github/.test(hay)) return "github";
  if (/portfolio|personal\s*(web)?site|\bwebsite\b/.test(hay)) return "portfolio";
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
    default: return null;
  }
}
