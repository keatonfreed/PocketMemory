module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:react-hooks/recommended'],
  settings: { react: { version: 'detect' } },
  rules: { 'react/jsx-uses-vars': 'error', 'react/jsx-uses-react': 'error', 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] },
  ignorePatterns: ['node_modules/', 'dist/', 'ios/', 'ai/editor/', 'ai/data/', 'ai/exports/'],
}
