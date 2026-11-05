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
import {
    encodeFunctionData,
    encodeFunctionResult,
    erc20Abi,
    numberToHex,
    serializeTransaction,
} from 'viem'
import type { Address, Hex } from 'viem'
import {
    initializeDatabase,
    resetDatabase,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import type { UnsignedTransaction } from '@perawallet/wallet-core-chain-contract'
import {
    getOpenSubmissionAttempts,
    type SubmissionAttempt,
    type TransactionSignRequest,
    type UnsignedTransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import type {
    ExecuteSwapParams,
    SwapExecutionContext,
    SwapOrder,
    SwapQuote,
} from '@perawallet/wallet-core-swaps'
import { EvmError, EvmErrorCode } from '../../blockchain/errors'
import {
    fakeNode,
    ROUTER,
    SENDER,
    server,
    signAsSender,
    TOKEN,
} from '../../connect/callBatch/__tests__/harness'
import { testChainContext } from '../../__tests__/context'
import { ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import { readEvmTransaction } from '../../signing/adapter'
import { waitForEvmReceipt } from '../../transfer/submission'
import { executeEvmSwap } from '../execute-evm-swap'

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        getOpenSubmissionAttempts: vi.fn(actual.getOpenSubmissionAttempts),
    }
})

vi.mock('../../transfer/submission', async importOriginal => {
    const actual =
        await importOriginal<typeof import('../../transfer/submission')>()
    return {
        ...actual,
        waitForEvmReceipt: vi.fn(actual.waitForEvmReceipt),
    }
})

const AMOUNT = 1_000_000n
const ROUTER_NONCE = 99
const RICH = numberToHex(10n ** 21n)
const NATIVE = ETHEREUM.nativeAsset.assetId
const scope = evmScopeOf(ETHEREUM)
const ctx = testChainContext()

const encodeCall = (to: Address, data: Hex, value = 0n): string =>
    serializeTransaction({
        type: 'eip1559',
        chainId: 1,
        to,
        value,
        data,
        nonce: ROUTER_NONCE,
        gas: 1n,
        maxFeePerGas: 1n,
        maxPriorityFeePerGas: 1n,
    })

const APPROVE_TX = encodeCall(
    TOKEN,
    encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [ROUTER, AMOUNT],
    }),
)
const SWAP_TX = encodeCall(ROUTER, '0x5ae401dc')

const orderOf = (transactions: string[]): SwapOrder => ({
    orderId: 'order-1',
    status: 'pending',
    expiresAt: null,
    steps: [
        {
            kind: 'sign-transactions',
            scope,
            purpose: 'swap',
            transactions,
            presignedTransactions: null,
        },
    ],
})

const quoteOf = (assetId: string = TOKEN): SwapQuote =>
    ({
        quoteId: 'quote-1',
        fetchedAt: Date.now(),
        expiresAt: null,
        request: {
            sourceAsset: { ...scope, assetId },
            destinationAsset: { ...scope, assetId: NATIVE },
            sourceAmount: new Decimal(AMOUNT.toString()),
            sourceAddress: SENDER,
            destinationAddress: SENDER,
            slippage: null,
        },
    }) as unknown as SwapQuote

const inputOf = (
    overrides: Partial<ExecuteSwapParams> = {},
): ExecuteSwapParams => ({
    quote: quoteOf(),
    account: null,
    signer: null,
    signingSource: { name: 'Pera Swap', description: 'Swap' },
    onProgress: vi.fn(),
    isCancelled: () => false,
    ...overrides,
})

type Signing = (request: UnsignedTransactionSignRequest) => Promise<void>

const signs: Signing = async request => {
    const [unsigned] = request.txs as UnsignedTransaction[]
    await request.approve?.([await signAsSender(unsigned)])
}

const contextOf = (
    order: SwapOrder,
    signing: Signing = signs,
): SwapExecutionContext & { signed: UnsignedTransaction[] } => {
    const signed: UnsignedTransaction[] = []
    return {
        signed,
        scope,
        deviceId: null,
        addSignRequest: vi.fn((request: TransactionSignRequest) => {
            const unsignedRequest = request as UnsignedTransactionSignRequest
            signed.push(...(unsignedRequest.txs as UnsignedTransaction[]))
            void signing(unsignedRequest)
        }),
        createOrder: vi.fn(async () => order),
        reportOrder: vi.fn(async () => undefined),
        registerHandoff: vi.fn(),
        onOrderSubmitting: vi.fn(),
        onOrderRejected: vi.fn(),
    }
}

const run = (
    context: SwapExecutionContext,
    input: ExecuteSwapParams = inputOf(),
    routeContracts: readonly Address[] = [ROUTER],
) => executeEvmSwap({ ctx, chain: ETHEREUM, routeContracts, input, context })

const allowance = (amount: bigint): Hex =>
    encodeFunctionResult({
        abi: erc20Abi,
        functionName: 'allowance',
        result: amount,
    })

const CANCELLED = {
    orderId: 'order-1',
    report: { status: 'cancelled' },
}

const attempt = (status: SubmissionAttempt['status']) =>
    ({ status }) as unknown as SubmissionAttempt

const flushCancelReport = () => new Promise(resolve => setTimeout(resolve))

describe('executeEvmSwap', () => {
    let teardown: () => void

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
    afterAll(() => server.close())

    beforeEach(async () => {
        const database = createTestDatabase()
        teardown = database.teardown
        await initializeDatabase({
            getDatabase: async () => database.db,
        } as unknown as Parameters<typeof initializeDatabase>[0])
    })

    afterEach(() => {
        server.resetHandlers()
        resetDatabase()
        teardown()
    })

    it('sends the approval, waits for it, then sends the swap and reports both', async () => {
        const node = fakeNode({ balance: RICH })
        const context = contextOf(orderOf([APPROVE_TX, SWAP_TX]))

        const result = await run(context)

        expect(result.kind).toBe('success')
        const [approveHash, swapHash] = [...node.sent.keys()]
        expect(node.events.indexOf(`send:${swapHash}`)).toBeGreaterThan(
            node.events.indexOf(`receipt:${approveHash}:0x1`),
        )
        expect(context.signed.map(tx => tx.summary?.kind)).toEqual([
            'approval',
            'swap',
        ])
        expect(context.reportOrder).toHaveBeenCalledWith({
            orderId: 'order-1',
            report: {
                status: 'sent',
                transactions: [
                    { scope, txHash: approveHash, purpose: 'approval' },
                    { scope, txHash: swapHash, purpose: 'swap' },
                ],
            },
        })
    })

    it('records the amount the approval grants, which can be under the swap', async () => {
        fakeNode({ balance: RICH })
        const granted = AMOUNT / 2n
        const partial = encodeCall(
            TOKEN,
            encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [ROUTER, granted],
            }),
        )
        const context = contextOf(orderOf([partial, SWAP_TX]))

        await run(context)

        expect(context.signed[0].summary?.amount?.value).toEqual(
            new Decimal(granted.toString()),
        )
    })

    it('skips the approval when the allowance already covers the amount', async () => {
        const node = fakeNode({ balance: RICH, callResult: allowance(AMOUNT) })
        const context = contextOf(orderOf([APPROVE_TX, SWAP_TX]))

        const result = await run(context)

        expect(result.kind).toBe('success')
        expect(context.signed.map(tx => tx.summary?.kind)).toEqual(['swap'])
        const [swapHash] = [...node.sent.keys()]
        expect(context.reportOrder).toHaveBeenCalledWith({
            orderId: 'order-1',
            report: {
                status: 'sent',
                transactions: [{ scope, txHash: swapHash, purpose: 'swap' }],
            },
        })
    })

    it('keeps the approval when the allowance falls short', async () => {
        fakeNode({ balance: RICH, callResult: allowance(AMOUNT - 1n) })
        const context = contextOf(orderOf([APPROVE_TX, SWAP_TX]))

        await run(context)

        expect(context.signed).toHaveLength(2)
    })

    it('sets its own nonces, ignoring the router', async () => {
        fakeNode({ balance: RICH })
        const context = contextOf(orderOf([APPROVE_TX, SWAP_TX]))

        await run(context)

        const nonces = context.signed.map(
            tx => readEvmTransaction(tx, ETHEREUM).transaction.nonce,
        )
        expect(nonces).toEqual([0, 1])
    })

    it('uses a real gas estimate, not the router gas', async () => {
        fakeNode({ balance: RICH })
        const context = contextOf(orderOf([SWAP_TX]))

        await run(context, inputOf())

        const { transaction } = readEvmTransaction(context.signed[0], ETHEREUM)
        expect(transaction.gas).toBeGreaterThan(1n)
        expect(transaction.maxFeePerGas).toBeGreaterThan(1n)
    })

    it('signs nothing the validator refuses, and cancels the order', async () => {
        fakeNode({ balance: RICH })
        const context = contextOf(orderOf([SWAP_TX]))

        const result = await run(context, inputOf(), [TOKEN])

        expect(result).toEqual({
            kind: 'failed',
            failure: { phase: 'prepare', reason: 'quote-mismatch' },
        })
        expect(context.addSignRequest).not.toHaveBeenCalled()
        await flushCancelReport()
        expect(context.reportOrder).toHaveBeenCalledWith(CANCELLED)
    })

    it('creates no order while the route declares no contracts', async () => {
        const context = contextOf(orderOf([SWAP_TX]))

        const result = await run(context, inputOf(), [])

        expect(result).toEqual({
            kind: 'failed',
            failure: { phase: 'prepare', reason: 'quote-mismatch' },
        })
        expect(context.createOrder).not.toHaveBeenCalled()
        expect(context.reportOrder).not.toHaveBeenCalled()
    })

    it('refuses unreadable bytes the same way', async () => {
        fakeNode({ balance: RICH })
        const context = contextOf(orderOf(['0xdeadbeef']))

        const result = await run(context)

        expect(result).toMatchObject({
            failure: { reason: 'quote-mismatch' },
        })
        expect(context.addSignRequest).not.toHaveBeenCalled()
    })

    it('cancels when the approval reverts, before any swap', async () => {
        const node = fakeNode({
            balance: RICH,
            statusFor: to =>
                to.toLowerCase() === TOKEN.toLowerCase() ? '0x0' : '0x1',
        })
        const context = contextOf(orderOf([APPROVE_TX, SWAP_TX]))

        const result = await run(context)

        expect(result).toMatchObject({
            failure: { phase: 'submission', reason: 'submission-failed' },
        })
        expect(node.sentCount()).toBe(1)
        await flushCancelReport()
        expect(context.reportOrder).toHaveBeenCalledWith(CANCELLED)
    })

    it('cancels when the approval is rejected', async () => {
        const node = fakeNode({ balance: RICH })
        const context = contextOf(
            orderOf([APPROVE_TX, SWAP_TX]),
            request => request.reject?.() ?? Promise.resolve(),
        )

        const result = await run(context)

        expect(result).toEqual({ kind: 'user-rejected' })
        expect(node.sentCount()).toBe(0)
        await flushCancelReport()
        expect(context.reportOrder).toHaveBeenCalledWith(CANCELLED)
    })

    it('cancels with a stale quote when the order expires during the approval', async () => {
        const node = fakeNode({ balance: RICH })
        const context = contextOf({
            ...orderOf([APPROVE_TX, SWAP_TX]),
            expiresAt: Date.now() - 1,
        })

        const result = await run(context)

        expect(result).toEqual({ kind: 'stale-quote' })
        expect(node.sentCount()).toBe(1)
        await flushCancelReport()
        expect(context.reportOrder).toHaveBeenCalledWith(CANCELLED)
    })

    it('cancels with a stale quote when the quote ages out during the approval', async () => {
        const node = fakeNode({ balance: RICH })
        const order = orderOf([APPROVE_TX, SWAP_TX])
        const context = contextOf(order)
        const quote = quoteOf()
        vi.mocked(context.createOrder).mockImplementation(async () => {
            quote.expiresAt = Date.now() - 1
            return order
        })

        const result = await run(context, inputOf({ quote }))

        expect(result).toEqual({ kind: 'stale-quote' })
        expect(node.sentCount()).toBe(1)
        await flushCancelReport()
        expect(context.reportOrder).toHaveBeenCalledWith(CANCELLED)
    })

    it('cancels when the swap is rejected after the approval landed', async () => {
        const node = fakeNode({ balance: RICH })
        const context = contextOf(
            orderOf([APPROVE_TX, SWAP_TX]),
            async request => {
                const [unsigned] = request.txs as UnsignedTransaction[]
                if (unsigned.summary?.kind === 'swap') {
                    await request.reject?.()
                    return
                }
                await signs(request)
            },
        )

        const result = await run(context)

        expect(result).toEqual({ kind: 'user-rejected' })
        expect(node.sentCount()).toBe(1)
        await flushCancelReport()
        expect(context.reportOrder).toHaveBeenCalledWith(CANCELLED)
    })

    it('cancels when the swap cannot be estimated', async () => {
        fakeNode({ balance: RICH, unestimable: ROUTER })
        const context = contextOf(orderOf([APPROVE_TX, SWAP_TX]))

        const result = await run(context)

        expect(result).toMatchObject({
            failure: { phase: 'prepare', reason: 'prepare-failed' },
        })
        await flushCancelReport()
        expect(context.reportOrder).toHaveBeenCalledWith(CANCELLED)
    })

    it('fails on a reverted swap, already reported as sent', async () => {
        fakeNode({ balance: RICH, statusFor: () => '0x0' })
        const context = contextOf(orderOf([SWAP_TX]))

        const result = await run(context)

        expect(result).toMatchObject({
            failure: { phase: 'submission', reason: 'submission-failed' },
        })
        expect(context.reportOrder).toHaveBeenCalledWith(
            expect.objectContaining({
                report: expect.objectContaining({ status: 'sent' }),
            }),
        )
    })

    it('succeeds when the receipt does not arrive in time', async () => {
        fakeNode({ balance: RICH })
        vi.mocked(waitForEvmReceipt).mockRejectedValueOnce(
            new EvmError(EvmErrorCode.TIMEOUT),
        )
        const context = contextOf(orderOf([SWAP_TX]))

        const result = await run(context)

        expect(result.kind).toBe('success')
    })

    it('is not held up by an attempt that is only awaiting finality', async () => {
        fakeNode({ balance: RICH })
        vi.mocked(getOpenSubmissionAttempts).mockResolvedValueOnce([
            attempt('confirming'),
        ])
        const context = contextOf(orderOf([SWAP_TX]))

        const result = await run(context)

        expect(result.kind).toBe('success')
    })

    it.each(['submitted', 'unknown'] as const)(
        'refuses to rebuild over a %s attempt',
        async status => {
            fakeNode({ balance: RICH })
            vi.mocked(getOpenSubmissionAttempts).mockResolvedValueOnce([
                attempt(status),
            ])
            const context = contextOf(orderOf([SWAP_TX]))

            const result = await run(context)

            expect(result).toEqual({ kind: 'verifying-previous' })
            expect(context.addSignRequest).not.toHaveBeenCalled()
        },
    )

    it('refuses to rebuild when the attempts cannot be read', async () => {
        fakeNode({ balance: RICH })
        vi.mocked(getOpenSubmissionAttempts).mockRejectedValueOnce(
            new Error('database closed'),
        )
        const context = contextOf(orderOf([SWAP_TX]))

        const result = await run(context)

        expect(result).toEqual({ kind: 'verifying-previous' })
    })

    it('stops before the order when the balance cannot pay', async () => {
        fakeNode({ balance: '0x0', callResult: allowance(0n) })
        const context = contextOf(orderOf([SWAP_TX]))

        const result = await run(
            context,
            inputOf({ account: {} as ExecuteSwapParams['account'] }),
        )

        expect(result).toMatchObject({
            failure: {
                phase: 'prepare',
                reason: 'insufficient-native-balance',
                chainId: 'ethereum',
            },
        })
        expect(context.createOrder).not.toHaveBeenCalled()
    })

    it('cancels an order when the user leaves before signing', async () => {
        fakeNode({ balance: RICH })
        const context = contextOf(orderOf([SWAP_TX]))
        let isCancelled = false
        vi.mocked(context.createOrder).mockImplementation(async () => {
            isCancelled = true
            return orderOf([SWAP_TX])
        })

        const result = await run(
            context,
            inputOf({ isCancelled: () => isCancelled }),
        )

        expect(result).toEqual({ kind: 'cancelled' })
        expect(context.addSignRequest).not.toHaveBeenCalled()
        await flushCancelReport()
        expect(context.reportOrder).toHaveBeenCalledWith(CANCELLED)
    })

    it('refuses a stale quote before doing anything', async () => {
        const context = contextOf(orderOf([SWAP_TX]))

        const result = await run(
            context,
            inputOf({
                quote: { ...quoteOf(), fetchedAt: undefined },
            }),
        )

        expect(result).toEqual({ kind: 'stale-quote' })
        expect(context.createOrder).not.toHaveBeenCalled()
    })

    it('flags the broadcast before it sends', async () => {
        fakeNode({ balance: RICH })
        const context = contextOf(orderOf([SWAP_TX]))

        await run(context)

        expect(context.onOrderSubmitting).toHaveBeenCalledWith('order-1')
        expect(context.onOrderRejected).not.toHaveBeenCalled()
    })
})
