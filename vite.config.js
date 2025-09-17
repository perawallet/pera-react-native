// vite.config.js
const path = require('path')
const { defineConfig } = require('vite')

module.exports = defineConfig({
  build: {
    "packages/core": {
      entry: path.resolve(__dirname, 'packages/core/src/index.ts'),
      name: 'MyLib',
      fileName: (format) => `perawallet-core.${format}.js`
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ['react'],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          react: 'react'
        }
      }
    }
  }
})