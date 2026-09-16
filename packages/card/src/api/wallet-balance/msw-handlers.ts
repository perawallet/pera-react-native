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
import type { CardWalletKind } from '../../models'
import { WALLET_TYPE_BY_KIND } from './endpoints'
import {
    walletBalanceResponseSchema,
    walletHistoryResponseSchema,
    walletWithdrawEstimationResponseSchema,
    walletWithdrawResponseSchema,
    type WalletBalanceApiResponse,
    type WalletHistoryEntryApiResponse,
    type WalletWithdrawEstimationApiResponse,
    type WalletWithdrawApiResponse,
} from './schema'

export type MockGetWalletBalanceParams = {
    kind: CardWalletKind
    response?: WalletBalanceApiResponse
    status?: number
}
export const mockGetWalletBalance = ({
    kind,
    response = {
        id: `mock-${kind}-wallet-id`,
        balance: '12.34',
        currency: 'usdc',
        isWithdrawable: true,
    },
    status = 200,
}: MockGetWalletBalanceParams): HttpHandler => {
    validateMockResponse(
        walletBalanceResponseSchema,
        response,
        'mockGetWalletBalance',
    )
    return http.get(`*/v1/wallet/${kind}`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockGetWalletWithdrawEstimationParams = {
    kind: CardWalletKind
    response?: WalletWithdrawEstimationApiResponse
    status?: number
}
export const mockGetWalletWithdrawEstimation = ({
    kind,
    response = { gas: '6219123007416', fee: '0.000006219123007416' },
    status = 200,
}: MockGetWalletWithdrawEstimationParams): HttpHandler => {
    validateMockResponse(
        walletWithdrawEstimationResponseSchema,
        response,
        'mockGetWalletWithdrawEstimation',
    )
    return http.get(`*/v1/wallet/${kind}/withdraw-estimation`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockWithdrawWalletBalanceParams = {
    kind: CardWalletKind
    response?: WalletWithdrawApiResponse
    status?: number
}
export const mockWithdrawWalletBalance = ({
    kind,
    response = { txHash: '0xmocktxhash', network: 'linea', confirmed: true },
    status = 200,
}: MockWithdrawWalletBalanceParams): HttpHandler => {
    validateMockResponse(
        walletWithdrawResponseSchema,
        response,
        'mockWithdrawWalletBalance',
    )
    return http.post(`*/v1/wallet/${kind}/withdraw`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockGetWalletHistoryParams = {
    kind: CardWalletKind
    response?: WalletHistoryEntryApiResponse[]
    status?: number
}
/**
 * History is one route for every wallet, so the handler answers only requests
 * whose `walletType` matches its kind and lets the rest fall through, which
 * keeps one registration per kind in a test.
 */
export const mockGetWalletHistory = ({
    kind,
    response = [
        {
            name: 'Coffee refund',
            amount: '4.50',
            currency: 'usdc',
            sign: 'credit',
            date: '2026-09-10T09:15:00.000Z',
        },
        {
            name: 'Claimed to wallet',
            amount: '10.00',
            currency: 'usdc',
            sign: 'debit',
            date: '2026-08-28T17:40:00.000Z',
        },
    ],
    status = 200,
}: MockGetWalletHistoryParams): HttpHandler => {
    validateMockResponse(
        walletHistoryResponseSchema,
        response,
        'mockGetWalletHistory',
    )
    return http.get('*/v1/wallet/history', ({ request }) => {
        const walletType = new URL(request.url).searchParams.get('walletType')
        if (walletType !== WALLET_TYPE_BY_KIND[kind]) return undefined
        return HttpResponse.json(response, { status })
    })
}
