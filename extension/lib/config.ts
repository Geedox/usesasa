export type Config = { baseUrl: string; token: string };

const DEFAULTS: Config = { baseUrl: "http://localhost:3000", token: "" };

export async function getConfig(): Promise<Config> {
  const stored = await chrome.storage.local.get(["baseUrl", "token"]);
  return {
    baseUrl: (stored.baseUrl as string) || DEFAULTS.baseUrl,
    token: (stored.token as string) || DEFAULTS.token,
  };
}

export async function setConfig(cfg: Partial<Config>): Promise<void> {
  await chrome.storage.local.set(cfg);
}
