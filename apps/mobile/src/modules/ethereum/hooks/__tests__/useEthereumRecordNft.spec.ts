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
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import {
    i18nKey,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    formatNumber,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { useEthereumRecordNft } from '../useEthereumRecordNft'

const CONTRACT = '0x495f947276749Ce646f68AC8c248420045cb7b5e'
const TOKEN_ID =
    '26930299726785895369628225957821170368256817021752813555773534574697345187841'
const ASSET_ID = `${CONTRACT}/${TOKEN_ID}`
const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

const navigate = vi.fn()

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    useSingleAssetDetailsQuery: vi.fn(),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, string>) =>
            params ? `${key} ${JSON.stringify(params)}` : key,
    }),
}))

const recordOf = (
    overrides: Partial<TransactionRecord> = {},
): TransactionRecord => ({
    id: `0x${'1'.padStart(64, '0')}`,
    scope: SCOPE,
    status: 'confirmed',
    summary: {
        kind: 'nft-transfer',
        title: { key: i18nKey('transactions.list_item.receive') },
        icon: 'receive',
        direction: 'in',
        amount: {
            assetRef: { chainId: 'ethereum', assetId: ASSET_ID },
            value: new Decimal(1),
            display: { symbol: 'OPENSTORE', decimals: 0 },
        },
    },
    chainData: {
        family: 'evm',
        nft: {
            standard: 'erc1155',
            collectionName: 'OpenSea Shared Storefront',
        },
    },
    ...overrides,
})

const serveAsset = (data: unknown, isPending = false) =>
    vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
        data,
        isPending,
    } as unknown as ReturnType<typeof useSingleAssetDetailsQuery>)

const NURI = {
    assetId: ASSET_ID,
    name: 'Nuri Launch #75',
    decimals: 0,
    peraMetadata: {
        logo: 'https://nft.pera.test/logo.png',
        collectible: {
            title: 'Nuri Launch #75',
            standard: 'erc1155',
            primaryImage: 'https://nft.pera.test/nuri-75.png',
            collection: { name: 'OpenSea Shared Storefront' },
        },
    },
}

describe('useEthereumRecordNft', () => {
    beforeEach(() => {
        vi.mocked(formatNumber).mockImplementation(value => ({
            sign: '',
            integer: value.toFixed(0),
            fraction: '',
        }))
        navigate.mockClear()
        serveAsset(undefined)
    })

    it("Given an NFT with metadata, then it reads by the NFT's name and image, with its collection and standard below", () => {
        serveAsset(NURI)

        const { result } = renderHook(() => useEthereumRecordNft(recordOf()))

        expect(vi.mocked(useSingleAssetDetailsQuery)).toHaveBeenCalledWith(
            ASSET_ID,
            SCOPE,
        )
        expect(result.current.nft).toMatchObject({
            title: 'Nuri Launch #75',
            subtitle:
                'transactions.record_detail.nft_collection {"collection":"OpenSea Shared Storefront","standard":"ERC-1155"}',
            thumbnailUrl: 'https://nft.pera.test/nuri-75.png',
            contract: CONTRACT,
            tokenId: TOKEN_ID,
        })
        expect(result.current.nft?.quantity).toBe('1')
        expect(vi.mocked(formatNumber)).toHaveBeenCalledWith(new Decimal(1), 0)
    })

    it('Given no metadata, then it reads by collection and the shortened token id, with no image', () => {
        vi.mocked(truncateAlgorandAddress).mockImplementationOnce(
            value => `${value.slice(0, 5)}...${value.slice(-5)}`,
        )

        const { result } = renderHook(() => useEthereumRecordNft(recordOf()))

        expect(result.current.nft?.title).toBe(
            'transactions.record_detail.nft_fallback {"collection":"OpenSea Shared Storefront","tokenId":"26930...87841"}',
        )
        expect(result.current.nft?.subtitle).toBeUndefined()
        expect(result.current.nft?.thumbnailUrl).toBeUndefined()
        expect(result.current.handleOpen).toBeUndefined()
    })

    it('Given no collection name anywhere, then the shortened contract stands in for it', () => {
        vi.mocked(truncateAlgorandAddress).mockImplementation(
            value => `${value.slice(0, 5)}...${value.slice(-5)}`,
        )
        const { result } = renderHook(() =>
            useEthereumRecordNft(
                recordOf({
                    chainData: { family: 'evm', nft: { standard: 'erc721' } },
                }),
            ),
        )

        expect(result.current.nft?.title).toContain(
            '"collection":"0x495...b7b5e"',
        )
        vi.mocked(truncateAlgorandAddress).mockImplementation(value => value)
    })

    it('Given metadata, when the NFT is opened, then its detail screen opens on its own chain', () => {
        serveAsset(NURI)
        const { result } = renderHook(() => useEthereumRecordNft(recordOf()))

        result.current.handleOpen?.()

        expect(navigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: {
                screen: 'CollectibleDetails',
                params: { assetId: ASSET_ID, chainId: 'ethereum' },
            },
        })
    })

    it.each([
        ['a batch', { chainData: { family: 'evm' } as const }],
        [
            'a token transfer',
            {
                summary: {
                    ...recordOf().summary,
                    kind: 'token-transfer',
                    amount: {
                        assetRef: { chainId: 'ethereum', assetId: CONTRACT },
                        value: new Decimal(1),
                    },
                },
                chainData: { family: 'evm' },
            } as Partial<TransactionRecord>,
        ],
    ])(
        'Given %s, then there is no single NFT and nothing is read',
        (_, overrides) => {
            const { result } = renderHook(() =>
                useEthereumRecordNft(recordOf(overrides)),
            )

            expect(result.current.nft).toBeUndefined()
            expect(vi.mocked(useSingleAssetDetailsQuery)).toHaveBeenCalledWith(
                '',
                SCOPE,
            )
        },
    )
})
