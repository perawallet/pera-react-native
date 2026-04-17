export const COVERAGE_THRESHOLD = 80

export const coverageConfig = {
    provider: 'v8',
    all: true,
    include: ['src/**/*.{ts,tsx}'],
    exclude: [
        'src/api/generated/**',
        'src/**/*.d.ts',
        'src/**/*.generated.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/__mocks__/**',
        'src/**/__fixtures__/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/index.ts',
        'src/**/constants.ts',
        'src/**/errors.ts',
        'src/models/**',
        'src/test-utils/**',
    ],
    reporter: ['text', 'html', 'lcov'],
    reportsDirectory: './coverage',
    thresholds: {
        branches: COVERAGE_THRESHOLD,
        functions: COVERAGE_THRESHOLD,
        lines: COVERAGE_THRESHOLD,
        statements: COVERAGE_THRESHOLD,
    },
}
