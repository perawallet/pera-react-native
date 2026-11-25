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

import type {
    ChainScope,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { CardOwnerMismatchError } from '../api/escrow'
import {
    cardAdapterFor,
    type CardChainErrorReason,
    type CardFundingSourceEligibility,
    type CardManualDepositBuildParams,
} from '../chain-adapter'

export const getCardSettlementAssetId = (scope: ChainScope): Nullable<string> =>
    cardAdapterFor(scope).settlementAsset(scope)

/**
 * The card address comes from the backend and the transfer is auto-approved,
 * so the chain must confirm the sender owns that card before anything is built.
 * @throws CardOwnerMismatchError when it doesn't.
 */
export const buildCardManualDeposit = async (
    params: CardManualDepositBuildParams,
    scope: ChainScope,
): Promise<UnsignedTransaction[]> => {
    const adapter = cardAdapterFor(scope)
    const owner = await adapter.cardOwnerOf(scope, params.cardAddress)
    if (owner !== params.sender) {
        throw new CardOwnerMismatchError()
    }
    return adapter.buildManualDeposit(params, scope)
}

export const getCardFundingSourceEligibility = (
    account: WalletAccount,
    scope: ChainScope,
): CardFundingSourceEligibility =>
    cardAdapterFor(scope).fundingSourceEligibility(account, scope)

export const describeCardChainError = (
    error: unknown,
    scope: ChainScope,
): Nullable<CardChainErrorReason> => cardAdapterFor(scope).describeError(error)

export const getCardTransactionUrl = (
    hash: string,
    legNetwork: string,
    scope: ChainScope,
): Nullable<string> =>
    cardAdapterFor(scope).transactionUrl(hash, legNetwork, scope)
