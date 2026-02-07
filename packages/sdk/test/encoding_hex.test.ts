import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes } from "../src/encoding/hex.js";

describe("hex encoding", () => {
  it("roundtrips bytes <-> hex", () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255]);
    const hex = bytesToHex(bytes);
    expect(hex).toBe("000102feff");
    expect(hexToBytes(hex)).toEqual(bytes);
    expect(hexToBytes(`0x${hex}`)).toEqual(bytes);
  });
});
