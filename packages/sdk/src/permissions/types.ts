import type { WalletConnectedAPI } from "../api/types.js";

export type WalletMethodName = keyof WalletConnectedAPI;

export type PermissionRecord = {
  /**
   * Methods allowed for a given origin/context.
   *
   * Stored as an allow-list to support least-privilege prompts and future revocation.
   */
  methods: WalletMethodName[];
  createdAt: string;
  updatedAt: string;
};

export interface PermissionController {
  /**
   * Called when a dApp hints usage or tries to call a method without permission.
   *
   * Implementations:
   * - embedded SDK: auto-allow (default)
   * - extension: open a prompt UI and wait for user decision
   */
  request(params: { origin: string; methods: WalletMethodName[] }): Promise<{
    granted: WalletMethodName[];
  }>;
}

export class AllowAllPermissionController implements PermissionController {
  public async request(params: {
    origin: string;
    methods: WalletMethodName[];
  }): Promise<{ granted: WalletMethodName[] }> {
    void params.origin;
    return { granted: [...new Set(params.methods)] };
  }
}

export class DenyAllPermissionController implements PermissionController {
  public async request(params: {
    origin: string;
    methods: WalletMethodName[];
  }): Promise<{ granted: WalletMethodName[] }> {
    void params.origin;
    void params.methods;
    return { granted: [] };
  }
}
