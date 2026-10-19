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
import { useMinFeeForSender } from '@perawallet/wallet-core-signing'
import type { Optional } from '@perawallet/wallet-core-shared'
import { sendFlowChainAdapters } from '../chain-adapter'
import { useTransferFeeEstimateQuery } from './useTransferFeeEstimateQuery'

export type SendFeeQueryInput = {
    scope: ChainScope
    senderAddress: Optional<string>
    assetId: Optional<string>
    /** Unknown before the receiver is picked; the sender stands in to price the call. */
    recipient?: string
    /** Base units of the sent asset; unknown before the amount is entered. */
    amount?: Decimal
    feePreset: FeePreset
}

export type UseSendFeeQueryResult = {
    /** Base units of the native asset: the expected cost at `feePreset`. */
    feeAmount: Optional<Decimal>
    /** Base units of the native asset: the most the send can be charged, which balances must cover. */
    maxFeeAmount: Optional<Decimal>
    /** Set on a chain that prices speeds. */
    presets: FeeEstimate['presets']
    isPending: boolean
    /** The estimate failed: the fee is unknown, never zero. */
    isError: boolean
}

const ZERO = new Decimal(0)

/**
 * The fee a send will be built with. It picks its path with the same check
 * `useTransactionSendFlow` builds with: a chain with a send-flow adapter keeps
 * its PQ-aware minimum fee, and any other chain is priced by its transfer
 * adapter.
 */
export const useSendFeeQuery = ({
    scope,
    senderAddress,
    assetId,
    recipient,
    amount,
    feePreset,
}: SendFeeQueryInput): UseSendFeeQueryResult => {
    const hasSendFlow = sendFlowChainAdapters.has(scope.chainId)
    const { minFee, isPending: isMinFeePending } = useMinFeeForSender(
        senderAddress,
        scope.chainId,
    )

    const estimateInput = useMemo(
        () =>
            !hasSendFlow && senderAddress && assetId
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
        [hasSendFlow, senderAddress, assetId, recipient, amount, scope],
    )
    const {
        data: estimate,
        isPending: isEstimatePending,
        isError: isEstimateError,
    } = useTransferFeeEstimateQuery(estimateInput)

    return useMemo(() => {
        if (hasSendFlow) {
            const fee =
                minFee !== undefined
                    ? new Decimal(minFee.toString())
                    : undefined
            return {
                feeAmount: fee,
                maxFeeAmount: fee,
                presets: undefined,
                isPending: isMinFeePending,
                isError: false,
            }
        }
        const preset = estimate?.presets?.[feePreset]
        return {
            feeAmount: preset?.amount ?? estimate?.amount,
            maxFeeAmount: preset?.maxAmount ?? estimate?.amount,
            presets: estimate?.presets,
            isPending: isEstimatePending,
            isError: isEstimateError,
        }
    }, [
        hasSendFlow,
        minFee,
        isMinFeePending,
        estimate,
        feePreset,
        isEstimatePending,
        isEstimateError,
    ])
}
