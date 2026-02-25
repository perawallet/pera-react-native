/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import { fetchArc59SendSummary } from '../endpoints'
import { queryClient } from '@perawallet/wallet-core-shared'

vi.mock('@perawallet/wallet-core-shared', () => ({
    queryClient: vi.fn(),
}))

const RECEIVER = 'TESTRECEIVER123'
const ASSET_ID = '12345'

const validResponse = {
    is_arc59_opted_in: true,
    minimum_balance_requirement: 100000,
    inner_tx_count: 2,
    total_protocol_and_mbr_fee: 4000,
    inbox_address: null,
    algo_fund_amount: 0,
    warning_message: null,
}

describe('fetchArc59SendSummary', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient with correct params', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: validResponse })

        await fetchArc59SendSummary('testnet', RECEIVER, ASSET_ID)

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'GET',
            url: `/v1/arc59/send-summary/${RECEIVER}/${ASSET_ID}`,
        })
    })

    test('uses the provided network', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: validResponse })

        await fetchArc59SendSummary('mainnet', RECEIVER, ASSET_ID)

        expect(queryClient).toHaveBeenCalledWith(
            expect.objectContaining({ network: 'mainnet' }),
        )
    })

    test('returns parsed response on success', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: validResponse })

        const result = await fetchArc59SendSummary(
            'testnet',
            RECEIVER,
            ASSET_ID,
        )

        expect(result).toEqual(validResponse)
    })

    test('returns response with warning message', async () => {
        const responseWithWarning = {
            ...validResponse,
            warning_message: {
                title: 'Heads up',
                detail: 'Something to know',
                link: 'https://example.com/info',
                link_text: 'Read more',
            },
        }

        ;(queryClient as Mock).mockResolvedValue({
            data: responseWithWarning,
        })

        const result = await fetchArc59SendSummary(
            'testnet',
            RECEIVER,
            ASSET_ID,
        )

        expect(result.warning_message).toEqual(
            responseWithWarning.warning_message,
        )
    })

    test('propagates errors from queryClient', async () => {
        ;(queryClient as Mock).mockRejectedValue(new Error('Request failed'))

        await expect(
            fetchArc59SendSummary('testnet', RECEIVER, ASSET_ID),
        ).rejects.toThrow('Request failed')
    })

    test('throws when response data fails schema validation', async () => {
        const invalidData = {
            is_arc59_opted_in: 'not-a-boolean',
            minimum_balance_requirement: 100000,
        }

        ;(queryClient as Mock).mockResolvedValue({ data: invalidData })

        await expect(
            fetchArc59SendSummary('testnet', RECEIVER, ASSET_ID),
        ).rejects.toThrow()
    })
})
