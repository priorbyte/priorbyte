/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['../.eslintrc.base.cjs'],
  parserOptions: { ecmaFeatures: { jsx: true } },
};
