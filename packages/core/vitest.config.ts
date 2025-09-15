import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		environment: 'node',
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
			],
			reporter: ['text', 'html', 'lcov'],
			reportsDirectory: './coverage',
		},
	},
})
