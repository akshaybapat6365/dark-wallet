import {
  DEFAULT_PROFILE,
  type SettingsV1,
  defaultSettings,
  loadSettings,
  saveSettings,
} from "./settings.js";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

function setStatus(text: string, kind: "ok" | "err" = "ok"): void {
  const s = el<HTMLSpanElement>("status");
  s.textContent = text;
  s.style.color = kind === "ok" ? "rgba(45, 243, 165, 0.95)" : "rgba(255, 70, 106, 0.95)";
  if (text) {
    setTimeout(() => {
      s.textContent = "";
    }, 2500);
  }
}

function readInput(id: string): string {
  return el<HTMLInputElement>(id).value.trim();
}

function writeInput(id: string, value: string): void {
  el<HTMLInputElement>(id).value = value;
}

function populate(settings: SettingsV1): void {
  const net = settings.activeNetworkId;
  const profile = settings.profiles[net] ?? DEFAULT_PROFILE;

  writeInput("networkId", net);
  writeInput("indexerUri", profile.indexerUri);
  writeInput("indexerWsUri", profile.indexerWsUri ?? "");
  writeInput("proverServerUri", profile.proverServerUri ?? "");
  writeInput("substrateNodeUri", profile.substrateNodeUri);
}

async function load(): Promise<void> {
  const settings = await loadSettings();
  populate(settings);
}

async function save(): Promise<void> {
  const networkId = readInput("networkId");
  const indexerUri = readInput("indexerUri");
  const indexerWsUri = readInput("indexerWsUri");
  const proverServerUri = readInput("proverServerUri");
  const substrateNodeUri = readInput("substrateNodeUri");

  if (!networkId || !indexerUri || !substrateNodeUri) {
    setStatus("networkId, indexerUri, and substrateNodeUri are required.", "err");
    return;
  }

  const next: SettingsV1 = {
    v: 1,
    activeNetworkId: networkId,
    profiles: {
      [networkId]: {
        indexerUri,
        substrateNodeUri,
        ...(indexerWsUri ? { indexerWsUri } : {}),
        ...(proverServerUri ? { proverServerUri } : {}),
      },
    },
  };

  await saveSettings(next);
  setStatus("Saved.");
}

async function reset(): Promise<void> {
  const next = defaultSettings();
  await saveSettings(next);
  populate(next);
  setStatus("Defaults restored.");
}

document.addEventListener("DOMContentLoaded", () => {
  void load();
  el<HTMLButtonElement>("save").addEventListener("click", () => void save());
  el<HTMLButtonElement>("reset").addEventListener("click", () => void reset());
});
