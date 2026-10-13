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
import type { InboxSendTxsParams, SendFlowChainAdapter } from '../chain-adapter'

export interface SendFlowContractFixtures {
    /** Required when the adapter has an asset inbox. */
    inboxSend?: InboxSendTxsParams
}

/** Every chain package runs this against its own send-flow adapter. */
export const sendFlowContractTests = (
    makeAdapter: () => SendFlowChainAdapter,
    fixtures: SendFlowContractFixtures,
): void => {
    const adapter = makeAdapter()

    describe(`SendFlowChainAdapter contract: ${adapter.chainId}`, () => {
        it('serves a chain', () => {
            expect(adapter.chainId).toMatch(/\S/)
        })

        it('builds transfers', () => {
            expect(adapter.buildTransferTxs).toBeTypeOf('function')
        })

        if (!adapter.assetInbox) return

        it('ships inbox fixtures', () => {
            expect(fixtures.inboxSend).toBeDefined()
        })

        const send = fixtures.inboxSend
        if (!send) return

        // The summary crosses the send flow opaquely and decides a headlessly
        // signed payment, so a malformed one must never reach the builder.
        it('rejects a malformed inbox quote before building', async () => {
            await expect(
                makeAdapter().assetInbox!.buildSendTxs({
                    ...send,
                    summary: { unexpected: true },
                }),
            ).rejects.toBeDefined()
        })
    })
}
