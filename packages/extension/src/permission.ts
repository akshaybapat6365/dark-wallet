function qp(name: string): string {
  const v = new URLSearchParams(window.location.search).get(name);
  if (!v) throw new Error(`Missing query param '${name}'`);
  return v;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

type PermissionResponseMsg = {
  kind: "dw:ui:permission-response";
  requestId: string;
  granted: string[];
};

function parseMethods(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(",")
    .map((x) => decodeURIComponent(x).trim())
    .filter(Boolean);
}

async function respond(granted: string[]): Promise<void> {
  const msg: PermissionResponseMsg = {
    kind: "dw:ui:permission-response",
    requestId: qp("rid"),
    granted,
  };
  await chrome.runtime.sendMessage(msg);
  window.close();
}

document.addEventListener("DOMContentLoaded", () => {
  const origin = decodeURIComponent(qp("origin"));
  const methods = parseMethods(qp("methods"));

  el<HTMLDivElement>("origin").textContent = origin;

  const ul = el<HTMLUListElement>("methods");
  ul.innerHTML = "";
  for (const m of methods) {
    const li = document.createElement("li");
    li.textContent = m;
    ul.appendChild(li);
  }

  el<HTMLButtonElement>("allow").addEventListener("click", () => void respond(methods));
  el<HTMLButtonElement>("deny").addEventListener("click", () => void respond([]));
});
