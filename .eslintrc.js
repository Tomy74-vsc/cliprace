module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "plugin:@typescript-eslint/recommended", "plugin:tailwindcss/recommended"],
  plugins: ["tailwindcss", "@typescript-eslint"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: [
      "./tsconfig.json",
      "./tsconfig.admin.json",
      "./tsconfig.tests.json",
    ],
    tsconfigRootDir: __dirname,
  },
  rules: {
    "tailwindcss/no-custom-classname": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/ban-types": "off",
    "react/no-unescaped-entities": "off",
  },
  settings: {
    tailwindcss: {
      callees: ["cn", "clsx"],
    },
  },
  ignorePatterns: [
    "node_modules/",
    ".next/",
    "dist/",
    "build/",
    "eslint.config.mjs",
    "tests/verify/",
    "tests/messaging.test.ts",
    "src/functions/",
    "src/lib/animations.ts",
    ".eslintrc.js",
    "next.config.js",
    "postcss.config.js",
    "tailwind.config.js",
    "scripts/"
  ],
  overrides: [
    {
      files: ["src/app/admin/**/*.tsx"],
      rules: {
        "react/no-unescaped-entities": "off",
      },
    },
    {
      files: ["tests/**/*.ts", "tests/**/*.tsx"],
      rules: {
        "react/no-unescaped-entities": "off",
      },
    },
  ],
};
