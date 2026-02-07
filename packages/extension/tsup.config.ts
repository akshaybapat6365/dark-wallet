import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    inpage: "src/inpage.ts",
    sw: "src/sw.ts",
  },
  format: ["esm"],
  target: "es2022",
  sourcemap: true,
  dts: false,
  clean: true,
});
