import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    inpage: "src/inpage.ts",
    sw: "src/sw.ts",
    offscreen: "src/offscreen.ts",
    options: "src/options.ts",
    permission: "src/permission.ts",
  },
  format: ["esm"],
  target: "es2022",
  sourcemap: true,
  dts: false,
  clean: true,
  outDir: "public/dist",
});
