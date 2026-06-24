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

import { useMutation } from '@tanstack/react-query'
import type { Decimal } from 'decimal.js'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    CardFundingUnavailableError,
    type FundingAssetId,
    type FundingResult,
} from '../models'
import { getCardFundingProvider } from '../api/funding'
import { useCardStore } from '../store'
import { toCardMutationResult, type CardMutationResult } from './types'

export type DepositToCardVariables = {
    sourceAsset: FundingAssetId
    sourceAmount: Decimal
}

export type UseDepositToCardMutationResult = CardMutationResult<
    DepositToCardVariables,
    FundingResult
> & {
    /** Whether a funding provider is wired for the active network. */
    isFundingAvailable: boolean
}

/**
 * Tops the card up from the connected funding account. Routes through the
 * active {@link getCardFundingProvider}, which is the `unavailableFundingProvider`
 * null-object until the Baanx Algorand provider ships — so today every call
 * rejects with {@link CardFundingUnavailableError} and `isFundingAvailable` is
 * `false`. The screen uses that to fall back to the "coming soon" path.
 */
export const useDepositToCardMutation = (): UseDepositToCardMutationResult => {
    const { network } = useNetwork()
    const cardId = useCardStore(state => state.cardId)

    const isFundingAvailable = getCardFundingProvider().isAvailable(network)

    const mutation = useMutation<FundingResult, Error, DepositToCardVariables>({
        mutationFn: async ({ sourceAsset, sourceAmount }) => {
            const provider = getCardFundingProvider()
            if (!provider.isAvailable(network)) {
                throw new CardFundingUnavailableError()
            }
            const request = {
                network,
                cardId: cardId ?? '',
                sourceAsset,
                sourceAmount,
            }
            // Quote is informational for now; the screen will surface it once
            // the provider ships.
            await provider.getQuote(request)
            const delegation = await provider.buildDelegation(request)
            // TODO(card): sign delegation.unsignedTxns before submitting once
            // Baanx defines the Algorand delegation contract.
            return provider.submitFunding(delegation, network)
        },
        throwOnError: false,
    })

    return { ...toCardMutationResult(mutation), isFundingAvailable }
}
