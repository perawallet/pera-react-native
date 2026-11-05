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

import { vi } from 'vitest'
import { fakeSwapAdapter } from './fakeSwapAdapter'
import { signableStepsOn, type ExecuteSwapParams } from '../execution'
import { isQuoteFresh } from '../utils/quoteFreshness'
import { swapContractTests } from './adapter-contract'

const adapter = fakeSwapAdapter({
    executeSwap: async ({ quote }, context) => {
        if (!isQuoteFresh(quote)) return { kind: 'stale-quote' }
        const order = await context.createOrder(quote.quoteId)
        if (!signableStepsOn(order, context.scope.chainId)) {
            await context.reportOrder({
                orderId: order.orderId,
                report: { status: 'cancelled' },
            })
            return {
                kind: 'failed',
                failure: { phase: 'prepare', reason: 'unsupported-steps' },
            }
        }
        return { kind: 'success', orderId: order.orderId, txIds: [] }
    },
})

swapContractTests(() => adapter, {
    params: {
        quote: { quoteId: 'quote-1', fetchedAt: Date.now(), expiresAt: null },
    } as unknown as ExecuteSwapParams,
    makeContext: () => ({
        scope: { chainId: 'algorand', networkId: 'mainnet' } as const,
        deviceId: null,
        addSignRequest: vi.fn(),
        createOrder: vi.fn(),
        reportOrder: vi.fn(),
        registerHandoff: vi.fn(),
        onOrderSubmitting: vi.fn(),
        onOrderRejected: vi.fn(),
    }),
})
