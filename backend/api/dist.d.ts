// Type shim so importing the compiled dist/ doesn't trigger TS7016 (no declaration
// file) during Vercel's build. Real types live in src/; dist/ is the tsc output.
declare module "*/dist/index.js" {
  export const app: import("express").Express;
}
