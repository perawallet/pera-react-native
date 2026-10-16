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
import type {
    ChainScope,
    FeeEstimate,
    FeePreset,
} from '@perawallet/wallet-core-chain-contract'
import {
    plannerChainAdapters,
    useMinFeeForSender,
} from '@perawallet/wallet-core-signing'
import { useTransferFeeEstimateQuery } from '@perawallet/wallet-core-transactions'
import type { Optional } from '@perawallet/wallet-core-shared'

type UseSendFeeParams = {
    scope: ChainScope
    senderAddress: Optional<string>
    assetId: Optional<string>
    /** Unknown before the receiver is picked; the sender stands in to price the call. */
    recipient?: string
    /** Base units of the sent asset; unknown before the amount is entered. */
    amount?: Decimal
    feePreset: FeePreset
}

export type UseSendFeeResult = {
    /** Base units of the native asset: the expected cost at `feePreset`. */
    feeAmount: Optional<Decimal>
    /** Base units of the native asset: the most the send can be charged, which balances must cover. */
    maxFeeAmount: Optional<Decimal>
    /** Set on a chain that prices speeds. */
    presets: FeeEstimate['presets']
    isPending: boolean
}

const ZERO = new Decimal(0)

/**
 * A chain with a fee planner keeps its PQ-aware minimum fee, the one its send
 * build applies; any other chain is priced by its transfer adapter.
 */
export const useSendFee = ({
    scope,
    senderAddress,
    assetId,
    recipient,
    amount,
    feePreset,
}: UseSendFeeParams): UseSendFeeResult => {
    const hasPlanner = plannerChainAdapters.has(scope.chainId)
    const { minFee, isPending: isMinFeePending } = useMinFeeForSender(
        senderAddress,
        scope.chainId,
    )

    const estimateInput = useMemo(
        () =>
            !hasPlanner && senderAddress && assetId
                ? {
                      intent: {
                          kind: 'transfer' as const,
                          from: senderAddress,
                          to: recipient ?? senderAddress,
                          assetRef: { chainId: scope.chainId, assetId },
                          amount: amount ?? ZERO,
                      },
                      scope,
                  }
                : undefined,
        [hasPlanner, senderAddress, assetId, recipient, amount, scope],
    )
    const { data: estimate, isPending: isEstimatePending } =
        useTransferFeeEstimateQuery(estimateInput)

    return useMemo(() => {
        if (hasPlanner) {
            const fee =
                minFee !== undefined
                    ? new Decimal(minFee.toString())
                    : undefined
            return {
                feeAmount: fee,
                maxFeeAmount: fee,
                presets: undefined,
                isPending: isMinFeePending,
            }
        }
        const preset = estimate?.presets?.[feePreset]
        return {
            feeAmount: preset?.amount ?? estimate?.amount,
            maxFeeAmount: preset?.maxAmount ?? estimate?.amount,
            presets: estimate?.presets,
            isPending: isEstimatePending,
        }
    }, [
        hasPlanner,
        minFee,
        isMinFeePending,
        estimate,
        feePreset,
        isEstimatePending,
    ])
}
