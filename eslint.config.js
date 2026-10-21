// https://docs.expo.dev/guides/using-eslint/
// Run with: npm run lint
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "functions/*"],
  },
  {
    rules: {
      // Errors are reserved for real bugs (undefined variables, bad imports,
      // broken hook calls). The rest are shown as warnings.

      // Web-only rule: apostrophes/quotes in <Text> are fine in React Native.
      "react/no-unescaped-entities": "off",
      // Many `catch (e) {}` blocks intentionally ignore the error.
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      // React Compiler guidance: useful hints, not bugs in this codebase.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);
