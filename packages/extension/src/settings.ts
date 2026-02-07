export type EndpointProfile = {
  indexerUri: string;
  indexerWsUri?: string;
  proverServerUri?: string;
  substrateNodeUri: string;
};

export type SettingsV1 = {
  v: 1;
  activeNetworkId: string;
  profiles: Record<string, EndpointProfile>;
};

const STORAGE_KEY = "dw:settings:v1";

export const DEFAULT_PROFILE: EndpointProfile = {
  indexerUri: "http://127.0.0.1:8088/api/v1/graphql",
  indexerWsUri: "ws://127.0.0.1:8088/api/v1/graphql",
  proverServerUri: "http://127.0.0.1:6300",
  substrateNodeUri: "wss://rpc.testnet-02.midnight.network",
};

export function defaultSettings(): SettingsV1 {
  return {
    v: 1,
    activeNetworkId: "testnet",
    profiles: {
      testnet: DEFAULT_PROFILE,
    },
  };
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function normalizeProfile(p: Partial<EndpointProfile> | undefined): EndpointProfile | null {
  if (!p) return null;
  if (!isNonEmptyString(p.indexerUri)) return null;
  if (!isNonEmptyString(p.substrateNodeUri)) return null;

  const out: EndpointProfile = {
    indexerUri: p.indexerUri.trim(),
    substrateNodeUri: p.substrateNodeUri.trim(),
  };
  if (isNonEmptyString(p.indexerWsUri)) out.indexerWsUri = p.indexerWsUri.trim();
  if (isNonEmptyString(p.proverServerUri)) out.proverServerUri = p.proverServerUri.trim();
  return out;
}

function normalizeSettings(x: unknown): SettingsV1 {
  if (!x || typeof x !== "object") return defaultSettings();
  const o = x as Partial<SettingsV1>;
  if (o.v !== 1) return defaultSettings();
  if (!isNonEmptyString(o.activeNetworkId)) return defaultSettings();

  const profiles: Record<string, EndpointProfile> = {};
  for (const [k, v] of Object.entries(o.profiles ?? {})) {
    const p = normalizeProfile(v as Partial<EndpointProfile>);
    if (p) profiles[k] = p;
  }

  if (!profiles[o.activeNetworkId.trim()]) return defaultSettings();
  return { v: 1, activeNetworkId: o.activeNetworkId.trim(), profiles };
}

export async function loadSettings(): Promise<SettingsV1> {
  const res = await chrome.storage.local.get(STORAGE_KEY);
  const raw = res[STORAGE_KEY] as unknown;
  const normalized = normalizeSettings(raw);
  if (!raw) await saveSettings(normalized);
  return normalized;
}

export async function saveSettings(next: SettingsV1): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
}

export async function loadActiveProfile(): Promise<{
  networkId: string;
  profile: EndpointProfile;
}> {
  const settings = await loadSettings();
  const networkId = settings.activeNetworkId;
  const profile = settings.profiles[networkId];
  if (!profile) return { networkId: "testnet", profile: DEFAULT_PROFILE };
  return { networkId, profile };
}
