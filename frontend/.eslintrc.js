/* eslint-env node */
module.exports = {
  root: true,
  env: {
    es2021: true,
  },
  settings: {
    'import/resolver': {
      typescript: {},
    },
  },
  plugins: ['simple-import-sort', 'import'],
  extends: [
    'plugin:vue/vue3-recommended',
    'plugin:vue/vue3-strongly-recommended',
    'eslint:recommended',
    '@vue/eslint-config-typescript/recommended',
    '@vue/eslint-config-prettier',
  ],
  parserOptions: {
    ecmaVersion: 2021,
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'sort-imports': 'off',
    'import/order': 'off',
    'import/export': 'off',
    'import/first': 'warn',
    'import/newline-after-import': 'warn',
    'import/no-extraneous-dependencies': 'warn',
    'import/no-duplicates': 'warn',
    'simple-import-sort/imports': 'warn',
    'simple-import-sort/exports': 'warn',
    'vue/multi-word-component-names': 'off',
  },
  globals: {
    defineProps: 'readonly',
    defineEmits: 'readonly',
    defineExpose: 'readonly',
    withDefaults: 'readonly',
  },
};
