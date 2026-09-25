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

import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import { fetchArc59SendSummary, fetchArc59AssetRequests } from '../endpoints'
import { queryClient } from '@perawallet/wallet-core-shared'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
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
            url: `/v1/asa-inboxes/summary/send-flow/${RECEIVER}/${ASSET_ID}/`,
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

const validAssetRequest = {
    total_amount: '1000',
    asset: {
        asset_id: 12345,
        name: 'Test Asset',
        logo: null,
        unit_name: 'TEST',
        fraction_decimals: 6,
        usd_value: null,
        verification_tier: 'trusted',
        is_verified: true,
        is_deleted: false,
        creator: { address: 'CREATOR' },
        type: 'standard_asset' as const,
    },
    algo_gain_on_claim: '0',
    algo_gain_on_reject: '0',
    senders: {
        count: 1,
        results: [
            {
                sender: { address: 'SENDER1', name: 'Alice' },
                amount: '500',
            },
        ],
    },
    insufficient_algo_for_claiming: false,
    insufficient_algo_for_rejecting: false,
    should_use_funds_before_claiming: false,
    should_use_funds_before_rejecting: false,
}

describe('fetchArc59AssetRequests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('GETs /v1/asa-inboxes/requests/:address and maps each result', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { results: [validAssetRequest] },
        })

        const result = await fetchArc59AssetRequests('mainnet', 'ADDR1')

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: '/v1/asa-inboxes/requests/ADDR1/',
        })
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('12345')
        expect(result[0].asset.assetId).toBe('12345')
        expect(result[0].senders.results[0].sender.address).toBe('SENDER1')
    })

    test('throws when the response fails schema validation', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { results: [{ asset: 'wrong-shape' }] },
        })

        await expect(
            fetchArc59AssetRequests('mainnet', 'ADDR1'),
        ).rejects.toThrow()
    })

    test('maps collectible asset with primary_image', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                results: [
                    {
                        ...validAssetRequest,
                        asset: {
                            ...validAssetRequest.asset,
                            collectible: {
                                title: 'Cool NFT',
                                primary_image: 'https://example.com/nft.png',
                            },
                        },
                    },
                ],
            },
        })

        const result = await fetchArc59AssetRequests('mainnet', 'ADDR1')

        expect(result).toMatchObject([
            {
                asset: {
                    peraMetadata: {
                        collectible: {
                            title: 'Cool NFT',
                            primaryImage: 'https://example.com/nft.png',
                        },
                    },
                },
            },
        ])
    })

    test('maps the top-level inbox_address onto every request', async () => {
        const inboxAddress =
            'OJVMSUIFJXMRWFSFG2CPPWMFTWXRXN3J42PZATE24FVKU4Q43DPCZXEA24'

        ;(queryClient as Mock).mockResolvedValue({
            data: {
                results: [
                    validAssetRequest,
                    { ...validAssetRequest, total_amount: '2000' },
                ],
                inbox_address: inboxAddress,
            },
        })

        const result = await fetchArc59AssetRequests('mainnet', 'ADDR1')

        expect(result).toHaveLength(2)
        expect(result[0].inboxAddress).toBe(inboxAddress)
        expect(result[1].inboxAddress).toBe(inboxAddress)
    })

    test('defaults inboxAddress to null when the response omits inbox_address', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { results: [validAssetRequest] },
        })

        const result = await fetchArc59AssetRequests('mainnet', 'ADDR1')

        expect(result[0].inboxAddress).toBeNull()
    })

    test('maps collectible with null primary_image to undefined', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                results: [
                    {
                        ...validAssetRequest,
                        asset: {
                            ...validAssetRequest.asset,
                            collectible: {
                                title: 'Cool NFT',
                                primary_image: null,
                            },
                        },
                    },
                ],
            },
        })

        const result = await fetchArc59AssetRequests('mainnet', 'ADDR1')

        expect(result).toMatchObject([
            {
                asset: {
                    peraMetadata: {
                        collectible: {
                            title: 'Cool NFT',
                            primaryImage: undefined,
                        },
                    },
                },
            },
        ])
    })
})
