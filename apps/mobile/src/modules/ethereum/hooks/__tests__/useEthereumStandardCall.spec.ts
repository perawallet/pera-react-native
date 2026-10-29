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

import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type {
    EthereumTransactionView,
    EvmStandardCall,
} from '@perawallet/wallet-core-chain-ethereum'
import { useEthereumStandardCall } from '../useEthereumStandardCall'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SIGNER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const NFT = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
const SPENDER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const HOLDER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const ZERO = '0x0000000000000000000000000000000000000000'

const USDC = { assetId: TOKEN, decimals: 6, unitName: 'USDC' }
const APE = {
    assetId: `${NFT}/7`,
    decimals: 0,
    unitName: 'BAYC',
    peraMetadata: { collectible: { collection: { name: 'Apes' } } },
}

type AssetQuery = ReturnType<typeof useSingleAssetDetailsQuery>

// Each id answers from `records`; one the map lacks has no record, like a
// lookup the node and the backend both fail.
const mockRecords = (
    records: Record<string, unknown>,
    pending: string[] = [],
) =>
    vi.mocked(useSingleAssetDetailsQuery).mockImplementation(
        (assetId: string) =>
            ({
                data: records[assetId],
                isPending: !assetId || pending.includes(assetId),
            }) as unknown as AssetQuery,
    )

const viewWith = (call: EvmStandardCall): EthereumTransactionView => ({
    kind: 'contract-call',
    from: SIGNER,
    to: call.contract,
    value: new Decimal(0),
    data: '0x',
    isPreview: true,
    call,
})

const approve = (
    value: bigint,
    spender: `0x${string}` = SPENDER,
): EvmStandardCall => ({
    kind: 'approve',
    contract: TOKEN,
    spender,
    value: new Decimal(value.toString()),
})

const render = (call: EvmStandardCall) =>
    renderHook(() => useEthereumStandardCall(viewWith(call), SCOPE)).result
        .current

describe('useEthereumStandardCall', () => {
    beforeEach(() => {
        mockRecords({})
    })

    it('reads nothing from a view without a decoded call', () => {
        const { result } = renderHook(() =>
            useEthereumStandardCall(
                { ...viewWith(approve(5n)), call: undefined },
                SCOPE,
            ),
        )

        expect(result.current.standardCall).toBeNull()
    })

    it('presents an approve on a known token as a spend approval of that token', () => {
        mockRecords({ [TOKEN]: USDC })

        expect(render(approve(2n ** 256n - 1n)).standardCall).toEqual({
            kind: 'token-approval',
            contract: TOKEN,
            spender: SPENDER,
            spendApproval: {
                spender: SPENDER,
                allowances: [
                    { assetRef: { chainId: 'ethereum', assetId: TOKEN } },
                ],
                isLongLived: true,
            },
        })
    })

    it('presents an approve with no fungible record as an NFT approval when the token id has one', () => {
        mockRecords({ [`${TOKEN}/7`]: APE })

        expect(render(approve(7n)).standardCall).toEqual({
            kind: 'nft-approval',
            contract: TOKEN,
            spender: SPENDER,
            tokenId: '7',
            collectionName: 'Apes',
            isRevocation: false,
        })
    })

    it('treats an NFT approval to the zero address as a revocation', () => {
        mockRecords({ [`${TOKEN}/7`]: APE })

        expect(render(approve(7n, ZERO)).standardCall).toMatchObject({
            kind: 'nft-approval',
            isRevocation: true,
        })
    })

    it('presents an approve with no record at all as an unknown token, raw and still warned', () => {
        const { standardCall } = render(approve(2n ** 200n))

        expect(standardCall).toMatchObject({
            kind: 'token-approval',
            contract: TOKEN,
            spendApproval: {
                allowances: [
                    { assetRef: { chainId: 'ethereum', assetId: TOKEN } },
                ],
            },
        })
        expect(
            standardCall?.kind === 'token-approval' &&
                standardCall.spendApproval?.allowances[0].amount,
        ).toBeUndefined()
    })

    it('presents approve(spender, 0) as a revocation with nothing granted', () => {
        mockRecords({ [TOKEN]: USDC })

        expect(render(approve(0n)).standardCall).toEqual({
            kind: 'token-approval',
            contract: TOKEN,
            spender: SPENDER,
        })
    })

    it('presents a zero approve on a token with no fungible record as a grant, not a revocation', () => {
        expect(render(approve(0n)).standardCall).toMatchObject({
            kind: 'token-approval',
            spendApproval: {
                allowances: [
                    {
                        assetRef: { chainId: 'ethereum', assetId: TOKEN },
                        amount: new Decimal(0),
                    },
                ],
            },
        })
    })

    it('presents a zero approve as a grant while the token record is still loading', () => {
        mockRecords({}, [TOKEN])

        expect(render(approve(0n)).standardCall).toHaveProperty('spendApproval')
    })

    it('presents a zero increaseAllowance as a grant even on a known token', () => {
        mockRecords({ [TOKEN]: USDC })

        expect(
            render({
                kind: 'increase-allowance',
                contract: TOKEN,
                spender: SPENDER,
                value: new Decimal(0),
            }).standardCall,
        ).toMatchObject({
            kind: 'token-approval',
            spendApproval: { spender: SPENDER },
        })
    })

    it('presents setApprovalForAll as a collection approval, granted or revoked', () => {
        const grant: EvmStandardCall = {
            kind: 'set-approval-for-all',
            contract: NFT,
            operator: SPENDER,
            isApproved: true,
        }

        expect(render(grant).standardCall).toEqual({
            kind: 'collection-approval',
            contract: NFT,
            operator: SPENDER,
            isApproved: true,
        })
        expect(
            render({ ...grant, isApproved: false }).standardCall,
        ).toMatchObject({ isApproved: false })
    })

    it("presents a token transfer in the token's display units", () => {
        mockRecords({ [TOKEN]: USDC })

        expect(
            render({
                kind: 'transfer',
                contract: TOKEN,
                from: SIGNER,
                to: SPENDER,
                value: new Decimal(5_000_000),
            }).standardCall,
        ).toEqual({
            kind: 'token-transfer',
            contract: TOKEN,
            from: SIGNER,
            to: SPENDER,
            amount: { asset: USDC, value: new Decimal(5) },
        })
    })

    it('resolves transferFrom the way it resolves approve', () => {
        const transferFrom: EvmStandardCall = {
            kind: 'transfer-from',
            contract: TOKEN,
            from: HOLDER,
            to: SPENDER,
            value: new Decimal(7),
        }

        mockRecords({ [TOKEN]: USDC })
        expect(render(transferFrom).standardCall).toMatchObject({
            kind: 'token-transfer',
            from: HOLDER,
            amount: { asset: USDC, value: new Decimal('0.000007') },
        })

        mockRecords({ [`${TOKEN}/7`]: APE })
        expect(render(transferFrom).standardCall).toEqual({
            kind: 'nft-transfer',
            contract: TOKEN,
            from: HOLDER,
            to: SPENDER,
            items: [{ tokenId: '7', amount: new Decimal(1) }],
            collectionName: 'Apes',
            asset: APE,
        })
    })

    it("lists every item of an ERC-1155 batch, labelled by the first item's collection", () => {
        mockRecords({ [`${NFT}/7`]: APE })
        const items = [
            { tokenId: '7', amount: new Decimal(3) },
            { tokenId: '8', amount: new Decimal(1) },
        ]

        expect(
            render({
                kind: 'erc1155-transfer',
                contract: NFT,
                from: SIGNER,
                to: SPENDER,
                items,
            }).standardCall,
        ).toEqual({
            kind: 'nft-transfer',
            contract: NFT,
            from: SIGNER,
            to: SPENDER,
            items,
            collectionName: 'Apes',
            asset: APE,
        })
    })

    it('reports loading while the token record is on its way, reading the call as a token meanwhile', () => {
        mockRecords({}, [TOKEN])

        const result = render(approve(5n))

        expect(result.isLoading).toBe(true)
        expect(result.standardCall?.kind).toBe('token-approval')
    })

    it('waits on the NFT record once the token turns out to have no fungible one', () => {
        mockRecords({}, [`${TOKEN}/7`])

        expect(render(approve(7n)).isLoading).toBe(true)
    })
})
