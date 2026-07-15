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

import { prepareTransactions } from '../endpoints'

describe('prepareTransactions', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('POSTs the quote to /v2/dex-swap/prepare-transactions/ and maps response', async () => {
        queryClientMock.mockResolvedValue({
            data: {
                transaction_groups: [
                    {
                        purpose: 'swap',
                        transaction_group_id: 'grp-1',
                        transactions: ['TX1'],
                        signed_transactions: [null],
                    },
                ],
                swap_id: 42,
                swap_id_str: '42',
                swap_version: 'v2',
            },
        })

        const result = await prepareTransactions(
            { quote: 'serialized-quote' },
            'mainnet',
        )

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                url: '/v2/dex-swap/prepare-transactions/',
                data: { quote: 'serialized-quote' },
            }),
        )
        expect(result.swapId).toBe('42')
        expect(result.swapIdStr).toBe('42')
        expect(result.swapVersion).toBe('v2')
        expect(result.transactionGroups?.[0]).toEqual({
            purpose: 'swap',
            transactionGroupId: 'grp-1',
            transactions: ['TX1'],
            signedTransactions: [null],
        })
    })

    test('returns undefined transactionGroups when the field is omitted', async () => {
        queryClientMock.mockResolvedValue({ data: {} })

        const result = await prepareTransactions({ quote: 'x' }, 'mainnet')

        expect(result.transactionGroups).toBeUndefined()
    })
})
