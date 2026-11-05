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
import { encodeFunctionResult, erc20Abi, numberToHex } from 'viem'
import type { Hex } from 'viem'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { createEvmClient } from '../../blockchain/utils/createEvmClient'
import {
    fakeNode,
    ROUTER,
    SENDER,
    server,
    TOKEN,
} from '../../connect/callBatch/__tests__/harness'
import { testChainContext } from '../../__tests__/context'
import { ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import {
    estimateEvmSwapSourceCost,
    evmShortfallOf,
    SWAP_APPROVAL_GAS_CEILING,
    SWAP_CALL_GAS_CEILING,
} from '../source-cost'

const AMOUNT = 1_000_000n
const scope = evmScopeOf(ETHEREUM)
const ctx = testChainContext()

const quoteOf = (assetId: string): SwapQuote =>
    ({
        request: {
            sourceAsset: { ...scope, assetId },
            sourceAmount: new Decimal(AMOUNT.toString()),
            sourceAddress: SENDER,
        },
    }) as unknown as SwapQuote

const allowanceOf = (amount: bigint): Hex =>
    encodeFunctionResult({
        abi: erc20Abi,
        functionName: 'allowance',
        result: amount,
    })

const estimate = (assetId: string, routeContracts = [ROUTER]) =>
    estimateEvmSwapSourceCost({
        client: createEvmClient(scope, ctx, ETHEREUM),
        chain: ETHEREUM,
        quote: quoteOf(assetId),
        scope,
        routeContracts,
    })

const RICH = numberToHex(10n ** 21n)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('estimateEvmSwapSourceCost', () => {
    it('prices only the swap for the native asset', async () => {
        fakeNode({ balance: RICH, callResult: allowanceOf(0n) })
        const withApproval = await estimate(TOKEN)
        server.resetHandlers()
        fakeNode({ balance: RICH })

        const cost = await estimate(ETHEREUM.nativeAsset.assetId)

        expect(cost).toMatchObject({
            needsSpendApproval: false,
            shortfall: null,
            nativeSymbol: 'ETH',
            nativeDecimals: 18,
        })
        const gasRatio = new Decimal(
            (SWAP_CALL_GAS_CEILING + SWAP_APPROVAL_GAS_CEILING).toString(),
        ).div(SWAP_CALL_GAS_CEILING.toString())
        expect(withApproval.networkFee.div(cost.networkFee).toString()).toBe(
            gasRatio.toString(),
        )
    })

    it('adds the spend approval while the allowance is short', async () => {
        fakeNode({ balance: RICH, callResult: allowanceOf(AMOUNT - 1n) })

        const cost = await estimate(TOKEN)

        expect(cost.needsSpendApproval).toBe(true)
    })

    it('leaves the spend approval out when the allowance covers the amount', async () => {
        fakeNode({ balance: RICH, callResult: allowanceOf(AMOUNT) })

        const cost = await estimate(TOKEN)

        expect(cost.needsSpendApproval).toBe(false)
    })

    it('assumes a spend approval while the route names no contract', async () => {
        fakeNode({ balance: RICH })

        const cost = await estimate(TOKEN, [])

        expect(cost.needsSpendApproval).toBe(true)
    })

    it('counts only the fee against the balance for a token source', async () => {
        fakeNode({ balance: '0x1', callResult: allowanceOf(AMOUNT) })

        const cost = await estimate(TOKEN)

        expect(cost.shortfall?.toString()).toBe(
            cost.networkFee.minus(1).toString(),
        )
    })

    it('counts the swap amount as well for a native source', async () => {
        fakeNode({ balance: '0x1' })

        const cost = await estimate(ETHEREUM.nativeAsset.assetId)

        expect(cost.shortfall?.toString()).toBe(
            cost.networkFee.plus(AMOUNT.toString()).minus(1).toString(),
        )
    })
})

describe('evmShortfallOf', () => {
    it('is null at exactly the required balance', () => {
        expect(evmShortfallOf(5n, 5n)).toBeNull()
    })

    it('is the difference below it', () => {
        expect(evmShortfallOf(4n, 5n)?.toString()).toBe('1')
    })
})
