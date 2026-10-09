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

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    queryClient: queryClientMock,
}))

import { fetchAlgorandChangeSignal } from '../change-signal'

describe('fetchAlgorandChangeSignal', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('sends the should-refresh request and maps the response', async () => {
        queryClientMock.mockResolvedValue({
            data: { refresh: true, round: 1234 },
        })

        const signal = await fetchAlgorandChangeSignal(
            ['ADDR1', 'ADDR2'],
            'testnet',
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
        expect(signal).toEqual({ changed: true, cursor: 1234 })
    })

    test('reports no change with the backend round', async () => {
        queryClientMock.mockResolvedValue({
            data: { refresh: false, round: 1200 },
        })

        const signal = await fetchAlgorandChangeSignal(
            ['ADDR1'],
            'mainnet',
            100,
        )

        expect(signal).toEqual({ changed: false, cursor: 1200 })
    })

    test('reports a change for a scope that never synced', async () => {
        queryClientMock.mockResolvedValue({
            data: { refresh: false, round: 1200 },
        })

        const signal = await fetchAlgorandChangeSignal(
            ['ADDR1'],
            'mainnet',
            null,
        )

        expect(queryClientMock.mock.calls[0][0].data.last_refreshed_round).toBe(
            null,
        )
        expect(signal).toEqual({ changed: true, cursor: 1200 })
    })

    test('sends nothing and keeps the cursor on a network with no Pera deployment', async () => {
        await expect(
            fetchAlgorandChangeSignal(['ADDR1'], 'betanet', 500),
        ).resolves.toEqual({ changed: true, cursor: 500 })
        await expect(
            fetchAlgorandChangeSignal(['ADDR1'], 'betanet', null),
        ).resolves.toEqual({ changed: true, cursor: 0 })

        expect(queryClientMock).not.toHaveBeenCalled()
    })

    test('propagates the request error unchanged', async () => {
        const error = Object.assign(new Error('Unauthorized'), {
            response: { status: 401 },
        })
        queryClientMock.mockRejectedValue(error)

        await expect(
            fetchAlgorandChangeSignal(['ADDR1'], 'mainnet', 100),
        ).rejects.toBe(error)
    })
})
