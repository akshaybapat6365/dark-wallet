import * as ledger from "@midnight-ntwrk/ledger-v7";

import { hexToBytes } from "../encoding/hex.js";
import { DarkWalletError } from "../errors.js";

async function graphqlRequest<TData>(params: {
  endpoint: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<TData> {
  const res = await fetch(params.endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: params.query,
      variables: params.variables ?? {},
    }),
  });

  if (!res.ok) {
    throw new DarkWalletError(
      "ERR_STORAGE",
      `Indexer GraphQL request failed (${res.status} ${res.statusText}).`,
    );
  }

  const json = (await res.json()) as {
    data?: TData;
    errors?: Array<{ message?: string }>;
  };
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message ?? "Unknown error").join("; ");
    throw new DarkWalletError("ERR_STORAGE", `Indexer GraphQL errors: ${msg}`);
  }
  if (!json.data) {
    throw new DarkWalletError("ERR_STORAGE", "Indexer GraphQL response missing data.");
  }
  return json.data;
}

export async function fetchLatestLedgerParameters(params: {
  indexerUri: string;
}): Promise<ledger.LedgerParameters> {
  const data = await graphqlRequest<{
    block: null | { ledgerParameters: string };
  }>({
    endpoint: params.indexerUri,
    query: "query LatestLedgerParameters { block { ledgerParameters } }",
  });

  const hex = data.block?.ledgerParameters;
  if (!hex) {
    throw new DarkWalletError(
      "ERR_STORAGE",
      "Indexer did not return latest block ledgerParameters.",
    );
  }
  return ledger.LedgerParameters.deserialize(hexToBytes(hex));
}
