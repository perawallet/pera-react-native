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

import { describe, expect, it, vi } from 'vitest'
import type { SwapChainAdapter } from '../chain-adapter'
import type { ExecuteSwapParams, SwapExecutionContext } from '../execution'
import type { SwapOrder } from '../models'

export interface SwapContractFixtures {
    /**
     * A fresh, executable request with no `account`, so nothing is read
     * from the chain before the order is created.
     */
    params: ExecuteSwapParams
    /** `createOrder` and `reportOrder` are mocks the suite programs. */
    makeContext(): SwapExecutionContext
}

/** Every chain package runs this against its own swap adapter. */
export const swapContractTests = (
    makeAdapter: () => SwapChainAdapter,
    fixtures: SwapContractFixtures,
): void => {
    const run = async (
        quote: Partial<ExecuteSwapParams['quote']>,
        order?: SwapOrder,
    ) => {
        const context = fixtures.makeContext()
        if (order) vi.mocked(context.createOrder).mockResolvedValue(order)
        vi.mocked(context.reportOrder).mockResolvedValue(undefined)
        const result = await makeAdapter().executeSwap(
            {
                ...fixtures.params,
                quote: { ...fixtures.params.quote, ...quote },
            },
            context,
        )
        return { result, context }
    }

    describe(`SwapChainAdapter contract: ${makeAdapter().chainId}`, () => {
        it('names its native asset', () => {
            expect(makeAdapter().nativeAssetId).toMatch(/\S/)
        })

        it('names a default receive asset other than the native one', () => {
            const adapter = makeAdapter()
            expect(adapter.defaultReceiveAssetId).toMatch(/\S/)
            expect(adapter.defaultReceiveAssetId).not.toBe(
                adapter.nativeAssetId,
            )
        })

        it('reads back the router asset ids it writes', () => {
            const adapter = makeAdapter()
            const { scope } = fixtures.makeContext()
            for (const assetId of [
                adapter.nativeAssetId,
                adapter.defaultReceiveAssetId,
            ]) {
                expect(
                    adapter.fromRouterAssetId(
                        adapter.toRouterAssetId(assetId, scope),
                        scope,
                    ),
                ).toBe(assetId)
            }
        })

        it('holds back a non-negative native fee reserve', () => {
            expect(makeAdapter().maxAmountFeeReserve.isNegative()).toBe(false)
        })

        it('reports a non-negative holding reserve', () => {
            const { scope } = fixtures.makeContext()

            expect(makeAdapter().holdingReserve(scope).isNegative()).toBe(false)
        })

        it('returns a stale quote without ordering or signing', async () => {
            const { result, context } = await run({ fetchedAt: undefined })

            expect(result).toEqual({ kind: 'stale-quote' })
            expect(context.createOrder).not.toHaveBeenCalled()
            expect(context.addSignRequest).not.toHaveBeenCalled()
        })

        it('refuses an order with a step it cannot run, cancelling it unsigned', async () => {
            const { result, context } = await run(
                {},
                {
                    orderId: 'order-1',
                    status: 'pending',
                    expiresAt: null,
                    steps: [
                        {
                            kind: 'unsupported',
                            routerKind: 'deposit_instructions',
                        },
                    ],
                },
            )

            expect(result).toEqual({
                kind: 'failed',
                failure: { phase: 'prepare', reason: 'unsupported-steps' },
            })
            expect(context.addSignRequest).not.toHaveBeenCalled()
            expect(context.reportOrder).toHaveBeenCalledWith({
                orderId: 'order-1',
                report: { status: 'cancelled' },
            })
        })
    })
}
