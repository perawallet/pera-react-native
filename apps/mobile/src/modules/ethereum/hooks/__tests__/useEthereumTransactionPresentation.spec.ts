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
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import type { EvmStandardCall } from '@perawallet/wallet-core-chain-ethereum'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import {
    ETHEREUM_FIXTURE_NFT_ID,
    ETHEREUM_FIXTURE_RECIPIENT,
    ETHEREUM_FIXTURE_SENDER,
    ETHEREUM_FIXTURE_TOKEN,
    reviewEthereumFixture,
    type EthereumDisplayFixtureKind,
} from '@test-utils/ethereum-display-fixtures'
import { useEthereumTransactionPresentation } from '../useEthereumTransactionPresentation'

const USDC = { assetId: ETHEREUM_FIXTURE_TOKEN, decimals: 6, unitName: 'USDC' }

type AssetQuery = ReturnType<typeof useSingleAssetDetailsQuery>

const mockAssetQuery = (query: { data?: unknown; isPending: boolean }) =>
    vi
        .mocked(useSingleAssetDetailsQuery)
        .mockReturnValue(query as unknown as AssetQuery)

const natives = {} as Record<EthereumDisplayFixtureKind, TransactionNative>

describe('useEthereumTransactionPresentation', () => {
    beforeAll(async () => {
        registerEthereumChain()
        for (const kind of [
            'transfer',
            'token-transfer',
            'nft-transfer',
            'contract-call',
            'approval',
            'contract-creation',
        ] as const) {
            natives[kind] = await reviewEthereumFixture(kind)
        }
    })

    beforeEach(() => {
        mockAssetQuery({ data: null, isPending: false })
        vi.mocked(useFindAccountByAddress).mockReturnValue(null)
    })

    it('presents a transfer as a send of the recipient and the ether moved', () => {
        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives.transfer),
        )

        expect(result.current?.titleKey).toBe('transactions.list_item.send')
        expect(result.current?.iconName).toBe('transactions/send')
        expect(result.current?.counterparty).toBe(ETHEREUM_FIXTURE_RECIPIENT)
        expect(result.current?.amount?.value).toEqual(new Decimal(1))
        expect(result.current?.value.value).toEqual(new Decimal(1))
        expect(result.current?.maxFee?.value).toEqual(new Decimal('0.00042'))
        expect(result.current?.isAmountLoading).toBe(false)
    })

    it("shows a token transfer's recipient, not the contract, and the amount in the token's units", () => {
        mockAssetQuery({ data: USDC, isPending: false })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['token-transfer']),
        )

        expect(result.current?.counterparty).toBe(ETHEREUM_FIXTURE_RECIPIENT)
        expect(result.current?.amount?.asset).toBe(USDC)
        expect(result.current?.amount?.value).toEqual(new Decimal(5))
        expect(useSingleAssetDetailsQuery).toHaveBeenCalledWith(
            ETHEREUM_FIXTURE_TOKEN,
            expect.objectContaining({ chainId: 'ethereum' }),
        )
    })

    it("shows an NFT transfer's recipient, quantity, collection and token id", () => {
        const nft = {
            assetId: ETHEREUM_FIXTURE_NFT_ID,
            decimals: 0,
            unitName: 'BAYC',
            peraMetadata: { collectible: { collection: { name: 'Apes' } } },
        }
        mockAssetQuery({ data: nft, isPending: false })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['nft-transfer']),
        )

        expect(result.current?.titleKey).toBe('transactions.list_item.send')
        expect(result.current?.iconName).toBe('transactions/send')
        expect(result.current?.counterparty).toBe(ETHEREUM_FIXTURE_RECIPIENT)
        expect(result.current?.amount).toEqual({
            asset: nft,
            value: new Decimal(1),
        })
        expect(result.current?.collectible).toEqual({
            tokenId: '7',
            collectionName: 'Apes',
        })
        expect(useSingleAssetDetailsQuery).toHaveBeenCalledWith(
            ETHEREUM_FIXTURE_NFT_ID,
            expect.objectContaining({ chainId: 'ethereum' }),
        )
    })

    it("waits on an NFT's record before showing its quantity", () => {
        mockAssetQuery({ data: undefined, isPending: true })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['nft-transfer']),
        )

        expect(result.current?.isAmountLoading).toBe(true)
    })

    it('sets no collectible on a token transfer', () => {
        mockAssetQuery({ data: USDC, isPending: false })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['token-transfer']),
        )

        expect(result.current?.collectible).toBeUndefined()
    })

    it("waits on a token's record before showing its amount", () => {
        mockAssetQuery({ data: undefined, isPending: true })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['token-transfer']),
        )

        expect(result.current?.amount).toBeUndefined()
        expect(result.current?.isAmountLoading).toBe(true)
    })

    it('falls back to the raw base units when the token record cannot be read', () => {
        mockAssetQuery({ data: undefined, isPending: false })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['token-transfer']),
        )

        expect(result.current?.amount).toEqual({
            asset: null,
            value: new Decimal(5_000_000),
        })
        expect(result.current?.isAmountLoading).toBe(false)
    })

    it('presents an unrecognised call by its target, with no amount', () => {
        // A disabled query reports pending, which must not read as a loading amount.
        mockAssetQuery({ data: undefined, isPending: true })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['contract-call']),
        )

        expect(result.current?.titleKey).toBe(
            'transactions.list_item.contract_call',
        )
        expect(result.current?.iconName).toBe('transactions/application-call')
        expect(result.current?.counterparty).toBe(ETHEREUM_FIXTURE_TOKEN)
        expect(result.current?.amount).toBeUndefined()
        expect(result.current?.isAmountLoading).toBe(false)
    })

    it('has no fee yet for a batch call not reached, which is priced once it is', () => {
        const {
            nonce: _nonce,
            gas: _gas,
            fee: _fee,
            ...unpriced
        } = natives['contract-call'].transaction as Record<string, unknown>
        const preview: TransactionNative = {
            family: 'evm',
            transaction: { ...unpriced, isPreview: true },
        }

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(preview),
        )

        expect(result.current?.maxFee).toBeNull()
        expect(result.current?.counterparty).toBe(ETHEREUM_FIXTURE_TOKEN)
    })

    it('has no counterparty for a contract creation', () => {
        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['contract-creation']),
        )

        expect(result.current?.counterparty).toBeUndefined()
    })

    it('returns the held account that sends the transaction', () => {
        const account = { id: 'signer' } as ReturnType<
            typeof useFindAccountByAddress
        >
        vi.mocked(useFindAccountByAddress).mockImplementation(address =>
            address === ETHEREUM_FIXTURE_SENDER ? account : null,
        )

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives.transfer),
        )

        expect(result.current?.signingAccount).toBe(account)
    })

    it('returns null for a native it cannot read', () => {
        const algorand = renderHook(() =>
            useEthereumTransactionPresentation({
                family: 'algorand',
                transaction: {},
            }),
        )
        const malformed = renderHook(() =>
            useEthereumTransactionPresentation({
                family: 'evm',
                transaction: {},
            }),
        )

        expect(algorand.result.current).toBeNull()
        expect(malformed.result.current).toBeNull()
    })

    describe('a decoded standard call', () => {
        const HOLDER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

        // The approval fixture is a dApp approve, so its view already
        // carries the decoded call; these swap in other calls on the same target.
        const callNative = (call?: EvmStandardCall): TransactionNative => {
            const native = natives.approval
            const transaction = native.transaction as Record<string, unknown>
            return call
                ? { ...native, transaction: { ...transaction, call } }
                : native
        }

        it('presents an approve as an approval to its spender, not a transfer', () => {
            mockAssetQuery({ data: USDC, isPending: false })

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(callNative()),
            )

            expect(result.current?.titleKey).toBe(
                'transactions.list_item.approval',
            )
            expect(result.current?.iconName).toBe(
                'transactions/application-call',
            )
            expect(result.current?.isTransfer).toBe(false)
            expect(result.current?.standardCall?.kind).toBe('token-approval')
            expect(result.current?.counterparty).toBe(
                result.current?.standardCall?.kind === 'token-approval'
                    ? result.current.standardCall.spender
                    : undefined,
            )
            expect(result.current?.amount).toBeUndefined()
        })

        it('titles a revocation as one', () => {
            mockAssetQuery({ data: USDC, isPending: false })

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    callNative({
                        kind: 'set-approval-for-all',
                        contract: ETHEREUM_FIXTURE_TOKEN,
                        operator: ETHEREUM_FIXTURE_RECIPIENT,
                        isApproved: false,
                    }),
                ),
            )

            expect(result.current?.titleKey).toBe(
                'transactions.list_item.revoke_approval',
            )
            expect(result.current?.counterparty).toBe(
                ETHEREUM_FIXTURE_RECIPIENT,
            )
        })

        it("presents a dApp's token transfer as a send to its recipient, with the holder when it isn't the signer", () => {
            mockAssetQuery({ data: USDC, isPending: false })

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    callNative({
                        kind: 'transfer-from',
                        contract: ETHEREUM_FIXTURE_TOKEN,
                        from: HOLDER,
                        to: ETHEREUM_FIXTURE_RECIPIENT,
                        value: new Decimal(5_000_000),
                    }),
                ),
            )

            expect(result.current?.titleKey).toBe('transactions.list_item.send')
            expect(result.current?.iconName).toBe('transactions/send')
            expect(result.current?.isTransfer).toBe(true)
            expect(result.current?.counterparty).toBe(
                ETHEREUM_FIXTURE_RECIPIENT,
            )
            expect(result.current?.sender).toBe(HOLDER)
            expect(result.current?.amount).toEqual({
                asset: USDC,
                value: new Decimal(5),
            })
        })

        it('names no separate holder when the signer sends its own tokens', () => {
            mockAssetQuery({ data: USDC, isPending: false })

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    callNative({
                        kind: 'transfer',
                        contract: ETHEREUM_FIXTURE_TOKEN,
                        from: ETHEREUM_FIXTURE_SENDER,
                        to: ETHEREUM_FIXTURE_RECIPIENT,
                        value: new Decimal(5_000_000),
                    }),
                ),
            )

            expect(result.current?.sender).toBeUndefined()
        })

        it('lists the items of an NFT batch and shows no single amount', () => {
            const items = [
                { tokenId: '7', amount: new Decimal(3) },
                { tokenId: '8', amount: new Decimal(1) },
            ]

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    callNative({
                        kind: 'erc1155-transfer',
                        contract: ETHEREUM_FIXTURE_TOKEN,
                        from: ETHEREUM_FIXTURE_SENDER,
                        to: ETHEREUM_FIXTURE_RECIPIENT,
                        items,
                    }),
                ),
            )

            expect(result.current?.isTransfer).toBe(true)
            expect(result.current?.nftItems).toEqual(items)
            expect(result.current?.amount).toBeUndefined()
            expect(result.current?.isAmountLoading).toBe(false)
        })
    })
})
