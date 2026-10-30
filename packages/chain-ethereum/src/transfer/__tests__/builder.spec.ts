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

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { Decimal } from 'decimal.js'
import { setupServer } from 'msw/node'
import {
    decodeFunctionData,
    erc1155Abi,
    erc20Abi,
    erc721Abi,
    getAddress,
    maxUint256,
    parseGwei,
    toHex,
    type Hex,
    type RpcFeeHistory,
} from 'viem'
import type {
    BuildContext,
    ReviewContext,
    TransferIntent,
} from '@perawallet/wallet-core-chain-contract'
import { getAssetById, type PeraAsset } from '@perawallet/wallet-core-assets'
import {
    getOpenSubmissionAttempts,
    type SubmissionAttempt,
} from '@perawallet/wallet-core-signing'
import { InvalidSendParamsError } from '@perawallet/wallet-core-transactions'
import { EvmErrorCode, isEvmError } from '../../blockchain/errors'
import {
    EvmRpcErrorFixture,
    evmRpcHandlers,
    type EvmRpcFixtures,
} from '../../blockchain/msw-handlers'
import { evmCapabilityDefaults as ethereumCapabilityDefaults } from '../../capability-defaults'
import { createEvmPlannerAdapter } from '../../signing/adapter'
import { createEthereumReviewer } from '../../signing/review'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import { BASE, ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import { createEvmTransferAdapter } from '../builder'
import type { EthereumTransactionPayload } from '../../signing/adapter'

// The empty pool by default, so the node's pending count decides the nonce.
vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    getOpenSubmissionAttempts: vi.fn(async () => []),
}))

// No stored asset by default, so only the NFT cases that seed one can build.
vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    getAssetById: vi.fn(async () => null),
}))

const SENDER = '0x00000000000000000000000000000000000000aa'
const RECIPIENT = getAddress('0x00000000000000000000000000000000000000bb')
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const context: BuildContext = {
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
}

const nativeIntent: TransferIntent = {
    kind: 'transfer',
    from: SENDER,
    to: RECIPIENT,
    assetRef: { chainId: 'ethereum', assetId: 'native' },
    amount: new Decimal('1000000000000000000'),
}
const tokenIntent: TransferIntent = {
    ...nativeIntent,
    assetRef: { chainId: 'ethereum', assetId: USDC },
    amount: new Decimal(250),
}

const NFT_CONTRACT = getAddress('0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d')
const NFT_ID = `${NFT_CONTRACT}/7`
const nftIntent = (amount: Decimal.Value): TransferIntent => ({
    ...nativeIntent,
    assetRef: { chainId: 'ethereum', assetId: NFT_ID },
    amount: new Decimal(amount),
})
const storeNft = (standard: 'erc721' | 'erc1155') =>
    vi.mocked(getAssetById).mockResolvedValue({
        assetId: NFT_ID,
        decimals: 0,
        peraMetadata: {
            collectible: { standard, collection: { name: 'Apes' } },
        },
    } as PeraAsset)

const feeHistory = (
    base: bigint[],
    tips: [bigint, bigint, bigint],
): RpcFeeHistory => ({
    oldestBlock: '0x1',
    baseFeePerGas: base.map(fee => toHex(fee)),
    gasUsedRatio: [0.5],
    reward: [tips.map(tip => toHex(tip))],
})

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const adapter = createEvmTransferAdapter(testChainContext(), ETHEREUM)
const ethereumPlannerAdapter = createEvmPlannerAdapter(ETHEREUM)
const ethereumReviewerAdapter = createEthereumReviewer({ chain: ETHEREUM })

const useRpc = (responses: NonNullable<EvmRpcFixtures['responses']> = {}) =>
    server.use(
        ...evmRpcHandlers({
            rpcUrl: TEST_RPC_URL,
            responses: {
                eth_getTransactionCount: '0x4',
                eth_feeHistory: feeHistory(
                    [parseGwei('1'), parseGwei('2')],
                    [parseGwei('0.5'), parseGwei('1'), parseGwei('2')],
                ),
                ...responses,
            },
        }),
    )

describe('Ethereum transfer adapter', () => {
    beforeEach(() => {
        vi.mocked(getOpenSubmissionAttempts).mockResolvedValue([])
    })

    it('builds past a nonce an open send of the account already holds', async () => {
        useRpc()
        vi.mocked(getOpenSubmissionAttempts).mockResolvedValue([
            { nonce: 4 } as SubmissionAttempt,
        ])

        const [built] = await adapter.build(nativeIntent, context)

        const { transaction } = built.payload as EthereumTransactionPayload
        expect(transaction.nonce).toBe(5)
        expect(getOpenSubmissionAttempts).toHaveBeenCalledWith({
            scope: context.scope,
            sender: getAddress(SENDER),
        })
    })

    it('builds a native transfer as an EIP-1559 payload priced from the node', async () => {
        useRpc()

        const [built] = await adapter.build(nativeIntent, context)

        expect(built.payload).toEqual({
            from: getAddress(SENDER),
            transaction: {
                type: 'eip1559',
                chainId: 1,
                nonce: 4,
                to: RECIPIENT,
                value: 10n ** 18n,
                data: undefined,
                gas: 21_000n,
                maxFeePerGas: parseGwei('5'),
                maxPriorityFeePerGas: parseGwei('1'),
            },
        })
        expect(built.chainData).toEqual({ family: 'evm' })
    })

    it('builds an ERC-20 transfer to the token contract with the transfer call as data', async () => {
        let estimatedTo: unknown
        useRpc({
            eth_estimateGas: params => {
                estimatedTo = (params[0] as { to: string }).to
                return '0xfde8'
            },
        })

        const [built] = await adapter.build(tokenIntent, context)

        const { transaction } = built.payload as EthereumTransactionPayload
        expect(String(estimatedTo).toLowerCase()).toBe(USDC.toLowerCase())
        expect(transaction.to).toBe(USDC)
        expect(transaction.value).toBe(0n)
        expect(transaction.gas).toBe(65_000n)
        expect(
            decodeFunctionData({
                abi: erc20Abi,
                data: transaction.data as Hex,
            }),
        ).toEqual({ functionName: 'transfer', args: [RECIPIENT, 250n] })
        expect(built.summary.kind).toBe('token-transfer')
    })

    it('builds a transaction the Ethereum planner asks the sender to sign', async () => {
        useRpc()

        const [built] = await adapter.build(nativeIntent, context)

        expect(ethereumPlannerAdapter.plan(built)).toEqual([
            expect.objectContaining({
                scheme: 'secp256k1',
                signer: getAddress(SENDER),
            }),
        ])
    })

    it('estimates the fee as gas times base fee plus tip, in wei of the native asset', async () => {
        useRpc()

        const estimate = await adapter.getFeeEstimate(nativeIntent, context)

        expect(estimate.assetRef).toEqual({
            chainId: 'ethereum',
            assetId: 'native',
        })
        expect(
            estimate.amount.equals(new Decimal(21_000n * parseGwei('3'))),
        ).toBe(true)
        expect(estimate.amount.equals(estimate.presets!.normal.amount)).toBe(
            true,
        )
        expect(
            estimate.presets!.slow.amount.equals(
                new Decimal(21_000n * parseGwei('2.5')),
            ),
        ).toBe(true)
        expect(
            estimate.presets!.fast.amount.equals(
                new Decimal(21_000n * parseGwei('4')),
            ),
        ).toBe(true)
        expect(
            estimate.presets!.fast.maxAmount.equals(
                new Decimal(21_000n * parseGwei('6')),
            ),
        ).toBe(true)
    })

    it('builds at the preset the context picks', async () => {
        useRpc()
        const fastContext = { ...context, feePreset: 'fast' } as const

        const [built] = await adapter.build(nativeIntent, fastContext)
        const estimate = await adapter.getFeeEstimate(nativeIntent, fastContext)

        expect(built.payload).toMatchObject({
            transaction: {
                maxPriorityFeePerGas: parseGwei('2'),
                maxFeePerGas: parseGwei('6'),
            },
        })
        expect(estimate.amount.equals(estimate.presets!.fast.amount)).toBe(true)
    })

    it('summarises a transfer to the same address in another case as a self transfer', async () => {
        useRpc()

        const [built] = await adapter.build(
            { ...nativeIntent, to: SENDER.toUpperCase().replace('0X', '0x') },
            context,
        )

        expect(built.summary).toMatchObject({ direction: 'self', icon: 'self' })
    })

    it('drops a note rather than refusing it, as an EVM transfer has no memo', async () => {
        useRpc()

        const [withNote] = await adapter.build(
            { ...tokenIntent, note: 'hi' },
            context,
        )
        const [without] = await adapter.build(tokenIntent, context)

        expect(withNote.payload).toEqual(without.payload)
    })

    it.each([
        ['build', () => adapter.build(nativeIntent, context)],
        ['getFeeEstimate', () => adapter.getFeeEstimate(nativeIntent, context)],
    ])(
        'rejects %s with an insufficient-funds EvmError when the sender cannot cover value and gas',
        async (_, run) => {
            useRpc({
                eth_estimateGas: new EvmRpcErrorFixture(
                    -32000,
                    'insufficient funds for gas * price + value',
                ),
            })

            const error = await run().catch((e: unknown) => e)

            expect(isEvmError(error)).toBe(true)
            expect(error).toMatchObject({
                code: EvmErrorCode.INSUFFICIENT_FUNDS,
            })
        },
    )

    it('rejects a token transfer the contract would revert as an EvmError', async () => {
        useRpc({
            eth_estimateGas: new EvmRpcErrorFixture(3, 'execution reverted'),
        })

        const error = await adapter
            .build(tokenIntent, context)
            .catch((e: unknown) => e)

        expect(isEvmError(error)).toBe(true)
    })

    it.each([
        ['a token id that is not an address', { assetId: 'usdc' }],
        ['a recipient with a broken checksum', { to: `0x${'aB'.repeat(20)}` }],
        ['an amount above uint256', { amount: new Decimal(maxUint256 + 1n) }],
    ])('refuses %s before any request', async (_, override) => {
        const intent: TransferIntent = {
            ...tokenIntent,
            ...('assetId' in override
                ? {
                      assetRef: {
                          chainId: 'ethereum',
                          assetId: override.assetId,
                      },
                  }
                : override),
        }

        await expect(adapter.build(intent, context)).rejects.toBeInstanceOf(
            InvalidSendParamsError,
        )
        await expect(
            adapter.getFeeEstimate(intent, context),
        ).rejects.toBeInstanceOf(InvalidSendParamsError)
    })
})

describe('an NFT transfer', () => {
    beforeEach(() => {
        vi.mocked(getOpenSubmissionAttempts).mockResolvedValue([])
        vi.mocked(getAssetById).mockResolvedValue(null)
    })

    it('builds an ERC-721 as safeTransferFrom to the NFT contract with no value', async () => {
        storeNft('erc721')
        let estimated: { to?: string; data?: string } = {}
        useRpc({
            eth_estimateGas: params => {
                estimated = params[0] as typeof estimated
                return '0x186a0'
            },
        })

        const [built] = await adapter.build(nftIntent(1), context)

        const { transaction } = built.payload as EthereumTransactionPayload
        expect(transaction.to).toBe(NFT_CONTRACT)
        expect(transaction.value).toBe(0n)
        expect(transaction.gas).toBe(100_000n)
        expect(estimated.data).toBe(transaction.data)
        expect(
            decodeFunctionData({
                abi: erc721Abi,
                data: transaction.data as Hex,
            }),
        ).toEqual({
            functionName: 'safeTransferFrom',
            args: [getAddress(SENDER), RECIPIENT, 7n],
        })
    })

    it('summarises it as an NFT send of the quantity, named by collection and token id', async () => {
        storeNft('erc721')
        useRpc()

        const [built] = await adapter.build(nftIntent(1), context)

        expect(built.summary).toEqual({
            kind: 'nft-transfer',
            title: { key: 'transactions.list_item.send' },
            direction: 'out',
            icon: 'send',
            counterparty: RECIPIENT,
            subtitle: {
                key: 'transactions.list_item.nft_subtitle',
                params: { collection: 'Apes', tokenId: '7' },
            },
            amount: {
                assetRef: { chainId: 'ethereum', assetId: NFT_ID },
                value: new Decimal(1),
            },
        })
    })

    it('summarises an NFT sent to its own sender as a self send', async () => {
        storeNft('erc721')
        useRpc()

        const [built] = await adapter.build(
            { ...nftIntent(1), to: SENDER },
            context,
        )

        expect(built.summary).toMatchObject({
            kind: 'nft-transfer',
            direction: 'self',
        })
    })

    it('builds an ERC-1155 as safeTransferFrom of the amount with empty data', async () => {
        storeNft('erc1155')
        useRpc()

        const [built] = await adapter.build(nftIntent(2), context)

        const { transaction } = built.payload as EthereumTransactionPayload
        expect(transaction.to).toBe(NFT_CONTRACT)
        expect(transaction.value).toBe(0n)
        expect(
            decodeFunctionData({
                abi: erc1155Abi,
                data: transaction.data as Hex,
            }),
        ).toEqual({
            functionName: 'safeTransferFrom',
            args: [getAddress(SENDER), RECIPIENT, 7n, 2n, '0x'],
        })
        expect(built.summary.amount?.value).toEqual(new Decimal(2))
    })

    it('prices an ERC-1155 before an amount is entered', async () => {
        storeNft('erc1155')
        useRpc()

        const estimate = await adapter.getFeeEstimate(nftIntent(0), context)

        expect(estimate.amount.isPositive()).toBe(true)
    })

    it('refuses to build an ERC-1155 of 0, which review would not honour', async () => {
        storeNft('erc1155')

        await expect(
            adapter.build(nftIntent(0), context),
        ).rejects.toBeInstanceOf(InvalidSendParamsError)
    })

    it.each([
        ['an ERC-721 of 2', 'erc721', 2],
        ['an ERC-721 of 0', 'erc721', 0],
        ['an ERC-1155 of 1.5', 'erc1155', 1.5],
        ['an ERC-1155 of -1', 'erc1155', -1],
    ] as const)(
        'refuses %s before any request',
        async (_, standard, amount) => {
            storeNft(standard)

            await expect(
                adapter.build(nftIntent(amount), context),
            ).rejects.toBeInstanceOf(InvalidSendParamsError)
            await expect(
                adapter.getFeeEstimate(nftIntent(amount), context),
            ).rejects.toBeInstanceOf(InvalidSendParamsError)
        },
    )

    it('refuses an NFT the asset store does not hold', async () => {
        await expect(
            adapter.build(nftIntent(1), context),
        ).rejects.toBeInstanceOf(InvalidSendParamsError)
    })

    it.each([
        ['build', () => adapter.build(nftIntent(1), context)],
        ['getFeeEstimate', () => adapter.getFeeEstimate(nftIntent(1), context)],
    ])(
        'rejects %s with the revert reason when the recipient cannot receive it',
        async (_, run) => {
            storeNft('erc721')
            useRpc({
                eth_estimateGas: new EvmRpcErrorFixture(
                    3,
                    'execution reverted: ERC721: transfer to non ERC721Receiver implementer',
                ),
            })

            const error = await run().catch((e: unknown) => e)

            expect(isEvmError(error)).toBe(true)
            expect(error).toMatchObject({
                code: EvmErrorCode.REVERTED_WITH_REASON,
            })
        },
    )
})

describe('a transfer the adapter builds, reviewed as the wallet built it', () => {
    const walletBuilt: ReviewContext = {
        scope: context.scope,
        heldAddresses: [SENDER],
        isWalletBuilt: true,
        capabilities: ethereumCapabilityDefaults,
    }

    it.each([
        ['a native transfer', nativeIntent, 'transfer', undefined],
        ['an ERC-20 transfer', tokenIntent, 'token-transfer', undefined],
        ['an ERC-721 transfer', nftIntent(1), 'nft-transfer', 'erc721'],
        ['an ERC-1155 transfer', nftIntent(2), 'nft-transfer', 'erc1155'],
    ] as const)(
        'reviews %s as the same summary it was built with, and auto-approves it',
        async (_, intent, kind, standard) => {
            vi.mocked(getAssetById).mockResolvedValue(null)
            if (standard) storeNft(standard)
            useRpc({ eth_estimateGas: '0xfde8' })
            const built = await adapter.build(intent, context)

            const decoded = await ethereumReviewerAdapter.decoder.decode(
                built,
                walletBuilt,
            )
            const warnings = ethereumReviewerAdapter.warnings.detect(
                built,
                decoded,
                walletBuilt,
            )

            expect(decoded.transactions.map(t => t.summary)).toEqual([
                built[0].summary,
            ])
            expect(decoded.transactions[0].summary.kind).toBe(kind)
            expect(warnings).toEqual([])
            expect(
                ethereumReviewerAdapter.policy.autoApproveLocal({
                    ...decoded,
                    warnings,
                }),
            ).toBe(true)
        },
    )
})

describe('a transfer built for Base', () => {
    const base = createEvmTransferAdapter(
        testChainContext({ chain: BASE }),
        BASE,
    )
    const intentOn = (assetId: string): TransferIntent => ({
        ...nativeIntent,
        assetRef: { chainId: 'base', assetId },
    })

    beforeEach(() => {
        vi.mocked(getOpenSubmissionAttempts).mockResolvedValue([])
        // The gas price oracle's getL1Fee and getOperatorFee each answer 1000 wei.
        useRpc({ eth_call: toHex(1000n, { size: 32 }) })
    })

    it.each([
        ['mainnet', 8453],
        ['sepolia', 84532],
    ] as const)("carries %s's EIP-155 id", async (tier, eip155ChainId) => {
        const scope = evmScopeOf(
            BASE,
            tier === 'mainnet' ? 'mainnet' : 'testnet',
        )
        const adapterOn = createEvmTransferAdapter(
            {
                ...testChainContext({ chain: BASE }),
                getEndpoints: () => ({ [scope.networkId]: TEST_RPC_URL }),
            },
            BASE,
        )

        const [built] = await adapterOn.build(intentOn('native'), { scope })

        expect(built?.scope).toEqual(scope)
        expect(
            (built?.payload as EthereumTransactionPayload).transaction.chainId,
        ).toBe(eip155ChainId)
    })

    it('makes no oracle read when it builds, since the fee is priced at submission', async () => {
        const reads: unknown[] = []
        useRpc({
            eth_call: params => {
                reads.push(params[0])
                return '0x'
            },
        })

        await base.build(intentOn('native'), { scope: evmScopeOf(BASE) })

        expect(reads).toEqual([])
    })

    it("refuses an intent for another EVM chain's asset", async () => {
        await expect(
            base.build(nativeIntent, { scope: evmScopeOf(BASE) }),
        ).rejects.toThrow(InvalidSendParamsError)
    })

    it("refuses a scope that isn't Base's", async () => {
        await expect(base.build(intentOn('native'), context)).rejects.toThrow()
    })
})
