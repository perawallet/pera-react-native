import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: 'react-native', replacement: 'react-native-web' },
      { find: /\.svg$/, replacement: path.resolve(__dirname, './__mocks__/svgMock.js') },
      { find: '@components', replacement: path.resolve(__dirname, './src/components') },
      { find: '@modules', replacement: path.resolve(__dirname, './src/modules') },
      { find: '@hooks', replacement: path.resolve(__dirname, './src/hooks') },
      { find: '@constants', replacement: path.resolve(__dirname, './src/constants') },
      { find: '@theme', replacement: path.resolve(__dirname, './src/theme') },
      { find: '@providers', replacement: path.resolve(__dirname, './src/providers') },
      { find: '@routes', replacement: path.resolve(__dirname, './src/routes') },
      { find: '@assets', replacement: path.resolve(__dirname, './assets') },
      { find: '@layouts', replacement: path.resolve(__dirname, './src/layouts') },
      { find: '@test-utils', replacement: path.resolve(__dirname, './src/test-utils') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@perawallet/wallet-core-shared', replacement: path.resolve(__dirname, '../../packages/shared/src') },
      { find: '@perawallet/wallet-core-platform-integration', replacement: path.resolve(__dirname, '../../packages/platform-integration/src') },
      { find: '@perawallet/wallet-core-accounts', replacement: path.resolve(__dirname, '../../packages/accounts/src') },
      { find: '@perawallet/wallet-core-assets', replacement: path.resolve(__dirname, '../../packages/assets/src') },
      { find: '@perawallet/wallet-core-blockchain', replacement: path.resolve(__dirname, '../../packages/blockchain/src') },
      { find: '@perawallet/wallet-core-config', replacement: path.resolve(__dirname, '../../packages/config/src') },
      { find: '@tanstack/query-core', replacement: path.resolve(__dirname, './node_modules/@tanstack/query-core') },
      { find: 'stacktrace-js', replacement: path.resolve(__dirname, './node_modules/stacktrace-js') }
    ],
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.d.ts'],
    preserveSymlinks: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    server: {
      deps: {
        inline: [
          'react-native',
          'react-native-web',
          /@react-native/,

          'react-native-reanimated',
          'react-native-gesture-handler',
          '@rneui/themed',
          '@rneui/base',
          'react-native-vector-icons',
          'react-native-notifier',
          /@react-native-firebase/,
          /@perawallet/,
        ]
      }
    }
  }
})
