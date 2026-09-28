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


import { describe, expect, it } from 'vitest'
import type { SwapChainAdapter } from '../chain-adapter'
import type {
    ExecuteSwapParams,
    SwapExecutionContext,
} from '../execution'

export interface SwapContractFixtures {
    /**
     * A fresh, executable request with no `account`, so nothing is read
     * from the chain before the quote checks.
     */
    params: ExecuteSwapParams
    makeContext(): SwapExecutionContext
}

/** Every chain package runs this against its own swap adapter. */
export const swapContractTests = (
    makeAdapter: () => SwapChainAdapter,
    fixtures: SwapContractFixtures,
): void => {
    const run = async (quote: Partial<ExecuteSwapParams['quote']>) => {
        const context = fixtures.makeContext()
        const result = await makeAdapter().executeSwap(
            { ...fixtures.params, quote: { ...fixtures.params.quote, ...quote } },
            context,
        )
        return { result, context }
    }

    describe(`SwapChainAdapter contract: ${makeAdapter().chainId}`, () => {
        it('names its native asset', () => {
            expect(makeAdapter().nativeAssetId).toMatch(/\S/)
        })

        it('fails a quote without an id as a result, signing nothing', async () => {
            const { result, context } = await run({ quoteIdStr: '' })

            expect(result).toEqual({
                kind: 'failed',
                failure: { phase: 'prepare', reason: 'missing-quote-id' },
            })
            expect(context.addSignRequest).not.toHaveBeenCalled()
        })

        it('returns a stale quote without preparing or signing', async () => {
            const { result, context } = await run({ fetchedAt: undefined })

            expect(result).toEqual({ kind: 'stale-quote' })
            expect(context.prepareTransactions).not.toHaveBeenCalled()
            expect(context.addSignRequest).not.toHaveBeenCalled()
        })
    })
}
