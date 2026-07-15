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

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        queryClient: queryClientMock,
    }
})

import { updateSwapStatus } from '../endpoints'

describe('updateSwapStatus', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('PATCHes /v2/dex-swap/swaps/:id/ and maps snake_case to camelCase', async () => {
        queryClientMock.mockResolvedValue({
            data: {
                status: 'completed',
                submitted_transaction_ids: ['TX1', 'TX2'],
                reason: 'other',
                app_version: '1.2.3',
                platform: 'ios',
                country_code: 'US',
                swap_version: 'v2',
            },
        })

        const result = await updateSwapStatus(
            'swap-1',
            {
                status: 'completed',
                submitted_transaction_ids: ['TX1', 'TX2'],
                app_version: '1.2.3',
                platform: 'ios',
                country_code: 'US',
                swap_version: 'v2',
            },
            'mainnet',
        )

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'PATCH',
                url: '/v2/dex-swap/swaps/swap-1/',
            }),
        )
        expect(result.status).toBe('completed')
        expect(result.submittedTransactionIds).toEqual(['TX1', 'TX2'])
        expect(result.appVersion).toBe('1.2.3')
        expect(result.countryCode).toBe('US')
        expect(result.swapVersion).toBe('v2')
    })

    test('throws when response fails schema validation', async () => {
        queryClientMock.mockResolvedValue({ data: { status: 42 } })

        await expect(
            updateSwapStatus('x', { status: 'failed' } as never, 'mainnet'),
        ).rejects.toThrow()
    })
})
