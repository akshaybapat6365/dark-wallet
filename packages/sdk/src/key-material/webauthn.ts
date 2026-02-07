import { randomBytes } from "../crypto/webcrypto.js";
import { base64ToBytes, bytesToBase64 } from "../encoding/base64.js";
import { DarkWalletError } from "../errors.js";
import type { KeyMaterialProvider } from "./types.js";

function toArrayBufferU8(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes.buffer instanceof ArrayBuffer) return bytes as Uint8Array<ArrayBuffer>;
  return new Uint8Array(bytes) as Uint8Array<ArrayBuffer>;
}

export type WebAuthnDerivationMode = "prf" | "hmac-secret";

export type CreatePasskeyParams = {
  rpId?: string;
  rpName: string;
  userId: Uint8Array; // stable id for this user/app instance
  userName: string;
  userDisplayName: string;
  timeoutMs?: number;
};

export async function createPasskeyCredentialId(params: CreatePasskeyParams): Promise<string> {
  if (typeof PublicKeyCredential === "undefined" || !navigator?.credentials) {
    throw new DarkWalletError("ERR_UNSUPPORTED", "WebAuthn is not available in this environment.");
  }

  const challenge = toArrayBufferU8(randomBytes(32));
  const rp: PublicKeyCredentialRpEntity = params.rpId
    ? { id: params.rpId, name: params.rpName }
    : { name: params.rpName };

  const credential = (await navigator.credentials.create({
    publicKey: {
      rp,
      user: {
        id: toArrayBufferU8(params.userId),
        name: params.userName,
        displayName: params.userDisplayName,
      },
      challenge,
      pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "required",
      },
      timeout: params.timeoutMs ?? 60_000,
      attestation: "none",
      // Request both extensions; unsupported ones should be ignored by UA/authenticator.
      extensions: {
        prf: {},
        hmacCreateSecret: true,
      },
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new DarkWalletError("ERR_UNSUPPORTED", "Passkey creation was cancelled.");
  return bytesToBase64(new Uint8Array(credential.rawId));
}

export type DeriveRootSecretParams = {
  credentialId: string; // base64 of rawId
  rpId?: string;
  mode: WebAuthnDerivationMode;
  timeoutMs?: number;
};

async function deriveViaPrf(params: DeriveRootSecretParams): Promise<Uint8Array> {
  // PRF input: fixed domain separation, deterministic secret per credential.
  const prfInput = toArrayBufferU8(new TextEncoder().encode("dark-wallet:webauthn-prf:v0"));
  const allowCredentials = [
    { id: base64ToBytes(params.credentialId), type: "public-key" as const },
  ] satisfies PublicKeyCredentialDescriptor[];

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: toArrayBufferU8(randomBytes(32)),
    allowCredentials,
    userVerification: "required",
    timeout: params.timeoutMs ?? 60_000,
    extensions: {
      prf: { eval: { first: prfInput } },
    },
    ...(params.rpId ? { rpId: params.rpId } : {}),
  };

  const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;

  if (!assertion) throw new DarkWalletError("ERR_UNSUPPORTED", "Passkey assertion was cancelled.");

  const results = assertion.getClientExtensionResults() as unknown as {
    prf?: { results?: { first?: ArrayBuffer } };
  };
  const prf = results.prf?.results?.first;
  if (!prf) throw new DarkWalletError("ERR_UNSUPPORTED", "WebAuthn PRF extension not supported.");
  return new Uint8Array(prf);
}

async function deriveViaHmacSecret(params: DeriveRootSecretParams): Promise<Uint8Array> {
  const salt1 = toArrayBufferU8(new TextEncoder().encode("dark-wallet:hmac-secret:v0"));
  const allowCredentials = [
    { id: base64ToBytes(params.credentialId), type: "public-key" as const },
  ] satisfies PublicKeyCredentialDescriptor[];

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: toArrayBufferU8(randomBytes(32)),
    allowCredentials,
    userVerification: "required",
    timeout: params.timeoutMs ?? 60_000,
    extensions: {
      // @ts-expect-error - WebAuthn hmac-secret request extension (missing in some TS DOM libs)
      hmacGetSecret: { salt1 },
    },
    ...(params.rpId ? { rpId: params.rpId } : {}),
  };

  const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;

  if (!assertion) throw new DarkWalletError("ERR_UNSUPPORTED", "Passkey assertion was cancelled.");

  const results = assertion.getClientExtensionResults() as unknown as {
    hmacGetSecret?: { output1?: ArrayBuffer };
  };
  const hmac = results.hmacGetSecret?.output1;
  if (!hmac) throw new DarkWalletError("ERR_UNSUPPORTED", "hmac-secret extension not supported.");
  return new Uint8Array(hmac);
}

export async function deriveRootSecretFromPasskey(
  params: DeriveRootSecretParams,
): Promise<Uint8Array> {
  if (typeof PublicKeyCredential === "undefined" || !navigator?.credentials) {
    throw new DarkWalletError("ERR_UNSUPPORTED", "WebAuthn is not available in this environment.");
  }

  if (params.mode === "prf") return deriveViaPrf(params);
  return deriveViaHmacSecret(params);
}

export class WebAuthnKeyMaterialProvider implements KeyMaterialProvider {
  public readonly credentialId: string;
  public readonly rpId?: string;
  public readonly mode: WebAuthnDerivationMode;

  public constructor(params: {
    credentialId: string;
    rpId?: string;
    mode?: WebAuthnDerivationMode;
  }) {
    this.credentialId = params.credentialId;
    if (params.rpId !== undefined) this.rpId = params.rpId;
    this.mode = params.mode ?? "prf";
  }

  public async getRootSecret(): Promise<Uint8Array> {
    const base = { credentialId: this.credentialId, mode: this.mode } as const;
    return deriveRootSecretFromPasskey({
      ...base,
      ...(this.rpId ? { rpId: this.rpId } : {}),
    });
  }
}

export function isProbablyWebAuthnAvailable(): boolean {
  return typeof PublicKeyCredential !== "undefined" && typeof navigator !== "undefined";
}

export function normalizeCredentialIdBase64(credentialId: string): string {
  // Normalization is a no-op for standard base64; included to keep a stable place for future changes.
  return bytesToBase64(base64ToBytes(credentialId));
}
