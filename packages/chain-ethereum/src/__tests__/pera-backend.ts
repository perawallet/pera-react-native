/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type * as ConfigModule from '@perawallet/wallet-core-config'

export const PERA_URL = 'https://pera.test'
export const TEST_API_KEY = 'test-api-key'
/** What `vitest.setup.ts` makes `buildIntegrityHeaders` send. */
export const TEST_INTEGRITY_TOKEN = 'test-integrity-token'

/**
 * A config-module mock giving every Ethereum scope a Pera deployment that
 * serves block following, assets and prices, and the client an API key, for
 * specs reaching it through queryClient:
 * `vi.mock('@perawallet/wallet-core-config', async original =>
 * (await import('./pera-backend')).withEthereumPeraBackend(original))`.
 */
export const withEthereumPeraBackend = async (
    importOriginal: () => Promise<typeof ConfigModule>,
): Promise<typeof ConfigModule> => {
    const actual = await importOriginal()
    return {
        ...actual,
        config: { ...actual.config, backendAPIKey: TEST_API_KEY },
        getPeraServicesConfig: scope =>
            scope.chainId === 'ethereum'
                ? {
                      ...actual.getPeraServicesConfig(scope),
                      backendUrl: PERA_URL,
                  }
                : actual.getPeraServicesConfig(scope),
        hasPeraService: (scope, service) =>
            scope.chainId === 'ethereum'
                ? ['blockFollowing', 'assets', 'prices'].includes(service)
                : actual.hasPeraService(scope, service),
    }
}
