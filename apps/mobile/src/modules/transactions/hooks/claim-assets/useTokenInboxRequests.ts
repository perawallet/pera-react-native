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
import { Decimal } from 'decimal.js'
import {
    assetFromHoldingLiteRow,
    useTokenInboxQuery,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { AssetInboxRequest } from '@perawallet/wallet-core-transactions'

export type UseTokenInboxRequestsResult = {
    data: AssetInboxRequest[]
    isPending: boolean
}

const ZERO = new Decimal(0)

/**
 * The address's inbox tokens on a chain that receives them unasked, shaped as
 * asset inbox requests so the inbox screens list them. Accepting or rejecting
 * one is a local choice: no transaction, no fee and no sender to name. Off
 * while `address` is null.
 */
export const useTokenInboxRequests = (
    scope: ChainScope,
    address: Nullable<string>,
): UseTokenInboxRequestsResult => {
    const sources = useMemo(
        () => (address ? [{ address, scope }] : []),
        [address, scope],
    )
    const { holdings, isPending } = useTokenInboxQuery(sources)
    const data = useMemo(
        () =>
            holdings.flatMap((row): AssetInboxRequest[] => {
                const asset = assetFromHoldingLiteRow(row, scope.chainId)
                if (!asset) return []
                return [
                    {
                        inboxAddress: null,
                        totalAmount: row.amount,
                        asset,
                        usdValue: row.usdPrice,
                        nativeGainOnClaim: ZERO,
                        nativeGainOnReject: ZERO,
                        senders: { count: 0, results: [] },
                        insufficientNativeForClaiming: false,
                        insufficientNativeForRejecting: false,
                        shouldUseFundsBeforeClaiming: false,
                        shouldUseFundsBeforeRejecting: false,
                    },
                ]
            }),
        [holdings, scope.chainId],
    )
    return { data, isPending }
}
