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

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { setupServer } from 'msw/node'
import {
    decodeFunctionData,
    erc20Abi,
    getAddress,
    maxUint256,
    parseGwei,
    toHex,
    type Hex,
    type RpcFeeHistory,
} from 'viem'
import type {
    BuildContext,
    TransferIntent,
} from '@perawallet/wallet-core-chain-contract'
import { InvalidSendParamsError } from '@perawallet/wallet-core-transactions'
import { EvmErrorCode, isEvmError } from '../../blockchain/errors'
import {
    EvmRpcErrorFixture,
    evmRpcHandlers,
    type EvmRpcFixtures,
} from '../../blockchain/msw-handlers'
import { ethereumPlannerAdapter } from '../../signing/adapter'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import { createEthereumTransferAdapter } from '../builder'
import type { EthereumTransactionPayload } from '../../signing/adapter'

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

const adapter = createEthereumTransferAdapter(testChainContext())

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
