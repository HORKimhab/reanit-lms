import nextPlugin from "@next/eslint-plugin-next";
import base from "@reanit/config/eslint";

export default [
  ...base,
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@reanit/db", "@reanit/db/*"],
              message: "apps/web reaches data through apps/api: use getApi() from @/server/api.",
            },
          ],
        },
      ],
    },
  },
];
