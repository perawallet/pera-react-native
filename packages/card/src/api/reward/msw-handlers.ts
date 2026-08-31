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

import { http, HttpResponse, type HttpHandler } from 'msw'
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import {
    rewardWalletResponseSchema,
    rewardWithdrawEstimationResponseSchema,
    rewardWithdrawResponseSchema,
    type RewardWalletApiResponse,
    type RewardWithdrawEstimationApiResponse,
    type RewardWithdrawApiResponse,
} from './schema'

export type MockGetRewardWalletParams = {
    response?: RewardWalletApiResponse
    status?: number
}
export const mockGetRewardWallet = ({
    response = {
        id: 'mock-reward-wallet-id',
        balance: '12.34',
        currency: 'usdc',
        isWithdrawable: true,
    },
    status = 200,
}: MockGetRewardWalletParams = {}): HttpHandler => {
    validateMockResponse(
        rewardWalletResponseSchema,
        response,
        'mockGetRewardWallet',
    )
    return http.get('*/v1/wallet/reward', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockGetRewardWithdrawEstimationParams = {
    response?: RewardWithdrawEstimationApiResponse
    status?: number
}
export const mockGetRewardWithdrawEstimation = ({
    response = { gas: '6219123007416', fee: '0.000006219123007416' },
    status = 200,
}: MockGetRewardWithdrawEstimationParams = {}): HttpHandler => {
    validateMockResponse(
        rewardWithdrawEstimationResponseSchema,
        response,
        'mockGetRewardWithdrawEstimation',
    )
    return http.get('*/v1/wallet/reward/withdraw-estimation', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockWithdrawRewardParams = {
    response?: RewardWithdrawApiResponse
    status?: number
}
export const mockWithdrawReward = ({
    response = { txHash: '0xmocktxhash', network: 'linea', confirmed: true },
    status = 200,
}: MockWithdrawRewardParams = {}): HttpHandler => {
    validateMockResponse(
        rewardWithdrawResponseSchema,
        response,
        'mockWithdrawReward',
    )
    return http.post('*/v1/wallet/reward/withdraw', () =>
        HttpResponse.json(response, { status }),
    )
}
