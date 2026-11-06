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

import { useMemo } from 'react'
import { preferDefaultChain } from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    useChainCapabilityCheck,
    useSelectedScopes,
} from '@perawallet/wallet-core-chain-shared'
import {
    nameServiceOf,
    useNameResolutionQuery,
} from '@perawallet/wallet-core-nfd'
import {
    type Optional,
    useDebouncedValue,
} from '@perawallet/wallet-core-shared'
import { SEARCH_DEBOUNCE_TIME } from '@constants/ui'

type UseNameResolveResult = {
    /** The input when a registered chain's codec accepts it, otherwise the name-resolved address (or empty string). */
    resolvedAddress: string
    /** Whether a registered chain's codec accepts the input as an address. */
    isDirectAddress: boolean
    /** Whether the input was successfully resolved via a name lookup. */
    isNameResolved: boolean
    /** Whether a name lookup is currently in flight. */
    isNameResolving: boolean
    /** The matching name, if one was resolved. */
    resolvedName: Optional<string>
}

/**
 * Resolves a typed name through Pera's backend, one search per name service:
 * on the scope of the chain `preferDefaultChain` picks among the `chainIds`
 * that share it. Nothing here reads a node, so the address is the backend's
 * word; only a send checks it on-chain.
 */
export const useNameResolve = (
    input: string,
    chainIds: readonly ChainId[],
    options?: { enabled?: boolean },
): UseNameResolveResult => {
    const enabled = options?.enabled ?? true
    const debouncedInput = useDebouncedValue(input, SEARCH_DEBOUNCE_TIME)
    const isDirectAddress = addressCodecs
        .list()
        .some(codec => codec.isValid(input))

    const check = useChainCapabilityCheck()
    const capableScopes = useSelectedScopes(
        chainIds.filter(chainId =>
            check({ chain: { chainId, capability: 'nameService' } }),
        ),
    )
    const searchScopes = useMemo(() => {
        const byService = new Map<string, ChainScope[]>()
        for (const scope of capableScopes) {
            const service = nameServiceOf(scope)
            byService.set(service, [...(byService.get(service) ?? []), scope])
        }
        return [...byService.values()].map(group => {
            const ids = group.map(scope => scope.chainId)
            return group[ids.indexOf(preferDefaultChain(ids) ?? ids[0])]
        })
    }, [capableScopes])

    const { data: match, isLoading: isNameResolving } = useNameResolutionQuery(
        searchScopes,
        debouncedInput,
        {
            enabled:
                enabled && debouncedInput.includes('.') && !isDirectAddress,
        },
    )

    return {
        resolvedAddress: isDirectAddress ? input : (match?.address ?? ''),
        isDirectAddress,
        isNameResolved: !isDirectAddress && !!match,
        isNameResolving,
        resolvedName: match?.name,
    }
}
