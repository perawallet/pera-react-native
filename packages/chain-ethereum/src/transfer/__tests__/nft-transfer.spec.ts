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
import { decodeFunctionData, erc1155Abi, erc721Abi, getAddress } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getAssetById, type PeraAsset } from '@perawallet/wallet-core-assets'
import { encodeEvmNftTransfer, readEvmNftTransferAsset } from '../nft-transfer'

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    getAssetById: vi.fn(async () => null),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const CONTRACT = getAddress('0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d')
const FROM = getAddress('0x00000000000000000000000000000000000000aa')
const TO = getAddress('0x00000000000000000000000000000000000000bb')
// Past 2^53, where a JS number would lose the id.
const BIG_TOKEN_ID = '90071992547409930001'

const storedNft = (standard: string, collectionName?: string): PeraAsset =>
    ({
        assetId: `${CONTRACT}/7`,
        decimals: 0,
        peraMetadata: {
            collectible: {
                standard,
                ...(collectionName && { collection: { name: collectionName } }),
            },
        },
    }) as PeraAsset

describe('readEvmNftTransferAsset', () => {
    beforeEach(() => {
        vi.mocked(getAssetById).mockResolvedValue(null)
    })

    it.each(['erc721', 'erc1155'])(
        'reads a stored %s with its collection',
        async standard => {
            vi.mocked(getAssetById).mockResolvedValue(
                storedNft(standard, 'Apes'),
            )

            const read = await readEvmNftTransferAsset(SCOPE, `${CONTRACT}/7`)

            expect(read).toEqual({
                contract: CONTRACT,
                tokenId: '7',
                standard,
                collectionName: 'Apes',
            })
            expect(getAssetById).toHaveBeenCalledWith({
                assetId: `${CONTRACT}/7`,
                scope: SCOPE,
            })
        },
    )

    it('leaves the collection out when the asset has none', async () => {
        vi.mocked(getAssetById).mockResolvedValue(storedNft('erc721'))

        const read = await readEvmNftTransferAsset(SCOPE, `${CONTRACT}/7`)

        expect(read).not.toHaveProperty('collectionName')
    })

    it('is null for an id that is not an NFT, without reading the store', async () => {
        expect(await readEvmNftTransferAsset(SCOPE, CONTRACT)).toBeNull()
        expect(getAssetById).not.toHaveBeenCalled()
    })

    it('is null for an NFT the store does not hold', async () => {
        expect(await readEvmNftTransferAsset(SCOPE, `${CONTRACT}/7`)).toBeNull()
    })

    it('is null for a stored asset with an unknown standard', async () => {
        vi.mocked(getAssetById).mockResolvedValue(storedNft('erc404'))

        expect(await readEvmNftTransferAsset(SCOPE, `${CONTRACT}/7`)).toBeNull()
    })
})

describe('encodeEvmNftTransfer', () => {
    it('encodes an ERC-721 as the three-argument safeTransferFrom, ignoring the amount', () => {
        const data = encodeEvmNftTransfer({
            standard: 'erc721',
            from: FROM,
            to: TO,
            tokenId: BIG_TOKEN_ID,
            amount: 1n,
        })

        expect(decodeFunctionData({ abi: erc721Abi, data })).toEqual({
            functionName: 'safeTransferFrom',
            args: [FROM, TO, BigInt(BIG_TOKEN_ID)],
        })
    })

    it('encodes an ERC-1155 with its amount and empty data', () => {
        const data = encodeEvmNftTransfer({
            standard: 'erc1155',
            from: FROM,
            to: TO,
            tokenId: BIG_TOKEN_ID,
            amount: 2n,
        })

        expect(decodeFunctionData({ abi: erc1155Abi, data })).toEqual({
            functionName: 'safeTransferFrom',
            args: [FROM, TO, BigInt(BIG_TOKEN_ID), 2n, '0x'],
        })
    })
})
