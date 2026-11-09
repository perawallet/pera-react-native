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
import { Decimal } from 'decimal.js'
import {
    encodeFunctionData,
    erc1155Abi,
    erc20Abi,
    erc721Abi,
    getAddress,
    maxUint256,
} from 'viem'
import type { Address, Hex, TransactionSerializableEIP1559 } from 'viem'
import {
    i18nKey,
    type ChainScope,
    type ReviewContext,
    type TransactionReview,
    type TransactionReviewer,
    type TransactionSummary,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { getAssetById, type PeraAsset } from '@perawallet/wallet-core-assets'
import { evmCapabilityDefaults } from '../../capability-defaults'
import { ETHEREUM } from '../../__tests__/evm-chains'
import {
    createEthereumReviewer,
    ethereumViewOf,
    type CallRecogniser,
} from '../review'
import { readEthereumNative } from '../transaction-view'
import { spendApprovalSummary, swapSummary } from '../../transfer/summary'
import {
    ATTACKER,
    V2_PORTION_UNWRAP,
    V3_EXACT_IN_PERMIT_SWEEP,
    V4_SWAP,
    hostileFeeSwap,
    type RecordedCall,
} from './contract-action-fixtures'
import { SENDER, TRANSFER } from './fixtures'

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    getAssetById: vi.fn(async () => null),
}))

const ethereumReviewerAdapter = createEthereumReviewer({ chain: ETHEREUM })

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SEPOLIA: ChainScope = { chainId: 'ethereum', networkId: 'sepolia' }
const TOKEN: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const SPENDER: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const RECIPIENT = getAddress(TRANSFER.to as Address)
const STRANGER: Address = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const TOKEN_UNITS = 5_000_000n

const CONTEXT: ReviewContext = {
    scope: MAINNET,
    heldAddresses: [SENDER],
    isWalletBuilt: false,
    capabilities: evmCapabilityDefaults,
}
const WALLET_BUILT: ReviewContext = { ...CONTEXT, isWalletBuilt: true }

const APPROVE_DATA = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [SPENDER, maxUint256],
})

const transferData = (to: Address, amount: bigint): Hex =>
    encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to, amount],
    })

const APPROVE: TransactionSerializableEIP1559 = {
    ...TRANSFER,
    to: TOKEN,
    value: 0n,
    data: APPROVE_DATA,
    gas: 60_000n,
}

// No standard token function has this selector.
const NON_STANDARD_DATA: Hex = '0x5ae401dc'

const NON_STANDARD_CALL: TransactionSerializableEIP1559 = {
    ...APPROVE,
    data: NON_STANDARD_DATA,
}

const TOKEN_TRANSFER: TransactionSerializableEIP1559 = {
    ...TRANSFER,
    to: TOKEN,
    value: 0n,
    data: transferData(RECIPIENT, TOKEN_UNITS),
    gas: 65_000n,
}

const NFT_CONTRACT: Address = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
const NFT_ID = `${NFT_CONTRACT}/7`

const erc721Data = (from: Address, to: Address, tokenId: bigint): Hex =>
    encodeFunctionData({
        abi: erc721Abi,
        functionName: 'safeTransferFrom',
        args: [from, to, tokenId],
    })

const erc1155Data = (
    from: Address,
    to: Address,
    tokenId: bigint,
    amount: bigint,
): Hex =>
    encodeFunctionData({
        abi: erc1155Abi,
        functionName: 'safeTransferFrom',
        args: [from, to, tokenId, amount, '0x'],
    })

const nftTransfer = (data: Hex): TransactionSerializableEIP1559 => ({
    ...TRANSFER,
    to: NFT_CONTRACT,
    value: 0n,
    data,
    gas: 100_000n,
})

const ERC721_TRANSFER = nftTransfer(erc721Data(SENDER, RECIPIENT, 7n))
const ERC1155_TRANSFER = nftTransfer(erc1155Data(SENDER, RECIPIENT, 7n, 2n))

const OPAQUE_SUMMARY: TransactionSummary = {
    kind: 'contract-call',
    title: { key: i18nKey('dapp.claimed') },
    direction: 'none',
    icon: 'contract-call',
}

// What the wallet's ERC-20 send builds as its summary.
const tokenClaim = (
    overrides: Partial<TransactionSummary> = {},
): TransactionSummary => ({
    kind: 'token-transfer',
    title: { key: i18nKey('transactions.list_item.send') },
    direction: 'out',
    icon: 'send',
    counterparty: RECIPIENT,
    amount: {
        assetRef: { chainId: 'ethereum', assetId: TOKEN },
        value: new Decimal(TOKEN_UNITS.toString()),
    },
    ...overrides,
})

// What the wallet's NFT send builds as its summary.
const nftClaim = (
    quantity: number,
    overrides: Partial<TransactionSummary> = {},
): TransactionSummary => ({
    kind: 'nft-transfer',
    title: { key: i18nKey('transactions.list_item.send') },
    direction: 'out',
    icon: 'send',
    counterparty: RECIPIENT,
    subtitle: {
        key: i18nKey('transactions.list_item.nft_subtitle'),
        params: { collection: 'Apes', tokenId: '7' },
    },
    amount: {
        assetRef: { chainId: 'ethereum', assetId: NFT_ID },
        value: new Decimal(quantity),
    },
    ...overrides,
})

const unsigned = (
    transaction: TransactionSerializableEIP1559,
    {
        from = SENDER,
        summary = OPAQUE_SUMMARY,
        scope = MAINNET,
    }: { from?: string; summary?: TransactionSummary; scope?: ChainScope } = {},
): UnsignedTransaction => ({
    scope,
    payload: { from, transaction },
    summary,
    chainData: { family: 'evm' },
})

const review = async (
    transactions: UnsignedTransaction[],
    context: ReviewContext = CONTEXT,
    reviewer: TransactionReviewer = ethereumReviewerAdapter,
): Promise<TransactionReview> => {
    const decoded = await reviewer.decoder.decode(transactions, context)
    return {
        ...decoded,
        warnings: reviewer.warnings.detect(transactions, decoded, context),
    }
}

const reviewOne = async (
    transaction: UnsignedTransaction,
    context: ReviewContext = CONTEXT,
) => {
    const reviewed = await review([transaction], context)
    const [only] = reviewed.transactions
    return {
        reviewed,
        summary: only.summary,
        view: readEthereumNative(only.native),
    }
}

describe('ethereumReviewerAdapter', () => {
    describe('a call whose gas estimate reverted', () => {
        const withRevert = (
            transaction: TransactionSerializableEIP1559,
            revertedEstimate: unknown,
        ): UnsignedTransaction => ({
            ...unsigned(transaction),
            payload: { from: SENDER, transaction, revertedEstimate },
        })

        it("carries the revert and the contract's reason onto the view of a contract call", async () => {
            const { view } = await reviewOne(
                withRevert(NON_STANDARD_CALL, { reason: 'EXPIRED' }),
            )

            expect(view).toMatchObject({
                kind: 'contract-call',
                revertedEstimate: { reason: 'EXPIRED' },
            })
        })

        it('carries it onto a plain send too, which is never simulated', async () => {
            const { view } = await reviewOne(withRevert(TRANSFER, {}))

            expect(view.kind).toBe('transfer')
            expect('revertedEstimate' in view && view.revertedEstimate).toEqual(
                {},
            )
        })

        it('never signs a plain send without review', async () => {
            const { reviewed } = await reviewOne(withRevert(TRANSFER, {}))

            expect(
                ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
            ).toBe(false)
        })

        it('refuses a malformed revert rather than dropping it', async () => {
            await expect(
                ethereumReviewerAdapter.decoder.decode(
                    [withRevert(NON_STANDARD_CALL, { reason: 42 })],
                    CONTEXT,
                ),
            ).rejects.toThrow('malformed')
        })

        it('leaves a call with no revert unflagged', async () => {
            const { view } = await reviewOne(unsigned(NON_STANDARD_CALL))

            expect('revertedEstimate' in view).toBe(false)
        })
    })

    describe('a native transfer', () => {
        it('is a send of its wei to its checksummed recipient', async () => {
            const { summary, view } = await reviewOne(unsigned(TRANSFER))

            expect(summary).toEqual({
                kind: 'transfer',
                title: { key: 'transactions.list_item.send' },
                direction: 'out',
                counterparty: RECIPIENT,
                amount: {
                    assetRef: ETHEREUM.descriptor.nativeAsset.ref,
                    value: new Decimal((10n ** 18n).toString()),
                },
                icon: 'send',
            })
            expect(view.kind).toBe('transfer')
            expect(view.data).toBe('0x')
            expect(view.selector).toBeUndefined()
        })

        it('charges gas times the max fee, lists the sender, and signs without review', async () => {
            const { reviewed } = await reviewOne(unsigned(TRANSFER))

            expect(reviewed.totalFees).toEqual(
                new Decimal((21_000n * 20_000_000_000n).toString()),
            )
            expect(reviewed.signableAddresses).toEqual([SENDER])
            expect(reviewed.warnings).toEqual([])
            expect(
                ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
            ).toBe(true)
        })

        it("carries the payload's fee estimate as Decimal wei, and none when it has none", async () => {
            const withEstimate = {
                ...unsigned(TRANSFER),
                payload: {
                    from: SENDER,
                    transaction: TRANSFER,
                    feeEstimate: { preset: 'fast', amount: 63_000n },
                },
            }

            const priced = await reviewOne(withEstimate)
            const plain = await reviewOne(unsigned(TRANSFER))

            expect(priced.view).toMatchObject({
                feeEstimate: { preset: 'fast', amount: new Decimal(63_000) },
            })
            expect(plain.view).not.toHaveProperty('feeEstimate')
        })

        it('gives a batch preview no fee estimate', async () => {
            const preview = {
                ...unsigned(TRANSFER),
                payload: {
                    from: SENDER,
                    transaction: TRANSFER,
                    isPreview: true,
                    feeEstimate: { preset: 'fast', amount: 63_000n },
                },
            }

            const view = ethereumViewOf(preview, ETHEREUM)

            expect(view).toMatchObject({ isPreview: true })
            expect(view).not.toHaveProperty('feeEstimate')
        })

        it('is a self-transfer when it goes back to the sender', async () => {
            const { summary } = await reviewOne(
                unsigned({ ...TRANSFER, to: SENDER.toLowerCase() as Address }),
            )

            expect(summary).toMatchObject({
                direction: 'self',
                icon: 'self',
                counterparty: SENDER,
            })
        })
    })

    describe('approve(spender, 2^256-1)', () => {
        it('is an approval to its spender, its view still a contract call with selector and target', async () => {
            const { summary, view } = await reviewOne(unsigned(APPROVE))

            expect(summary).toEqual({
                kind: 'approval',
                title: { key: 'transactions.list_item.approval' },
                direction: 'none',
                counterparty: SPENDER,
                icon: 'approval',
            })
            expect(view).toMatchObject({
                kind: 'contract-call',
                to: TOKEN,
                data: APPROVE_DATA,
                selector: '0x095ea7b3',
            })
        })

        it('warns once, as a danger, and needs review', async () => {
            const { reviewed } = await reviewOne(unsigned(APPROVE))

            expect(reviewed.warnings).toEqual([
                expect.objectContaining({
                    type: 'token-approval',
                    severity: 'danger',
                }),
            ])
            expect(
                ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
            ).toBe(false)
        })
    })

    describe("the wallet's own ERC-20 transfer", () => {
        it('is a token transfer of the amount the calldata carries', async () => {
            const { reviewed, summary, view } = await reviewOne(
                unsigned(TOKEN_TRANSFER, { summary: tokenClaim() }),
                WALLET_BUILT,
            )

            expect(summary).toEqual({
                kind: 'token-transfer',
                title: { key: 'transactions.list_item.send' },
                direction: 'out',
                counterparty: RECIPIENT,
                amount: {
                    assetRef: { chainId: 'ethereum', assetId: TOKEN },
                    value: new Decimal(TOKEN_UNITS.toString()),
                },
                icon: 'send',
            })
            expect(view.token).toEqual({
                contract: TOKEN,
                to: RECIPIENT,
                amount: new Decimal(TOKEN_UNITS.toString()),
            })
            expect(
                ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
            ).toBe(true)
        })

        it('is rebuilt from the verified values, never echoed from the claim', async () => {
            const { summary } = await reviewOne(
                unsigned(TOKEN_TRANSFER, {
                    summary: tokenClaim({
                        title: { key: i18nKey('forged.title') },
                        subtitle: { key: i18nKey('forged.subtitle') },
                        counterparty: RECIPIENT.toLowerCase(),
                        direction: 'in',
                        icon: 'receive',
                    }),
                }),
                WALLET_BUILT,
            )

            expect(summary).toEqual(
                expect.objectContaining({
                    title: { key: 'transactions.list_item.send' },
                    counterparty: RECIPIENT,
                    direction: 'out',
                    icon: 'send',
                }),
            )
            expect(summary.subtitle).toBeUndefined()
        })
    })

    describe("the wallet's own swap and spend approval", () => {
        const APPROVAL_DATA = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [SPENDER, TOKEN_UNITS],
        })
        const SWAP_CALL = NON_STANDARD_CALL
        const BOUNDED_APPROVE = { ...APPROVE, data: APPROVAL_DATA }
        const AMOUNT = {
            assetRef: { chainId: 'ethereum' as const, assetId: TOKEN },
            value: new Decimal(TOKEN_UNITS.toString()),
        }

        it('auto-approves a swap the wallet wrote', async () => {
            const { reviewed, view } = await reviewOne(
                unsigned(SWAP_CALL, {
                    summary: swapSummary(SENDER, TOKEN, AMOUNT),
                }),
                WALLET_BUILT,
            )

            expect(view.kind).toBe('swap-call')
            expect(
                ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
            ).toBe(true)
        })

        it('auto-approves an approval whose calldata is one', async () => {
            const { reviewed } = await reviewOne(
                unsigned(BOUNDED_APPROVE, {
                    summary: spendApprovalSummary(SENDER, SPENDER, AMOUNT),
                }),
                WALLET_BUILT,
            )

            expect(
                ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
            ).toBe(true)
        })

        it('does not take an approval summary over other calldata', async () => {
            const { reviewed, view } = await reviewOne(
                unsigned(SWAP_CALL, {
                    summary: spendApprovalSummary(SENDER, SPENDER, AMOUNT),
                }),
                WALLET_BUILT,
            )

            expect(view.kind).toBe('contract-call')
            expect(
                ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
            ).toBe(false)
        })

        it.each([
            ['swap', SWAP_CALL, swapSummary(SENDER, TOKEN, AMOUNT)],
            [
                'approval',
                BOUNDED_APPROVE,
                spendApprovalSummary(SENDER, SPENDER, AMOUNT),
            ],
        ])(
            'leaves a dApp request with a %s summary to the user',
            async (_kind, transaction, summary) => {
                const { reviewed } = await reviewOne(
                    unsigned(transaction, { summary }),
                    CONTEXT,
                )

                expect(
                    ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
                ).toBe(false)
            },
        )
    })

    // The claim is checked by re-encoding it with the ERC-20 encoder the wallet
    // builds with, not by decoding calldata, so it holds with contractDecoding off.
    describe('a forged token-transfer summary, checked by re-encoding without contractDecoding', () => {
        it.each([
            [
                'on approve calldata',
                unsigned(APPROVE, { summary: tokenClaim() }),
                WALLET_BUILT,
            ],
            [
                'claiming another amount',
                unsigned(TOKEN_TRANSFER, {
                    summary: tokenClaim({
                        amount: {
                            assetRef: { chainId: 'ethereum', assetId: TOKEN },
                            value: new Decimal(1),
                        },
                    }),
                }),
                WALLET_BUILT,
            ],
            [
                'claiming another recipient',
                unsigned(TOKEN_TRANSFER, {
                    summary: tokenClaim({ counterparty: STRANGER }),
                }),
                WALLET_BUILT,
            ],
            [
                'claiming another token',
                unsigned(TOKEN_TRANSFER, {
                    summary: tokenClaim({
                        amount: {
                            assetRef: { chainId: 'ethereum', assetId: SPENDER },
                            value: new Decimal(TOKEN_UNITS.toString()),
                        },
                    }),
                }),
                WALLET_BUILT,
            ],
            [
                'on a request the app did not build',
                unsigned(TOKEN_TRANSFER, { summary: tokenClaim() }),
                CONTEXT,
            ],
        ])('is a contract call %s', async (_, transaction, context) => {
            const { reviewed, summary, view } = await reviewOne(
                transaction,
                context,
            )

            expect(summary.kind).toBe('contract-call')
            expect(summary.title).toEqual({
                key: 'transactions.list_item.contract_call',
            })
            expect(view.token).toBeUndefined()
            expect(
                ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
            ).toBe(false)
        })
    })

    describe("the wallet's own NFT transfer", () => {
        beforeEach(() => {
            vi.mocked(getAssetById).mockResolvedValue({
                assetId: NFT_ID,
                peraMetadata: {
                    collectible: {
                        standard: 'erc721',
                        collection: { name: 'Apes' },
                    },
                },
            } as PeraAsset)
        })

        it.each([
            ['an ERC-721', ERC721_TRANSFER, 1, 'erc721'],
            ['an ERC-1155', ERC1155_TRANSFER, 2, 'erc1155'],
        ] as const)(
            'is %s send of the token the calldata carries, signed without review',
            async (_, transaction, quantity, standard) => {
                const { reviewed, summary, view } = await reviewOne(
                    unsigned(transaction, { summary: nftClaim(quantity) }),
                    WALLET_BUILT,
                )

                expect(summary).toEqual(nftClaim(quantity))
                expect(view.kind).toBe('nft-transfer')
                expect(view.nft).toEqual({
                    assetId: NFT_ID,
                    contract: NFT_CONTRACT,
                    tokenId: '7',
                    standard,
                    to: RECIPIENT,
                    amount: new Decimal(quantity),
                })
                expect(reviewed.warnings).toEqual([])
                expect(
                    ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
                ).toBe(true)
            },
        )

        it('names the collection by its contract when the NFT is not stored', async () => {
            vi.mocked(getAssetById).mockResolvedValue(null)

            const { summary } = await reviewOne(
                unsigned(ERC721_TRANSFER, { summary: nftClaim(1) }),
                WALLET_BUILT,
            )

            expect(summary.subtitle).toEqual({
                key: 'transactions.list_item.nft_subtitle',
                params: { collection: NFT_CONTRACT, tokenId: '7' },
            })
        })

        it('still verifies it, named by its contract, when the store read fails', async () => {
            vi.mocked(getAssetById).mockRejectedValue(new Error('db closed'))

            const { reviewed, summary } = await reviewOne(
                unsigned(ERC721_TRANSFER, { summary: nftClaim(1) }),
                WALLET_BUILT,
            )

            expect(summary.kind).toBe('nft-transfer')
            expect(summary.subtitle?.params?.collection).toBe(NFT_CONTRACT)
            expect(reviewed.warnings).toEqual([])
        })

        it('rebuilds the label from the store, never echoing the claim', async () => {
            const { summary } = await reviewOne(
                unsigned(ERC721_TRANSFER, {
                    summary: nftClaim(1, {
                        subtitle: { key: i18nKey('forged.subtitle') },
                    }),
                }),
                WALLET_BUILT,
            )

            expect(summary.subtitle).toEqual(nftClaim(1).subtitle)
        })
    })

    describe('a forged nft-transfer summary', () => {
        const oneByteOff = (data: Hex): Hex =>
            `${data.slice(0, -2)}${data.endsWith('00') ? '01' : '00'}` as Hex

        it.each([
            [
                'on calldata one byte off',
                unsigned(nftTransfer(oneByteOff(ERC721_TRANSFER.data!)), {
                    summary: nftClaim(1),
                }),
                WALLET_BUILT,
            ],
            [
                "on calldata moving another holder's token",
                unsigned(nftTransfer(erc721Data(STRANGER, RECIPIENT, 7n)), {
                    summary: nftClaim(1),
                }),
                WALLET_BUILT,
            ],
            [
                'on another contract',
                unsigned(
                    { ...ERC721_TRANSFER, to: TOKEN },
                    {
                        summary: nftClaim(1),
                    },
                ),
                WALLET_BUILT,
            ],
            [
                'on a call that also sends ether',
                unsigned(
                    { ...ERC721_TRANSFER, value: 1n },
                    {
                        summary: nftClaim(1),
                    },
                ),
                WALLET_BUILT,
            ],
            [
                'claiming 2 of an ERC-721',
                unsigned(ERC721_TRANSFER, { summary: nftClaim(2) }),
                WALLET_BUILT,
            ],
            [
                'claiming another quantity of an ERC-1155',
                unsigned(ERC1155_TRANSFER, { summary: nftClaim(3) }),
                WALLET_BUILT,
            ],
            [
                'on a request the app did not build',
                unsigned(ERC721_TRANSFER, { summary: nftClaim(1) }),
                CONTEXT,
            ],
        ])(
            'is a contract call %s, with the warning',
            async (_, transaction, context) => {
                const { reviewed, summary, view } = await reviewOne(
                    transaction,
                    context,
                )

                expect(summary.kind).toBe('contract-call')
                expect(view.kind).toBe('contract-call')
                expect(view.nft).toBeUndefined()
                expect(reviewed.warnings).toEqual([
                    expect.objectContaining({ type: 'unknown-contract' }),
                ])
                expect(
                    ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
                ).toBe(false)
            },
        )
    })

    describe('other calls', () => {
        it('is a contract call with no counterparty for a contract creation', async () => {
            const { summary, view } = await reviewOne(
                unsigned({
                    ...TRANSFER,
                    to: undefined,
                    value: 0n,
                    data: '0x6080604052',
                }),
            )

            expect(summary.kind).toBe('contract-call')
            expect(summary.counterparty).toBeUndefined()
            expect(view.to).toBeUndefined()
            expect(view.selector).toBe('0x60806040')
        })

        it('is a contract call with no selector for data shorter than four bytes', async () => {
            const { summary, view } = await reviewOne(
                unsigned({ ...TRANSFER, value: 0n, data: '0xabcd' }),
            )

            expect(summary.kind).toBe('contract-call')
            expect(view.data).toBe('0xabcd')
            expect(view.selector).toBeUndefined()
        })

        it('shows the wei a contract call sends', async () => {
            const { summary } = await reviewOne(
                unsigned({ ...APPROVE, value: 5n }),
            )

            expect(summary).toMatchObject({
                kind: 'contract-call',
                direction: 'out',
                amount: {
                    assetRef: ETHEREUM.descriptor.nativeAsset.ref,
                    value: new Decimal(5),
                },
            })
        })

        it('neither charges nor warns for a sender the wallet does not hold', async () => {
            const reviewed = await review([
                unsigned(APPROVE, { from: STRANGER }),
            ])

            expect(reviewed.totalFees.isZero()).toBe(true)
            expect(reviewed.signableAddresses).toEqual([])
            expect(reviewed.warnings).toEqual([])
        })

        it("lists a held sender in the wallet's spelling, once", async () => {
            const reviewed = await review(
                [unsigned(TRANSFER), unsigned({ ...TRANSFER, nonce: 1 })],
                { ...CONTEXT, heldAddresses: [SENDER.toLowerCase()] },
            )

            expect(reviewed.signableAddresses).toEqual([SENDER.toLowerCase()])
            expect(reviewed.totalFees).toEqual(
                new Decimal((2n * 21_000n * 20_000_000_000n).toString()),
            )
        })
    })

    describe('refuses', () => {
        it.each([
            [
                'without a gas limit',
                unsigned({ ...TRANSFER, gas: undefined }),
                /gas limit and a max fee/,
            ],
            [
                'without a max fee per gas',
                unsigned({ ...TRANSFER, maxFeePerGas: undefined }),
                /gas limit and a max fee/,
            ],
            [
                'for another EIP-155 chain',
                unsigned({ ...TRANSFER, chainId: 11_155_111 }),
                /EIP-155 chain 11155111/,
            ],
            [
                'scoped to another network',
                unsigned(
                    { ...TRANSFER, chainId: 11_155_111 },
                    { scope: SEPOLIA },
                ),
                /sepolia, not .*mainnet/,
            ],
            [
                'with a malformed payload',
                {
                    ...unsigned(TRANSFER),
                    payload: { transaction: TRANSFER },
                },
                /malformed/,
            ],
            [
                'with calldata that is not hex',
                unsigned({ ...TRANSFER, data: 'transfer' as Hex }),
                /malformed/,
            ],
            [
                'with calldata of an odd number of hex digits',
                unsigned({ ...TRANSFER, data: '0xabc' }),
                /malformed/,
            ],
        ])('a transaction %s', async (_, transaction, reason) => {
            await expect(
                ethereumReviewerAdapter.decoder.decode([transaction], CONTEXT),
            ).rejects.toThrow(reason)
        })
    })

    describe('with a call recogniser', () => {
        const VECTORS: [UnsignedTransaction, ReviewContext][] = [
            [unsigned(TRANSFER), CONTEXT],
            [unsigned({ ...TRANSFER, to: SENDER }), CONTEXT],
            [unsigned(APPROVE), CONTEXT],
            [unsigned({ ...APPROVE, value: 5n }), CONTEXT],
            [unsigned(TOKEN_TRANSFER, { summary: tokenClaim() }), WALLET_BUILT],
            [unsigned(APPROVE, { summary: tokenClaim() }), WALLET_BUILT],
            [unsigned({ ...TRANSFER, to: undefined, data: '0x60' }), CONTEXT],
            [unsigned({ ...TRANSFER, data: '0xabcd' }), CONTEXT],
            [unsigned(APPROVE, { from: STRANGER }), CONTEXT],
            [unsigned(TOKEN_TRANSFER), CONTEXT],
        ]

        it('never consults it while contractDecoding is off', async () => {
            const recogniseCall = vi.fn<CallRecogniser>(() => undefined)
            const reviewer = createEthereumReviewer({
                chain: ETHEREUM,
                recogniseCall,
            })

            for (const [transaction, context] of VECTORS) {
                await reviewer.decoder.decode([transaction], context)
            }

            expect(evmCapabilityDefaults.contractDecoding).toBe(false)
            expect(recogniseCall).not.toHaveBeenCalled()
        })

        it('asks it about an unrecognised call once contractDecoding is on, and keeps the call unrecognised when it has no answer', async () => {
            const recogniseCall = vi.fn<CallRecogniser>(() => undefined)
            const reviewer = createEthereumReviewer({
                chain: ETHEREUM,
                recogniseCall,
            })
            const context: ReviewContext = {
                ...CONTEXT,
                capabilities: {
                    ...evmCapabilityDefaults,
                    contractDecoding: true,
                },
            }

            const reviewed = await review(
                [unsigned(NON_STANDARD_CALL)],
                context,
                reviewer,
            )

            expect(recogniseCall).toHaveBeenCalledTimes(1)
            expect(recogniseCall).toHaveBeenCalledWith({
                to: TOKEN,
                data: NON_STANDARD_DATA,
                value: 0n,
            })
            expect(reviewed.transactions[0].summary.kind).toBe('contract-call')
        })

        it('keeps a call it recognises as a kind outside the allowlist behind review, with a warning', async () => {
            const recogniseCall = vi.fn<CallRecogniser>(() => ({
                kind: 'approval',
                title: { key: i18nKey('transactions.list_item.approval') },
                direction: 'none',
                counterparty: SPENDER,
                icon: 'approval',
            }))
            const reviewer = createEthereumReviewer({
                chain: ETHEREUM,
                recogniseCall,
            })
            const context: ReviewContext = {
                ...WALLET_BUILT,
                capabilities: {
                    ...evmCapabilityDefaults,
                    contractDecoding: true,
                },
            }

            const reviewed = await review(
                [unsigned(APPROVE)],
                context,
                reviewer,
            )

            expect(reviewed.transactions[0].summary.kind).toBe('approval')
            expect(reviewed.warnings).toEqual([
                expect.objectContaining({ type: 'unknown-contract' }),
            ])
            expect(reviewer.policy.autoApproveLocal(reviewed)).toBe(false)
        })
    })
})

describe("a dApp's standard token calls", () => {
    const DECODING: ReviewContext = {
        ...CONTEXT,
        capabilities: { ...evmCapabilityDefaults, contractDecoding: true },
    }
    const REVOKE: TransactionSerializableEIP1559 = {
        ...APPROVE,
        data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [SPENDER, 0n],
        }),
    }
    const SET_APPROVAL_FOR_ALL_REVOKE: TransactionSerializableEIP1559 = {
        ...APPROVE,
        to: NFT_CONTRACT,
        data: encodeFunctionData({
            abi: erc721Abi,
            functionName: 'setApprovalForAll',
            args: [SPENDER, false],
        }),
    }
    const SET_APPROVAL_FOR_ALL: TransactionSerializableEIP1559 = {
        ...APPROVE,
        to: NFT_CONTRACT,
        data: encodeFunctionData({
            abi: erc721Abi,
            functionName: 'setApprovalForAll',
            args: [SPENDER, true],
        }),
    }

    it('carry the decoded call on their view, which stays a contract call', () => {
        const view = ethereumViewOf(unsigned(APPROVE), ETHEREUM)

        expect(view).toMatchObject({
            kind: 'contract-call',
            call: {
                kind: 'approve',
                contract: TOKEN,
                spender: SPENDER,
                value: new Decimal(maxUint256.toString()),
            },
        })
    })

    it('name a well-known spender on the view, on mainnet only', () => {
        const toPermit2: TransactionSerializableEIP1559 = {
            ...APPROVE,
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [
                    '0x000000000022D473030F116dDEE9F6B43aC78BA3',
                    maxUint256,
                ],
            }),
        }

        expect(
            ethereumViewOf(unsigned(toPermit2), ETHEREUM)?.knownSpender,
        ).toEqual({ name: 'Permit2', projectDomain: 'uniswap.org' })
        expect(
            ethereumViewOf(
                unsigned(
                    { ...toPermit2, chainId: 11155111 },
                    { scope: SEPOLIA },
                ),
                ETHEREUM,
            ),
        ).not.toHaveProperty('knownSpender')
        const toUnlisted: TransactionSerializableEIP1559 = {
            ...APPROVE,
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [
                    '0x1111111111111111111111111111111111111111',
                    maxUint256,
                ],
            }),
        }
        expect(
            ethereumViewOf(unsigned(toUnlisted), ETHEREUM),
        ).not.toHaveProperty('knownSpender')
    })

    it('name no spender for an approve to a Uniswap position manager, and still name the Universal Router', () => {
        const approveTo = (
            spender: Address,
        ): TransactionSerializableEIP1559 => ({
            ...APPROVE,
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [spender, maxUint256],
            }),
        })

        expect(
            ethereumViewOf(
                unsigned(
                    approveTo('0xC36442b4a4522E871399CD717aBDD847Ab11FE88'),
                ),
                ETHEREUM,
            ),
        ).not.toHaveProperty('knownSpender')
        expect(
            ethereumViewOf(
                unsigned(
                    approveTo('0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af'),
                ),
                ETHEREUM,
            )?.knownSpender,
        ).toEqual({
            name: 'Uniswap Universal Router',
            projectDomain: 'uniswap.org',
        })
    })

    describe('under the shipped capability defaults', () => {
        it('reviews an unlimited approve as an approval with a danger warning, behind review', async () => {
            const { reviewed, summary } = await reviewOne(
                unsigned(APPROVE),
                CONTEXT,
            )

            expect(summary).toEqual({
                kind: 'approval',
                title: { key: 'transactions.list_item.approval' },
                direction: 'none',
                counterparty: SPENDER,
                icon: 'approval',
            })
            expect(reviewed.warnings).toEqual([
                expect.objectContaining({
                    type: 'token-approval',
                    severity: 'danger',
                }),
            ])
            expect(
                ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
            ).toBe(false)
        })

        it('reviews a collection-wide grant with a danger warning', async () => {
            const { reviewed, summary } = await reviewOne(
                unsigned(SET_APPROVAL_FOR_ALL),
                CONTEXT,
            )

            expect(summary.title.key).toBe('transactions.list_item.approval')
            expect(summary.counterparty).toBe(SPENDER)
            expect(reviewed.warnings).toEqual([
                expect.objectContaining({
                    type: 'token-approval',
                    severity: 'danger',
                    message: expect.stringContaining('in this collection'),
                }),
            ])
        })

        it('reviews a revocation without a warning', async () => {
            const { reviewed, summary } = await reviewOne(
                unsigned(REVOKE),
                CONTEXT,
            )

            expect(summary.title.key).toBe(
                'transactions.list_item.revoke_approval',
            )
            expect(reviewed.warnings).toEqual([])
        })

        it('reviews setApprovalForAll(operator, false) as a revocation without a warning', async () => {
            const { reviewed, summary } = await reviewOne(
                unsigned(SET_APPROVAL_FOR_ALL_REVOKE),
                CONTEXT,
            )

            expect(summary.title.key).toBe(
                'transactions.list_item.revoke_approval',
            )
            expect(summary.counterparty).toBe(SPENDER)
            expect(reviewed.warnings).toEqual([])
        })

        it('keeps a token transfer an unrecognised contract call with the unknown-contract warning, since a selector match proves no token', async () => {
            const { reviewed, summary } = await reviewOne(
                unsigned(TOKEN_TRANSFER),
                CONTEXT,
            )

            expect(summary.kind).toBe('contract-call')
            expect(reviewed.warnings).toEqual([
                expect.objectContaining({ type: 'unknown-contract' }),
            ])
        })

        it('reviews a token transfer as a send without a warning while contractDecoding is on, and still never signs it unreviewed', async () => {
            const { reviewed, summary } = await reviewOne(
                unsigned(TOKEN_TRANSFER),
                DECODING,
            )

            expect(summary).toMatchObject({
                kind: 'token-transfer',
                counterparty: RECIPIENT,
                amount: {
                    assetRef: { chainId: 'ethereum', assetId: TOKEN },
                    value: new Decimal(TOKEN_UNITS.toString()),
                },
            })
            expect(reviewed.warnings).toEqual([])
            expect(
                ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
            ).toBe(false)
        })

        it('reads nothing from a call the wallet built', async () => {
            const { reviewed, summary } = await reviewOne(
                unsigned(APPROVE),
                WALLET_BUILT,
            )

            expect(summary.kind).toBe('contract-call')
            expect(reviewed.warnings).toEqual([
                expect.objectContaining({ type: 'unknown-contract' }),
            ])
        })

        it('keeps a call that is not a standard function unrecognised', async () => {
            const { reviewed, summary } = await reviewOne(
                unsigned(NON_STANDARD_CALL),
                CONTEXT,
            )

            expect(summary.kind).toBe('contract-call')
            expect(reviewed.warnings).toEqual([
                expect.objectContaining({ type: 'unknown-contract' }),
            ])
        })
    })

    it.each([
        ['an approve', APPROVE],
        ['a revocation', REVOKE],
        ['a collection approval', SET_APPROVAL_FOR_ALL],
        ['a collection revocation', SET_APPROVAL_FOR_ALL_REVOKE],
    ])(
        'reviews %s the same with contractDecoding on',
        async (_, transaction) => {
            const shipped = await reviewOne(unsigned(transaction), CONTEXT)
            const decoding = await reviewOne(unsigned(transaction), DECODING)

            expect(shipped.summary).toEqual(decoding.summary)
            expect(shipped.reviewed.warnings).toEqual(
                decoding.reviewed.warnings,
            )
        },
    )
})

describe('a call to a known contract', () => {
    const DECODING = {
        capabilities: { ...evmCapabilityDefaults, contractDecoding: true },
    }
    const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

    const recorded = (
        fixture: RecordedCall,
        chainId = 1,
    ): TransactionSerializableEIP1559 => ({
        ...TRANSFER,
        chainId,
        to: fixture.to,
        value: fixture.value,
        data: fixture.data,
        gas: 300_000n,
    })
    const contextOf = (
        fixture: RecordedCall,
        overrides: Partial<ReviewContext> = {},
    ): ReviewContext => ({
        ...CONTEXT,
        heldAddresses: [fixture.from],
        ...overrides,
    })
    const reviewRecorded = (
        fixture: RecordedCall,
        overrides: Partial<ReviewContext> = {},
        scope: ChainScope = MAINNET,
    ) =>
        reviewOne(
            unsigned(recorded(fixture, scope === SEPOLIA ? 11155111 : 1), {
                from: fixture.from,
                scope,
            }),
            contextOf(fixture, { scope, ...overrides }),
        )

    it('reviews a Universal Router swap as a swap, with no unknown-contract warning, while contractDecoding is on', async () => {
        const { reviewed, summary, view } = await reviewRecorded(
            V3_EXACT_IN_PERMIT_SWEEP,
            DECODING,
        )

        expect(summary).toMatchObject({
            kind: 'swap',
            title: { key: 'transactions.list_item.swap' },
            icon: 'swap',
        })
        expect(reviewed.warnings).toEqual([])
        expect(view.knownContract).toEqual({
            kind: 'uniswap-universal-router',
            name: 'Uniswap Universal Router',
            projectDomain: 'uniswap.org',
        })
        expect(view.action).toMatchObject({ kind: 'swap' })
        expect(ethereumReviewerAdapter.policy.autoApproveLocal(reviewed)).toBe(
            false,
        )
    })

    it('keeps the unknown-contract warning on a swap that pays a fee, still titled Swap', async () => {
        const { reviewed, summary, view } = await reviewRecorded(
            V2_PORTION_UNWRAP,
            DECODING,
        )

        expect(summary).toMatchObject({
            kind: 'swap',
            title: { key: 'transactions.list_item.swap' },
        })
        expect(view.action).toMatchObject({
            kind: 'swap',
            fees: [{ size: { kind: 'bips', bips: 100 } }],
        })
        expect(reviewed.warnings).toEqual([
            expect.objectContaining({ type: 'unknown-contract' }),
        ])
    })

    it('keeps the warning when a hostile dApp routes the whole output to a stranger and sweeps a minimum of 1', async () => {
        const hostile = hostileFeeSwap()
        const { reviewed, view } = await reviewRecorded(hostile, DECODING)

        expect(view.action).toMatchObject({
            kind: 'swap',
            output: { amount: new Decimal(1), bound: 'at-least' },
            fees: [
                {
                    recipient: getAddress(ATTACKER),
                    size: { kind: 'bips', bips: 10_000 },
                },
            ],
        })
        expect(reviewed.warnings).toEqual([
            expect.objectContaining({ type: 'unknown-contract' }),
        ])
        expect(ethereumReviewerAdapter.policy.autoApproveLocal(reviewed)).toBe(
            false,
        )
    })

    it('labels a router call with a command it cannot read, without calling it a swap or dropping the warning', async () => {
        const { reviewed, summary, view } = await reviewRecorded(
            V4_SWAP,
            DECODING,
        )

        expect(summary.kind).toBe('contract-call')
        expect(summary.title).toEqual({
            key: 'transactions.list_item.contract_call',
        })
        expect(reviewed.warnings).toEqual([
            expect.objectContaining({ type: 'unknown-contract' }),
        ])
        expect(view.knownContract?.name).toBe('Uniswap Universal Router')
        expect(view.action).toBeUndefined()
    })

    it('keeps a standard token call to a known contract as it was, whatever the label', async () => {
        const transfer: TransactionSerializableEIP1559 = {
            ...TOKEN_TRANSFER,
            to: WETH,
        }

        const { reviewed, summary, view } = await reviewOne(
            unsigned(transfer),
            { ...CONTEXT, ...DECODING },
        )

        expect(summary).toMatchObject({
            kind: 'token-transfer',
            counterparty: RECIPIENT,
        })
        expect(reviewed.warnings).toEqual([])
        expect(view.call?.kind).toBe('transfer')
        expect(view.knownContract?.kind).toBe('wrapped-native')
        expect(view.action).toBeUndefined()
    })

    it('reviews a call to an unlisted contract as it always did', async () => {
        const { reviewed, summary, view } = await reviewOne(
            unsigned(NON_STANDARD_CALL),
            { ...CONTEXT, ...DECODING },
        )

        expect(summary.kind).toBe('contract-call')
        expect(reviewed.warnings).toEqual([
            expect.objectContaining({ type: 'unknown-contract' }),
        ])
        expect(view.knownContract).toBeUndefined()
        expect(view.action).toBeUndefined()
    })

    it('reviews a labelled call without a recognised action as unrecognised', async () => {
        const { reviewed, summary, view } = await reviewOne(
            unsigned({ ...NON_STANDARD_CALL, to: WETH }),
            { ...CONTEXT, ...DECODING },
        )

        expect(summary.kind).toBe('contract-call')
        expect(reviewed.warnings).toEqual([
            expect.objectContaining({ type: 'unknown-contract' }),
        ])
        expect(view.knownContract?.kind).toBe('wrapped-native')
    })

    it('reviews a swap exactly as an unrecognised call while contractDecoding is off, though the view still carries the facts', async () => {
        const { reviewed, summary, view } = await reviewRecorded(
            V3_EXACT_IN_PERMIT_SWEEP,
        )

        expect(evmCapabilityDefaults.contractDecoding).toBe(false)
        expect(summary).toEqual({
            kind: 'contract-call',
            title: { key: 'transactions.list_item.contract_call' },
            direction: 'none',
            counterparty: V3_EXACT_IN_PERMIT_SWEEP.to,
            icon: 'contract-call',
        })
        expect(reviewed.warnings).toEqual([
            expect.objectContaining({ type: 'unknown-contract' }),
        ])
        expect(view.knownContract).toBeDefined()
        expect(view.action).toMatchObject({ kind: 'swap' })
    })

    it('has no registry on a testnet or an unknown network, so the review is today’s', async () => {
        const { reviewed, summary, view } = await reviewRecorded(
            V3_EXACT_IN_PERMIT_SWEEP,
            DECODING,
            SEPOLIA,
        )

        expect(summary.kind).toBe('contract-call')
        expect(reviewed.warnings).toEqual([
            expect.objectContaining({ type: 'unknown-contract' }),
        ])
        expect(view.knownContract).toBeUndefined()
        expect(
            ethereumViewOf(
                unsigned(recorded(V3_EXACT_IN_PERMIT_SWEEP), {
                    from: V3_EXACT_IN_PERMIT_SWEEP.from,
                    scope: { chainId: 'ethereum', networkId: 'custom' },
                }),
                ETHEREUM,
            )?.knownContract,
        ).toBeUndefined()
    })

    it('labels and reads a batch call that is not priced yet', () => {
        const preview: UnsignedTransaction = {
            ...unsigned(recorded(V3_EXACT_IN_PERMIT_SWEEP), {
                from: V3_EXACT_IN_PERMIT_SWEEP.from,
            }),
            payload: {
                from: V3_EXACT_IN_PERMIT_SWEEP.from,
                transaction: {
                    chainId: 1,
                    to: V3_EXACT_IN_PERMIT_SWEEP.to,
                    data: V3_EXACT_IN_PERMIT_SWEEP.data,
                },
                isPreview: true,
            },
        }

        const view = ethereumViewOf(preview, ETHEREUM)

        expect(view).toMatchObject({
            isPreview: true,
            knownContract: { name: 'Uniswap Universal Router' },
            action: { kind: 'swap' },
        })
    })
})
