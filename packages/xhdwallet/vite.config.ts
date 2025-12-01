import { defineConfig } from 'vite'
import path from 'node:path'
import { builtinModules } from 'node:module'
import pkg from './package.json' assert { type: 'json' }

const { dependencies = {}, peerDependencies = {} } = pkg as {
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
}

const directDependencies = [
    ...Object.keys(dependencies),
    ...Object.keys(peerDependencies),
]

const nodeExternals = Array.from(
    new Set([...builtinModules, ...builtinModules.map(mod => `node:${mod}`)]),
)

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            formats: ['es', 'cjs'],
            name: '@perawallet/wallet-core-xhdwallet',
            fileName: format => `index.${format}.js`,
        },
        rollupOptions: {
            external: [...directDependencies, ...nodeExternals],
        },
        emptyOutDir: false,
        sourcemap: true,
        target: 'esnext',
    },
})
