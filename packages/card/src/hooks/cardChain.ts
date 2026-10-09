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
    PeraTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    cardAdapterFor,
    type CardChainErrorReason,
    type CardFundingSourceEligibility,
    type CardManualDepositBuildParams,
} from '../chain-adapter'

export const getCardSettlementAssetId = (scope: ChainScope): Nullable<string> =>
    cardAdapterFor(scope).settlementAsset(scope)

export const buildCardManualDeposit = (
    params: CardManualDepositBuildParams,
    scope: ChainScope,
): Promise<PeraTransaction[]> =>
    cardAdapterFor(scope).buildManualDeposit(params, scope)

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
