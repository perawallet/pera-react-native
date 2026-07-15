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

import { describe, test, expect, vi, beforeEach } from 'vitest'

const queryClientMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', () => ({
    queryClient: queryClientMock,
}))

import {
    sendShouldRefreshRequest,
    getShouldRefreshEndpoint,
} from '../endpoints'

describe('sendShouldRefreshRequest', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('returns refresh=false early when no addresses are supplied', async () => {
        const result = await sendShouldRefreshRequest('mainnet', [], null)

        expect(result).toEqual({ refresh: false, round: null })
        expect(queryClientMock).not.toHaveBeenCalled()
    })

    test('POSTs the addresses and last refreshed round to /should-refresh', async () => {
        queryClientMock.mockResolvedValue({
            data: { refresh: true, round: 1234 },
        })

        const result = await sendShouldRefreshRequest(
            'testnet',
            ['ADDR1', 'ADDR2'],
            100,
        )

        expect(queryClientMock).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'POST',
            url: '/v1/accounts/should-refresh/',
            data: {
                account_addresses: ['ADDR1', 'ADDR2'],
                last_refreshed_round: 100,
            },
        })
        expect(result).toEqual({ refresh: true, round: 1234 })
    })
})

describe('getShouldRefreshEndpoint', () => {
    test('returns the canonical endpoint path', () => {
        expect(getShouldRefreshEndpoint()).toBe('/v1/accounts/should-refresh/')
    })
})
