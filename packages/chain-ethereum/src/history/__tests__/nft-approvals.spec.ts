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
import { encodeFunctionData, getAddress, parseAbi, type Address } from 'viem'
import { getAssetsByIds, type PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { evmHistoryItem } from '../api/msw-handlers'
import { evmHistoryItemSchema, type EvmHistoryItem } from '../api/schema'
import { readNftApprovals } from '../nft-approvals'

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    getAssetsByIds: vi.fn(),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ME: Address = '0x00000000000000000000000000000000000000aa'
const OTHER: Address = '0x00000000000000000000000000000000000000dd'
const SPENDER: Address = '0x00000000000000000000000000000000000000bb'
const APE: Address = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'
const USDC: Address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

const ABI = parseAbi(['function approve(address spender, uint256 value)'])

const approveRow = (
    to: Address,
    value: bigint,
    from: Address = ME,
): EvmHistoryItem =>
    evmHistoryItemSchema.parse(
        evmHistoryItem({
            from,
            to,
            value: '0',
            method: 'approve',
            input: encodeFunctionData({
                abi: ABI,
                functionName: 'approve',
                args: [SPENDER, value],
            }),
        }),
    )

const stored = (...assetIds: string[]) =>
    vi
        .mocked(getAssetsByIds)
        .mockResolvedValue(assetIds.map(assetId => ({ assetId }) as PeraAsset))

describe('readNftApprovals', () => {
    beforeEach(() => {
        vi.mocked(getAssetsByIds).mockReset()
    })

    it('names an approve whose token the store holds only as that NFT', async () => {
        stored(`${getAddress(APE)}/0`)

        const ids = await readNftApprovals([approveRow(APE, 0n)], ME, SCOPE)

        expect([...ids]).toEqual([`${getAddress(APE)}/0`])
        expect(getAssetsByIds).toHaveBeenCalledWith({
            assetIds: [getAddress(APE), `${getAddress(APE)}/0`],
            scope: SCOPE,
        })
    })

    it('leaves an approve alone when the store holds the token as fungible, as the detail page reads it', async () => {
        stored(getAddress(USDC), `${getAddress(USDC)}/0`)

        const ids = await readNftApprovals([approveRow(USDC, 0n)], ME, SCOPE)

        expect(ids.size).toBe(0)
    })

    it("doesn't read the store for a page with no approve the account sent", async () => {
        const ids = await readNftApprovals(
            [approveRow(APE, 0n, OTHER)],
            ME,
            SCOPE,
        )

        expect(ids.size).toBe(0)
        expect(getAssetsByIds).not.toHaveBeenCalled()
    })

    it('names nothing when the store cannot be read, so the page still loads', async () => {
        vi.mocked(getAssetsByIds).mockRejectedValue(new Error('locked'))

        const ids = await readNftApprovals([approveRow(APE, 0n)], ME, SCOPE)

        expect(ids.size).toBe(0)
    })
})
