// Shared flat config. Packages re-export it from their own eslint.config.js.
import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/.next/**", "**/.turbo/**", "**/node_modules/**", "**/next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  // Every named function gets a full JSDoc block (quality.md). Inline callbacks are exempt.
  {
    files: ["**/*.{ts,tsx}"],
    ...jsdoc.configs["flat/recommended-typescript-error"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: false,
          require: {
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            ClassExpression: true,
            FunctionDeclaration: true,
            FunctionExpression: true,
            MethodDefinition: true,
          },
          checkConstructors: false,
        },
      ],
      "jsdoc/require-description": "error",
      "jsdoc/require-throws": "error",
      "jsdoc/require-returns": ["error", { checkGetters: true }],
      "jsdoc/require-param": ["error", { checkDestructured: true, checkDestructuredRoots: true }],
      "jsdoc/check-param-names": ["error", { checkDestructured: true }],
      "jsdoc/tag-lines": ["error", "any", { startLines: 1 }],
    },
  },
);
