module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
  },
  plugins: ["@typescript-eslint", "simple-import-sort", "import"],
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    "sort-imports": "off",
    "import/order": "off",
    "import/export": "off",
    "import/first": "warn",
    "import/newline-after-import": "warn",
    "import/no-extraneous-dependencies": "warn",
    "import/no-duplicates": "warn",
    "simple-import-sort/imports": "warn",
    "simple-import-sort/exports": "warn",
    "@typescript-eslint/consistent-type-imports": "warn",
    curly: "error",
  },
  globals: {
    process: "readonly",
  },
};
