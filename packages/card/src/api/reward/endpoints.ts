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

import { getCardTransport } from '../transport'
import type {
    CardRewardWallet,
    RewardWithdrawEstimation,
    RewardWithdrawResult,
} from '../../models'
import {
    rewardWalletResponseSchema,
    rewardWithdrawEstimationResponseSchema,
    rewardWithdrawResponseSchema,
} from './schema'
import {
    transformRewardWallet,
    transformRewardWithdrawEstimation,
    transformRewardWithdraw,
} from './transformers'
import type { Network } from '@perawallet/wallet-core-shared'

type NetworkParams = {
    network: Network
    signal?: AbortSignal
}

export const fetchRewardWallet = async (
    params: NetworkParams,
): Promise<CardRewardWallet> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'GET',
        path: '/v1/wallet/reward',
        authenticated: true,
        signal: params.signal,
    })
    return transformRewardWallet(
        rewardWalletResponseSchema.parse(response.data),
    )
}

export const fetchRewardWithdrawEstimation = async (
    params: NetworkParams,
): Promise<RewardWithdrawEstimation> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'GET',
        path: '/v1/wallet/reward/withdraw-estimation',
        authenticated: true,
        signal: params.signal,
    })
    return transformRewardWithdrawEstimation(
        rewardWithdrawEstimationResponseSchema.parse(response.data),
    )
}

export type WithdrawRewardParams = NetworkParams & {
    /** Decimal string in display units (e.g. "10.5"). */
    amount: string
}
export const withdrawReward = async (
    params: WithdrawRewardParams,
): Promise<RewardWithdrawResult> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'POST',
        path: '/v1/wallet/reward/withdraw',
        authenticated: true,
        data: { amount: params.amount },
        signal: params.signal,
    })
    return transformRewardWithdraw(
        rewardWithdrawResponseSchema.parse(response.data),
    )
}
