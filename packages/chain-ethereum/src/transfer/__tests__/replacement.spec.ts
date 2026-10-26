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
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { Decimal } from 'decimal.js'
import { setupServer } from 'msw/node'
import {
    parseGwei,
    serializeTransaction,
    toHex,
    type RpcFeeHistory,
} from 'viem'
import type {
    BuildContext,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { InvalidSendParamsError } from '@perawallet/wallet-core-transactions'
import { evmRpcHandlers } from '../../blockchain/msw-handlers'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import { BASE, ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import {
    SENDER,
    TRANSFER,
    VIEM_TRANSFER_NONCE_0,
} from '../../signing/__tests__/fixtures'
import {
    buildEvmReplacement,
    bumpReplacementFee,
    CANCEL_GAS,
    meetsReplacementBump,
    replacementFees,
} from '../replacement'

const context: BuildContext = { scope: evmScopeOf(ETHEREUM) }
const ctx = testChainContext()

const SUMMARY: TransactionSummary = {
    kind: 'transfer',
    title: { key: 'transactions.list_item.send' },
    direction: 'out',
    icon: 'send',
    counterparty: TRANSFER.to!,
}

const feeHistory = (
    baseFee: bigint,
    tips: [bigint, bigint, bigint],
): RpcFeeHistory => ({
    oldestBlock: '0x1',
    baseFeePerGas: [toHex(baseFee), toHex(baseFee)],
    gasUsedRatio: [0.5],
    reward: [tips.map(tip => toHex(tip))],
})

// The original pays 20 gwei max and a 1 gwei tip, so a bump needs 22 and 1.1.
const CHEAP_MARKET = feeHistory(parseGwei('1'), [
    parseGwei('0.1'),
    parseGwei('0.2'),
    parseGwei('0.5'),
])
// Fast is 2 x 15 + 3 = 33 gwei max with a 3 gwei tip.
const BUSY_MARKET = feeHistory(parseGwei('15'), [
    parseGwei('1'),
    parseGwei('2'),
    parseGwei('3'),
])

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const nonceReads = vi.fn(() => '0x9' as const)

const useRpc = (market: RpcFeeHistory) =>
    server.use(
        ...evmRpcHandlers({
            rpcUrl: TEST_RPC_URL,
            responses: {
                eth_feeHistory: market,
                eth_getTransactionCount: nonceReads,
            },
        }),
    )

describe('Ethereum transaction replacement', () => {
    afterEach(() => {
        nonceReads.mockClear()
    })

    describe('fees', () => {
        it('bumps by 10%, rounding up', () => {
            expect(bumpReplacementFee(10n)).toBe(11n)
            expect(bumpReplacementFee(15n)).toBe(17n)
            expect(bumpReplacementFee(0n)).toBe(0n)
        })

        it('takes the higher of the fast preset and the bump, per field', () => {
            expect(
                replacementFees(
                    { maxFeePerGas: 100n, maxPriorityFeePerGas: 10n },
                    { maxFeePerGas: 105n, maxPriorityFeePerGas: 20n },
                ),
            ).toEqual({ maxFeePerGas: 110n, maxPriorityFeePerGas: 20n })
        })

        it('accepts a bump of exactly 10% on both fields and nothing less', () => {
            const original = { maxFeePerGas: 100n, maxPriorityFeePerGas: 10n }

            expect(
                meetsReplacementBump(original, {
                    maxFeePerGas: 110n,
                    maxPriorityFeePerGas: 11n,
                }),
            ).toBe(true)
            expect(
                meetsReplacementBump(original, {
                    maxFeePerGas: 109n,
                    maxPriorityFeePerGas: 11n,
                }),
            ).toBe(false)
            expect(
                meetsReplacementBump(original, {
                    maxFeePerGas: 200n,
                    maxPriorityFeePerGas: 10n,
                }),
            ).toBe(false)
        })
    })

    it('speeds up the same call at the bumped fees when the market is cheaper', async () => {
        useRpc(CHEAP_MARKET)

        const [built] = await buildEvmReplacement(
            ctx,
            ETHEREUM,
            {
                kind: 'speed-up',
                rawTransaction: VIEM_TRANSFER_NONCE_0,
                summary: SUMMARY,
            },
            context,
        )

        expect(built).toEqual({
            scope: context.scope,
            payload: {
                from: SENDER,
                transaction: {
                    type: 'eip1559',
                    chainId: 1,
                    nonce: 0,
                    to: TRANSFER.to,
                    value: 10n ** 18n,
                    data: undefined,
                    gas: 21_000n,
                    accessList: undefined,
                    maxFeePerGas: parseGwei('22'),
                    maxPriorityFeePerGas: parseGwei('1.1'),
                },
            },
            summary: SUMMARY,
            chainData: { family: 'evm' },
        })
        expect(nonceReads).not.toHaveBeenCalled()
    })

    it('speeds up at the fast preset when the market has moved past the bump', async () => {
        useRpc(BUSY_MARKET)

        const [built] = await buildEvmReplacement(
            ctx,
            ETHEREUM,
            { kind: 'speed-up', rawTransaction: VIEM_TRANSFER_NONCE_0 },
            context,
        )

        expect(built.payload).toMatchObject({
            transaction: {
                nonce: 0,
                maxFeePerGas: parseGwei('33'),
                maxPriorityFeePerGas: parseGwei('3'),
            },
        })
    })

    it('summarises a speed-up from the call when the ledger kept no summary', async () => {
        useRpc(CHEAP_MARKET)

        const [built] = await buildEvmReplacement(
            ctx,
            ETHEREUM,
            { kind: 'speed-up', rawTransaction: VIEM_TRANSFER_NONCE_0 },
            context,
        )

        expect(built.summary).toMatchObject({
            kind: 'transfer',
            direction: 'out',
            amount: { value: new Decimal('1000000000000000000') },
        })
    })

    it('cancels with an empty transfer to the sender at the same nonce', async () => {
        useRpc(CHEAP_MARKET)

        const [built] = await buildEvmReplacement(
            ctx,
            ETHEREUM,
            {
                kind: 'cancel',
                rawTransaction: VIEM_TRANSFER_NONCE_0,
                summary: SUMMARY,
            },
            context,
        )

        expect(built.payload).toEqual({
            from: SENDER,
            transaction: {
                type: 'eip1559',
                chainId: 1,
                nonce: 0,
                to: SENDER,
                value: 0n,
                gas: CANCEL_GAS,
                maxFeePerGas: parseGwei('22'),
                maxPriorityFeePerGas: parseGwei('1.1'),
            },
        })
        expect(built.summary).toMatchObject({
            title: { key: 'transactions.list_item.cancel_transaction' },
            direction: 'self',
            counterparty: SENDER,
            amount: { value: new Decimal(0) },
        })
        expect(nonceReads).not.toHaveBeenCalled()
    })

    it('refuses a transaction signed for another chain', async () => {
        useRpc(CHEAP_MARKET)

        await expect(
            buildEvmReplacement(
                ctx,
                BASE,
                { kind: 'cancel', rawTransaction: VIEM_TRANSFER_NONCE_0 },
                { scope: evmScopeOf(BASE) },
            ),
        ).rejects.toBeInstanceOf(InvalidSendParamsError)
    })

    it('refuses a transaction that is not EIP-1559', async () => {
        const legacy = serializeTransaction({
            type: 'legacy',
            chainId: 1,
            nonce: 0,
            to: TRANSFER.to,
            value: 1n,
            gas: 21_000n,
            gasPrice: parseGwei('20'),
        })

        await expect(
            buildEvmReplacement(
                ctx,
                ETHEREUM,
                { kind: 'speed-up', rawTransaction: legacy },
                context,
            ),
        ).rejects.toBeInstanceOf(InvalidSendParamsError)
    })
})
