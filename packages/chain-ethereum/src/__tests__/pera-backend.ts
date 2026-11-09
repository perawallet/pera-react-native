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

import {
    isEvmChainId,
    type ChainScope,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import type * as ConfigModule from '@perawallet/wallet-core-config'

export const PERA_URL = 'https://pera.test'
export const TEST_API_KEY = 'test-api-key'
/** What `vitest.setup.ts` makes `buildIntegrityHeaders` send. */
export const TEST_INTEGRITY_TOKEN = 'test-integrity-token'

/**
 * A config-module mock giving every EVM scope a Pera deployment, both
 * deployments the test host, serving block following, assets, prices,
 * history and `extraServices`, and the client an API key, for specs reaching
 * it through queryClient. The real config can't see these deployments, so an
 * EVM scope's refusal is tracked here, as config tracks the others:
 * `vi.mock('@perawallet/wallet-core-config', async original =>
 * (await import('./pera-backend')).withEthereumPeraBackend(original))`.
 */
export const withEthereumPeraBackend = async (
    importOriginal: () => Promise<typeof ConfigModule>,
    extraServices: readonly string[] = [],
): Promise<typeof ConfigModule> => {
    const actual = await importOriginal()
    const keyOf = ({ chainId, networkId }: ChainScope) =>
        `${chainId}/${networkId}`
    const deploymentOf = (scope: ChainScope): WalletMode =>
        scope.networkId === 'mainnet' ? 'live' : 'developer'
    const refused = new Set<string>()
    const served = new Map<WalletMode, ReadonlySet<string>>()
    const isEvmScopeRefused = (scope: ChainScope): boolean => {
        const listed = served.get(deploymentOf(scope))
        return (
            refused.has(keyOf(scope)) ||
            (listed !== undefined && !listed.has(keyOf(scope)))
        )
    }
    return {
        ...actual,
        config: { ...actual.config, backendAPIKey: TEST_API_KEY },
        getPeraServicesConfig: scope =>
            isEvmChainId(scope.chainId)
                ? {
                      ...actual.getPeraServicesConfig(scope),
                      backendUrl: PERA_URL,
                  }
                : actual.getPeraServicesConfig(scope),
        getPeraDeploymentConfig: deployment => ({
            ...actual.getPeraDeploymentConfig(deployment),
            backendUrl: PERA_URL,
        }),
        peraDeploymentOf: scope =>
            isEvmChainId(scope.chainId)
                ? deploymentOf(scope)
                : actual.peraDeploymentOf(scope),
        isPeraScopeRefused: scope =>
            isEvmChainId(scope.chainId)
                ? isEvmScopeRefused(scope)
                : actual.isPeraScopeRefused(scope),
        markPeraScopeRefused: scope => {
            if (isEvmChainId(scope.chainId)) refused.add(keyOf(scope))
            else actual.markPeraScopeRefused(scope)
        },
        setPeraServedScopes: (deployment, scopes) => {
            served.set(deployment, new Set(scopes.map(keyOf)))
            actual.setPeraServedScopes(deployment, scopes)
        },
        resetPeraScopeRefusals: () => {
            refused.clear()
            served.clear()
            actual.resetPeraScopeRefusals()
        },
        hasPeraService: (scope, service) =>
            isEvmChainId(scope.chainId)
                ? !isEvmScopeRefused(scope) &&
                  [
                      'blockFollowing',
                      'assets',
                      'prices',
                      'history',
                      ...extraServices,
                  ].includes(service)
                : actual.hasPeraService(scope, service),
    }
}
