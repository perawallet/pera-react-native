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
        it('is an unrecognised contract call with its selector and target, and no title guess', async () => {
            const { summary, view } = await reviewOne(unsigned(APPROVE))

            expect(summary).toEqual({
                kind: 'contract-call',
                title: { key: 'transactions.list_item.contract_call' },
                direction: 'none',
                counterparty: TOKEN,
                icon: 'contract-call',
            })
            expect(view).toMatchObject({
                kind: 'contract-call',
                to: TOKEN,
                data: APPROVE_DATA,
                selector: '0x095ea7b3',
            })
        })

        it('warns once and needs review', async () => {
            const { reviewed } = await reviewOne(unsigned(APPROVE))

            expect(reviewed.warnings).toEqual([
                expect.objectContaining({
                    type: 'unknown-contract',
                    severity: 'warning',
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

    describe('with contractDecoding on', () => {
        it('reviews an unlimited approve as an approval with a danger warning, behind review', async () => {
            const { reviewed, summary } = await reviewOne(
                unsigned(APPROVE),
                DECODING,
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
            const { reviewed } = await reviewOne(
                unsigned(SET_APPROVAL_FOR_ALL),
                DECODING,
            )

            expect(reviewed.warnings).toEqual([
                expect.objectContaining({
                    type: 'token-approval',
                    severity: 'danger',
                }),
            ])
        })

        it('reviews a revocation without a warning', async () => {
            const { reviewed, summary } = await reviewOne(
                unsigned(REVOKE),
                DECODING,
            )

            expect(summary.title.key).toBe(
                'transactions.list_item.revoke_approval',
            )
            expect(reviewed.warnings).toEqual([])
        })

        it('reviews a token transfer as a send without a warning, and still never signs it unreviewed', async () => {
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
            const { reviewed, summary } = await reviewOne(unsigned(APPROVE), {
                ...DECODING,
                isWalletBuilt: true,
            })

            expect(summary.kind).toBe('contract-call')
            expect(reviewed.warnings).toEqual([
                expect.objectContaining({ type: 'unknown-contract' }),
            ])
        })

        it('keeps a call that is not a standard function unrecognised', async () => {
            const { reviewed, summary } = await reviewOne(
                unsigned(NON_STANDARD_CALL),
                DECODING,
            )

            expect(summary.kind).toBe('contract-call')
            expect(reviewed.warnings).toEqual([
                expect.objectContaining({ type: 'unknown-contract' }),
            ])
        })
    })

    describe('with contractDecoding off', () => {
        it.each([
            ['an approve', APPROVE],
            ['a revocation', REVOKE],
            ['a collection approval', SET_APPROVAL_FOR_ALL],
            ['a token transfer', TOKEN_TRANSFER],
        ])(
            'reviews %s as an unrecognised contract call, as before',
            async (_, transaction) => {
                const { reviewed, summary } = await reviewOne(
                    unsigned(transaction),
                )

                expect(summary.kind).toBe('contract-call')
                expect(reviewed.warnings).toEqual([
                    expect.objectContaining({ type: 'unknown-contract' }),
                ])
                expect(
                    ethereumReviewerAdapter.policy.autoApproveLocal(reviewed),
                ).toBe(false)
            },
        )
    })
})
