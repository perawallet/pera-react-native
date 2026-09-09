import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    plugins: [],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            formats: ['es'],
            fileName: 'index',
        },
        rollupOptions: {
            external: [
                // Aliased to react-native-quick-crypto by the app's bundler;
                // bundling it here stubs the module out to `{}`.
                'crypto',
                'react',
                'react/jsx-runtime',
                'zustand',
                '@algorandfoundation/algokit-utils',
                '@algorandfoundation/xhd-wallet-api',
                'algosdk',
                '@noble/hashes',
                '@noble/hashes/hkdf.js',
                '@noble/hashes/hmac.js',
                '@noble/hashes/sha2.js',
                '@noble/hashes/utils.js',
                '@perawallet/wallet-core-accounts',
                '@perawallet/wallet-core-blockchain',
                '@perawallet/wallet-core-config',
                '@perawallet/wallet-core-contacts',
                '@perawallet/wallet-core-device',
                '@perawallet/wallet-core-kms',
                '@perawallet/wallet-core-shared',
                '@perawallet/wallet-extension-provider',
                '@scure/bip39',
                '@scure/bip39/wordlists/english.js',
                '@tanstack/react-query',
                'tweetnacl',
                'zod',
            ],
        },
    },
})
