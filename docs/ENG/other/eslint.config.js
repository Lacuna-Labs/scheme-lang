/**
 * eslint.config.js — flat config (ESLint 9+).
 *
 * Ships two things:
 *   1. Default recommended rules for src/ + bindings/js.
 *   2. Custom sakura-artifact rules from ./eslint-rules/ scoped to the
 *      artifact tree + consumers. no-loose-escape-handler (T-09) is
 *      warn-first per §16 of ARTIFACT-2026-07-10; upgrades to error
 *      after the top-5 migrations land.
 */
import { createRequire } from "module";

const requireCjs = createRequire(import.meta.url);
const artifactRules = requireCjs("./eslint-rules/index.cjs");

export default [
  {
    files: ["src/**/*.js", "bindings/js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {},
  },
  // T-09 — no-loose-escape-handler.
  // Warn everywhere the artifact substrate can be consumed. Files inside
  // site/apps/hello-surface/artifact/** are excluded by the rule itself
  // (the frame owns the Escape stack).
  {
    files: [
      "site/**/*.{js,jsx}",
      "bindings/js/**/*.{js,jsx}",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "sakura-artifact": artifactRules },
    rules: {
      "sakura-artifact/no-loose-escape-handler": "warn",
    },
  },
];
