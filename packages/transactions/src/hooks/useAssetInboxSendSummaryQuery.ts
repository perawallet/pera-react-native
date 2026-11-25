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

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'
import {
    sendFlowFeatureFor,
    type AssetInboxSendSummary,
} from '../chain-adapter'
import { InvalidSendParamsError } from '../errors'
import { getAssetInboxSendSummaryQueryKey } from './querykeys'

export type UseAssetInboxSendSummaryQueryResult = {
    data: Maybe<AssetInboxSendSummary>
    isLoading: boolean
    isError: boolean
    error: Nullable<Error>
    /** True when the chain's active network has no inbox backend: this can never succeed here. */
    isUnavailableOnNetwork: boolean
    refresh: () => void
}

export const useAssetInboxSendSummaryQuery = (
    scope: ChainScope,
    sender: string,
    receiver: string,
    assetId: string,
    amount?: bigint,
): UseAssetInboxSendSummaryQueryResult => {
    const isUnavailableOnNetwork = !useChainCapability(
        scope.chainId,
        'assetInbox',
    )

    const enabled =
        !!sender &&
        !!receiver &&
        !!assetId &&
        amount !== undefined &&
        !isUnavailableOnNetwork
    const query = useQuery({
        queryKey: getAssetInboxSendSummaryQueryKey(
            sender,
            receiver,
            assetId,
            scope,
            amount,
        ),
        queryFn: (): Promise<AssetInboxSendSummary> => {
            if (amount === undefined) throw new InvalidSendParamsError()
            return sendFlowFeatureFor(scope, 'assetInbox').fetchSendSummary({
                scope,
                sender,
                receiver,
                assetId,
                amount,
            })
        },
        enabled,
    })
    const { refetch } = query
    const refresh = useCallback(() => {
        if (enabled) void refetch()
    }, [enabled, refetch])

    return {
        data: query.data,
        isLoading: isUnavailableOnNetwork ? false : query.isLoading,
        isError: query.isError,
        error: query.error,
        isUnavailableOnNetwork,
        refresh,
    }
}
