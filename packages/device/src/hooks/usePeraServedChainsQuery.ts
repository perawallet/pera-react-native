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

import { useQuery } from '@tanstack/react-query'
import {
    canCallIntegrityGuardedRoute,
    useAppIntegrityStore,
} from '@perawallet/wallet-core-app-integrity'
import type {
    ChainRegistry,
    ChainScope,
    WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import { useWalletDeployment } from '@perawallet/wallet-core-chain-shared'
import {
    peraDeploymentOf,
    setPeraServedScopes,
} from '@perawallet/wallet-core-config'
import { logger } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { fetchPeraServedChainIds } from './chainsEndpoints'

const PERA_SERVED_CHAINS_QUERY_KEY = ['pera-served-chains'] as const

export const getPeraServedChainsQueryKey = (
    deployment: WalletMode,
): readonly ['pera-served-chains', WalletMode] =>
    [...PERA_SERVED_CHAINS_QUERY_KEY, deployment] as const

/** The registered scopes `caip2Ids` names on `deployment`; ids naming anything else are dropped. */
export const toServedScopes = (
    caip2Ids: readonly string[],
    chains: Pick<ChainRegistry, 'byCaip2'>,
    deployment: WalletMode,
): ChainScope[] =>
    caip2Ids.flatMap(caip2 => {
        const match = chains.byCaip2(caip2)
        if (!match) return []
        const scope = { chainId: match.chainId, networkId: match.network.id }
        return peraDeploymentOf(scope) === deployment ? [scope] : []
    })

const scopeKey = ({ chainId, networkId }: ChainScope): string =>
    `${chainId}/${networkId}`

// Info, not warn: switching a chain off is a normal backend decision. The
// unrecognised ids sit beside it so a misspelt id that drops a chain is legible.
const logSwitchedOffScopes = (
    caip2Ids: readonly string[],
    served: readonly ChainScope[],
    chains: Pick<ChainRegistry, 'byCaip2' | 'list'>,
    deployment: WalletMode,
): void => {
    const servedKeys = new Set(served.map(scopeKey))
    const registered = toServedScopes(
        chains
            .list()
            .flatMap(chain =>
                chain.networks.flatMap(({ caip2 }) => (caip2 ? [caip2] : [])),
            ),
        chains,
        deployment,
    )
    const switchedOff = registered
        .map(scopeKey)
        .filter(key => !servedKeys.has(key))
    if (switchedOff.length === 0) return
    logger.info('Pera chain list switches networks off', {
        deployment,
        switchedOff,
        unrecognisedChainIds: caip2Ids.filter(id => !chains.byCaip2(id)),
    })
}

export type UsePeraServedChainsQueryResult = {
    servedScopes: readonly ChainScope[]
    isFetched: boolean
}

/**
 * Reads the wallet deployment's chain list once per launch and hands it to
 * config, which refuses every registered scope of that deployment the list
 * leaves out. A failed read gates nothing.
 */
export const usePeraServedChainsQuery = (): UsePeraServedChainsQueryResult => {
    const deployment = useWalletDeployment()
    // The route is integrity-guarded and production boots without a token, so
    // a read at mount is certain to fail; wait for the attestation to land.
    const canCall = useAppIntegrityStore(() => canCallIntegrityGuardedRoute())
    const query = useQuery({
        queryKey: getPeraServedChainsQueryKey(deployment),
        queryFn: async (): Promise<ChainScope[]> => {
            const ids = await fetchPeraServedChainIds(deployment)
            const { chains } = getProvider()
            const scopes = toServedScopes(ids, chains, deployment)
            // A list naming none of our scopes is a broken registry, not
            // every chain switched off.
            if (scopes.length === 0) {
                logger.warn('Pera chain list names none of our networks', {
                    deployment,
                    chainIds: ids,
                })
                return scopes
            }
            setPeraServedScopes(deployment, scopes)
            logSwitchedOffScopes(ids, scopes, chains, deployment)
            return scopes
        },
        enabled: canCall,
        staleTime: Infinity,
    })
    return {
        servedScopes: query.data ?? [],
        isFetched: query.isFetched,
    }
}
