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
import { Decimal } from 'decimal.js'
import type {
    ChainScope,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type {
    AssetOptInTxsParams,
    AssetOptOutTxsParams,
    ExpressTransferTxsParams,
    InboxClaimTxsParams,
    AssetInboxQuote,
    InboxRejectTxsParams,
    InboxSendTxsParams,
    DelegationTxParams,
    SendFlowChainAdapter,
    TransferTxsParams,
} from '../chain-adapter'
import { toAssetInboxQuote } from '../chain-adapter'

export interface SendFlowContractFixtures {
    /** Required when the adapter has an asset inbox. */
    inboxSend?: InboxSendTxsParams
    /** A quote the inbox accepts, for `inboxSend`'s build. */
    inboxSendQuote?: AssetInboxQuote
    inboxClaim?: InboxClaimTxsParams
    inboxReject?: InboxRejectTxsParams
    transfer?: TransferTxsParams
    express?: ExpressTransferTxsParams
    optIn?: AssetOptInTxsParams
    optOut?: AssetOptOutTxsParams
    delegation?: DelegationTxParams
}

type Build = (adapter: SendFlowChainAdapter) => Promise<UnsignedTransaction[]>

const one = async (
    built: Promise<UnsignedTransaction>,
): Promise<UnsignedTransaction[]> => [await built]

/** Every chain package runs this against its own send-flow adapter. */
export const sendFlowContractTests = (
    makeAdapter: () => SendFlowChainAdapter,
    fixtures: SendFlowContractFixtures,
): void => {
    const adapter = makeAdapter()

    // Each builder hands back chain-neutral transactions for the scope it
    // was asked about, whose fee the adapter itself can read.
    const builders: [string, ChainScope | undefined, Build | undefined][] = [
        [
            'a transfer',
            fixtures.transfer?.scope,
            fixtures.transfer && (a => a.buildTransferTxs(fixtures.transfer!)),
        ],
        [
            'an express transfer',
            fixtures.express?.scope,
            fixtures.express &&
                adapter.express &&
                (a => a.express!.buildTxs(fixtures.express!)),
        ],
        [
            'an asset opt-in',
            fixtures.optIn?.scope,
            fixtures.optIn &&
                adapter.assetHolding &&
                (a => a.assetHolding!.buildOptInTxs(fixtures.optIn!)),
        ],
        [
            'an asset opt-out',
            fixtures.optOut?.scope,
            fixtures.optOut &&
                adapter.assetHolding &&
                (a => a.assetHolding!.buildOptOutTxs(fixtures.optOut!)),
        ],
        [
            'a delegation',
            fixtures.delegation?.scope,
            fixtures.delegation &&
                adapter.delegation &&
                (a => one(a.delegation!.buildTx(fixtures.delegation!))),
        ],
        [
            'an inbox send',
            fixtures.inboxSend?.scope,
            fixtures.inboxSend &&
                fixtures.inboxSendQuote &&
                adapter.assetInbox &&
                (a =>
                    a.assetInbox!.buildSendTxs({
                        ...fixtures.inboxSend!,
                        quote: fixtures.inboxSendQuote!,
                    })),
        ],
        [
            'an inbox claim',
            fixtures.inboxClaim?.scope,
            fixtures.inboxClaim &&
                adapter.assetInbox &&
                (a => a.assetInbox!.buildClaimTxs(fixtures.inboxClaim!)),
        ],
        [
            'an inbox reject',
            fixtures.inboxReject?.scope,
            fixtures.inboxReject &&
                adapter.assetInbox &&
                (a => a.assetInbox!.buildRejectTxs(fixtures.inboxReject!)),
        ],
    ]

    describe(`SendFlowChainAdapter contract: ${adapter.chainId}`, () => {
        it('serves a chain', () => {
            expect(adapter.chainId).toMatch(/\S/)
        })

        it('builds transfers', () => {
            expect(adapter.buildTransferTxs).toBeTypeOf('function')
        })

        for (const [name, scope, build] of builders) {
            if (!build) continue
            it(`builds ${name} as chain-neutral transactions on the asked scope`, async () => {
                const adapter = makeAdapter()

                const built = await build(adapter)

                expect(built.length).toBeGreaterThan(0)
                for (const transaction of built) {
                    expect(transaction).toEqual(
                        expect.objectContaining({
                            scope,
                            payload: expect.anything(),
                            summary: expect.objectContaining({
                                kind: expect.any(String),
                            }),
                            chainData: expect.objectContaining({
                                family: expect.any(String),
                            }),
                        }),
                    )
                    expect(
                        Decimal.isDecimal(adapter.transactionFee(transaction)),
                    ).toBe(true)
                }
            })
        }

        if (!adapter.assetInbox) return

        it('ships inbox fixtures', () => {
            expect(fixtures.inboxSend).toBeDefined()
        })

        const send = fixtures.inboxSend
        if (!send) return

        // The quote crosses the send flow opaquely and decides a headlessly
        // signed payment, so a malformed one must never reach the builder.
        it('rejects a malformed inbox quote before building', async () => {
            await expect(
                makeAdapter().assetInbox!.buildSendTxs({
                    ...send,
                    quote: toAssetInboxQuote({ unexpected: true }),
                }),
            ).rejects.toBeDefined()
        })
    })
}
