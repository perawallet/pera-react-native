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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import type { BalanceChange } from '@perawallet/wallet-core-chain-contract'
import { useEthereumRecordAmountRow } from '../useEthereumRecordAmountRow'

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    useAssetsQuery: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, string>) =>
            params ? `${key} ${JSON.stringify(params)}` : key,
    }),
}))

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const CONTRACT = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'

const nftLeg = (tokenId: string): BalanceChange => ({
    assetRef: { chainId: 'ethereum', assetId: `${CONTRACT}/${tokenId}` },
    value: new Decimal(-1),
    display: { symbol: 'BAYC', decimals: 0 },
})

const rowOf = (change: BalanceChange) =>
    renderHook(() => useEthereumRecordAmountRow(change, SCOPE)).result.current

const storing = (assets: Map<string, unknown>) =>
    vi.mocked(useAssetsQuery).mockReturnValue({
        data: assets,
        isPending: false,
    } as unknown as ReturnType<typeof useAssetsQuery>)

describe('useEthereumRecordAmountRow', () => {
    beforeEach(() => {
        storing(new Map())
    })

    it('Given two NFTs of one collection, then each row is titled by its own token, without the ticker as a unit', () => {
        const first = rowOf(nftLeg('1234'))
        const second = rowOf(nftLeg('5678'))

        expect(first.title).toBe(
            'transactions.list_item.nft_subtitle {"collection":"BAYC","tokenId":"1234"}',
        )
        expect(second.title).not.toBe(first.title)
        expect(first.showSymbol).toBe(false)
        expect(first.value.toString()).toBe('-1')
    })

    it('Given the store knows the NFT, then its collection name titles the row', () => {
        const leg = nftLeg('1234')
        storing(
            new Map([
                [
                    leg.assetRef.assetId,
                    {
                        assetId: leg.assetRef.assetId,
                        decimals: 0,
                        peraMetadata: {
                            collectible: {
                                collection: { name: 'Bored Ape Yacht Club' },
                            },
                        },
                    },
                ],
            ]),
        )

        expect(rowOf(leg).title).toContain(
            '"collection":"Bored Ape Yacht Club"',
        )
    })

    it('Given an NFT with no symbol, then its contract names the collection', () => {
        const leg = { ...nftLeg('1234'), display: undefined }

        expect(rowOf(leg).title).toContain(`"collection":"0xBC`)
    })

    it('Given a token the account sent, then the row says so, with its symbol', () => {
        const row = rowOf({
            assetRef: { chainId: 'ethereum', assetId: '0xusdc' },
            value: new Decimal(-5_000_000),
            display: { symbol: 'USDC', decimals: 6 },
        })

        expect(row.title).toBe('transactions.record_detail.you_sent')
        expect(row.showSymbol).toBe(true)
        expect(row.value.toString()).toBe('-5')
    })

    it('Given a token the account received, then the row says so', () => {
        const row = rowOf({
            assetRef: { chainId: 'ethereum', assetId: '0xausdc' },
            value: new Decimal(4_999_000),
            display: { symbol: 'aUSDC', decimals: 6 },
        })

        expect(row.title).toBe('transactions.record_detail.you_received')
    })
})
