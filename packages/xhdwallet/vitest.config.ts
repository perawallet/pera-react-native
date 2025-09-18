import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)

export default defineConfig({
	test: {
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		environment: 'jsdom',
		coverage: {
			provider: 'v8',
			all: true,
			include: ['src/**/*.{ts,tsx}'],
			exclude: [
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
