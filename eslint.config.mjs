import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // @react-pdf primitives aren't DOM elements — alt-text doesn't apply.
    files: ["src/components/pdf/**"],
    rules: { "jsx-a11y/alt-text": "off" },
  },
  globalIgnores([
    ".next/**",
    "**/.next/**", // nested .next (e.g. a leftover git worktree) — root-anchored ".next/**" misses these
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    ".claude/**", // Claude Code working dir (worktrees, plans) — never lint
    "docs/mockups/**", // archived design exports (vendored), kept only so the .dc.html mockups render
  ]),
]);

export default eslintConfig;
