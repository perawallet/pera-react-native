import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
	resolve: {
		alias: {
			'@services': resolve(__dirname, 'src/services'),
			'@store': resolve(__dirname, 'src/store'),
			'@api': resolve(__dirname, 'src/api'),
			'@platform': resolve(__dirname, 'src/platform'),
			'@test-utils': resolve(__dirname, 'src/test-utils'),
			config: resolve(__dirname, 'src/config'),
		},
	},
	test: {
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		environment: 'jsdom',
		coverage: {
			provider: 'v8',
			all: true,
			include: ['src/**/*.{ts,tsx}'],
			exclude: [
				'src/api/generated/**',
				'src/**/*.d.ts',
				'src/**/__tests__/**',
				'src/**/__mocks__/**',
				'src/**/__fixtures__/**',
				'src/**/*.test.{ts,tsx}',
				'src/**/*.spec.{ts,tsx}',
				'src/**/index.ts',
				'src/test-utils/**',
			],
			reporter: ['text', 'html', 'lcov'],
			reportsDirectory: './coverage',
		},
	},
})
