/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

module.exports = {
    preset: 'react-native',
    setupFilesAfterEnv: [
        '@testing-library/jest-native/extend-expect',
        '<rootDir>/jest.setup.ts',
    ],
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
    },
    transformIgnorePatterns: [],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@components/(.*)$': '<rootDir>/src/components/$1',
        '^@providers/(.*)$': '<rootDir>/src/providers/$1',
        '^@routes/(.*)$': '<rootDir>/src/routes/$1',
        '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
        '^@constants/(.*)$': '<rootDir>/src/constants/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@layouts/(.*)$': '<rootDir>/src/layouts/$1',
        '^@theme/(.*)$': '<rootDir>/src/theme/$1',
        '^@assets/(.*)$': '<rootDir>/assets/$1',
        '^@test-utils/(.*)$': '<rootDir>/src/test-utils/$1',
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
        '!src/**/__mocks__/**',
        '!src/**/__fixtures__/**',
        '!src/**/*.test.{ts,tsx}',
        '!src/**/*.spec.{ts,tsx}',
        '!src/**/index.ts',
        '!src/test-utils/**',
        '!src/**/*.style.ts',
        '!src/**/*.styles.ts',
        '!src/**/styles.ts',
        '!src/**/theme.ts',
        '!src/components/webview/injected-scripts.ts',
        '!src/bootstrap/*',
        'src/hooks/async-action.ts',
        'src/hooks/chart-interaction.ts',
        'src/hooks/deeplink.ts',
        'src/hooks/language.ts',
        'src/hooks/modal-state.ts',
        'src/hooks/onboarding.ts',
        'src/hooks/search.ts',
        'src/hooks/theme.ts',
        'src/hooks/toast.ts',
        'src/hooks/webview.ts',
        '!src/constants/ui.ts',
        '!src/wdyr.ts',
    ],
    coverageReporters: ['text', 'html', 'lcov'],
    coverageDirectory: './coverage',
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90,
        },
    },
}
