import base from "@reanit/config/eslint";

export default [
  ...base,
  {
    // Lets consistent-type-imports keep value imports that decorator metadata needs at runtime.
    languageOptions: { parserOptions: { experimentalDecorators: true, emitDecoratorMetadata: true } },
  },
];
