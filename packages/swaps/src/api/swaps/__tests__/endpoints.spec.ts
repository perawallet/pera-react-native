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

import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest'
import { queryClient } from '@perawallet/wallet-core-shared'
import { updateSwapStatus } from '../endpoints'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        queryClient: vi.fn(),
    }
})

describe('updateSwapStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('sends PATCH to swap endpoint and returns transformed result', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                status: 'completed',
                submitted_transaction_ids: ['tx1', 'tx2'],
                reason: 'other',
                app_version: '1.0.0',
                platform: 'ios',
                country_code: 'US',
                swap_version: 'v2',
            },
        })

        const result = await updateSwapStatus(
            '42',
            {
                status: 'completed',
                submitted_transaction_ids: ['tx1', 'tx2'],
                swap_version: 'v2',
            },
            'mainnet',
        )

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'PATCH',
            url: '/v2/dex-swap/swaps/42/',
            data: {
                status: 'completed',
                submitted_transaction_ids: ['tx1', 'tx2'],
                swap_version: 'v2',
            },
        })

        expect(result).toEqual({
            status: 'completed',
            submittedTransactionIds: ['tx1', 'tx2'],
            reason: 'other',
            appVersion: '1.0.0',
            platform: 'ios',
            countryCode: 'US',
            swapVersion: 'v2',
        })
    })

    test('handles minimal response without optional fields', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { status: 'failed' },
        })

        const result = await updateSwapStatus(
            '99',
            { status: 'failed' },
            'testnet',
        )

        expect(result.status).toBe('failed')
        expect(result.submittedTransactionIds).toBeUndefined()
        expect(result.reason).toBeUndefined()
    })
})
