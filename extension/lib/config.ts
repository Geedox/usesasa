export type Config = { baseUrl: string; token: string; autoSubmit: boolean };

// Where the extension talks to the API. Production builds (pnpm build / pnpm zip)
// point at the live site; dev builds (pnpm dev) use localhost. Override either with
// WXT_PUBLIC_SASA_BASE_URL in extension/.env (e.g. a staging host). import.meta.env.DEV
// is used directly so the unused branch (and the localhost literal) is dropped in prod.
export const DEFAULT_BASE_URL =
  (import.meta.env as Record<string, string | undefined>).WXT_PUBLIC_SASA_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3000" : "https://usesasa.xyz");

const DEFAULTS: Config = { baseUrl: DEFAULT_BASE_URL, token: "", autoSubmit: false };

export async function getConfig(): Promise<Config> {
  const stored = await chrome.storage.local.get(["baseUrl", "token", "autoSubmit"]);
  return {
    baseUrl: (stored.baseUrl as string) || DEFAULTS.baseUrl,
    token: (stored.token as string) || DEFAULTS.token,
    autoSubmit: (stored.autoSubmit as boolean) ?? DEFAULTS.autoSubmit,
  };
}

export async function setConfig(cfg: Partial<Config>): Promise<void> {
  await chrome.storage.local.set(cfg);
}
