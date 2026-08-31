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

import { toDecimal } from '@perawallet/wallet-core-shared'
import type {
    CardRewardWallet,
    RewardWithdrawEstimation,
    RewardWithdrawResult,
} from '../../models'
import type {
    RewardWalletApiResponse,
    RewardWithdrawEstimationApiResponse,
    RewardWithdrawApiResponse,
} from './schema'

export const transformRewardWallet = (
    response: RewardWalletApiResponse,
): CardRewardWallet => ({
    id: response.id,
    balance: toDecimal(response.balance),
    currency: response.currency,
    isWithdrawable: response.isWithdrawable ?? false,
})

export const transformRewardWithdrawEstimation = (
    response: RewardWithdrawEstimationApiResponse,
): RewardWithdrawEstimation => ({
    fee: toDecimal(response.fee),
    gas: response.gas,
})

export const transformRewardWithdraw = (
    response: RewardWithdrawApiResponse,
): RewardWithdrawResult => ({
    txHash: response.txHash,
    network: response.network,
    isConfirmed: response.confirmed ?? false,
})
