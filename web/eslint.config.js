import { defineConfig } from 'eslint/config'
import tsPrefixer from 'eslint-config-ts-prefixer'
import reactHooks from 'eslint-plugin-react-hooks'

export default defineConfig([
  {
    ignores: [
      '**/node_modules',
      '**/build',
      '**/dist',
      'site/public',
      'sw.js',
      'test_web.mjs',
    ],
  },
  {
    plugins: {
      'react-hooks': reactHooks,
    },

    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  ...tsPrefixer,
  {
    rules: {
      // `x == null` is the deliberate test for null or undefined
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
])
