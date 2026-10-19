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

import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSyncService } from '@perawallet/wallet-core-background'
import {
    queryKeyReferencesScope,
    type ChainId,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import {
    getChainDescriptor,
    nodeEndpointAdapters,
    selectEndpointOverride,
    useNetworkStore,
    type NodeEndpointAdapter,
} from '@perawallet/wallet-core-chain-shared'
import { endpointHostOf } from './endpointHostOf'
import { isValidEndpoint } from './isValidEndpoint'

export type EndpointOverrideSheetError =
    | 'invalid-url'
    | 'wrong-network'
    | 'unreachable'

export type UseEndpointOverrideSheetParams = {
    chainId: ChainId
    networkId: NetworkId
}

export type UseEndpointOverrideSheetResult = {
    url: string
    error: EndpointOverrideSheetError | undefined
    isChecking: boolean
    hasOverride: boolean
    currentHost: string | undefined
    networkName: string
    handleUrlChange: (value: string) => void
    handleSave: () => Promise<boolean>
    handleReset: () => void
}

const adapterFor = (chainId: ChainId): NodeEndpointAdapter | undefined =>
    nodeEndpointAdapters.has(chainId)
        ? nodeEndpointAdapters.get(chainId)
        : undefined

/**
 * Each open is a fresh mount, so the draft seeds once from the saved override.
 * Cached rows are only invalidated, not cleared: the check guarantees the new
 * node serves the same network, so what they hold is still true.
 */
export const useEndpointOverrideSheet = ({
    chainId,
    networkId,
}: UseEndpointOverrideSheetParams): UseEndpointOverrideSheetResult => {
    const override = useNetworkStore(state =>
        selectEndpointOverride(state, chainId, networkId),
    )
    const setEndpointOverride = useNetworkStore(
        state => state.setEndpointOverride,
    )
    const clearEndpointOverride = useNetworkStore(
        state => state.clearEndpointOverride,
    )
    const queryClient = useQueryClient()
    const [url, setUrl] = useState(() => override ?? '')
    const [error, setError] = useState<EndpointOverrideSheetError>()
    const [isChecking, setIsChecking] = useState(false)

    const networkName = useMemo(() => {
        const descriptor = getChainDescriptor(chainId)
        const network = descriptor.networks.find(n => n.id === networkId)
        return `${descriptor.displayName} ${network?.displayName ?? networkId}`
    }, [chainId, networkId])

    // Re-read on every render so the caption follows a save or reset.
    const currentHost = endpointHostOf(adapterFor(chainId)?.endpointUrl(networkId))

    const refreshScope = useCallback(() => {
        void queryClient.invalidateQueries({
            predicate: query =>
                queryKeyReferencesScope(query.queryKey, { chainId, networkId }),
        })
        try {
            getSyncService().restart()
        } catch {
            // SyncService not yet initialized
        }
    }, [queryClient, chainId, networkId])

    const handleUrlChange = useCallback((value: string) => {
        setUrl(value)
        setError(undefined)
    }, [])

    const handleSave = useCallback(async (): Promise<boolean> => {
        const candidate = url.trim()
        if (!isValidEndpoint(candidate)) {
            setError('invalid-url')
            return false
        }
        const adapter = adapterFor(chainId)
        if (!adapter?.checkOverride) {
            return false
        }

        setIsChecking(true)
        try {
            const result = await adapter.checkOverride(networkId, candidate)
            if (result !== 'matches') {
                setError(result)
                return false
            }
        } finally {
            setIsChecking(false)
        }

        setEndpointOverride(chainId, networkId, candidate)
        refreshScope()
        return true
    }, [url, chainId, networkId, setEndpointOverride, refreshScope])

    const handleReset = useCallback(() => {
        clearEndpointOverride(chainId, networkId)
        refreshScope()
    }, [clearEndpointOverride, chainId, networkId, refreshScope])

    return {
        url,
        error,
        isChecking,
        hasOverride: override !== undefined,
        currentHost,
        networkName,
        handleUrlChange,
        handleSave,
        handleReset,
    }
}
