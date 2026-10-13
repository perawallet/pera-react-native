import { defineConfig } from 'vite'
import { resolve } from 'path'
import { defineLibraryConfig } from '@perawallet/wallet-core-devtools/vite/library'

export default defineConfig(
    defineLibraryConfig({
        root: __dirname,
        entry: resolve(__dirname, 'src/index.ts'),
        fileName: 'index',
    }),
)
