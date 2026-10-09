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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { BroadcasterChainAdapter } from '../broadcaster'
import type { SubmissionErrorClassification } from '../pipeline/errors'

export interface BroadcasterContractFixtures {
    /** On the adapter's chain. */
    scope: ChainScope
    /** A one-transaction group, wire-encoded. */
    signedTransactions: readonly Uint8Array[]
    /** The chain's ids for `signedTransactions`. */
    txIds: readonly string[]
    /** The node accepts the next submit. */
    arrangeAccepted(): void
    /** The node answers that it already holds the group. */
    arrangeAlreadyKnown(): void
    /** The node answers with a definitive refusal. */
    arrangeRejected(): void
    /** The submit gets no answer. */
    arrangeUnreachable(): void
    /** The chain reports `txIds` confirmed. */
    arrangeConfirmed(): void
    /** The chain keeps reporting `txIds` unconfirmed past its wait window. */
    arrangeNeverConfirmed(): void
}

/** Every chain package runs this against its own broadcaster adapter. */
export const broadcasterContractTests = (
    makeAdapter: () => BroadcasterChainAdapter,
    fixtures: BroadcasterContractFixtures,
): void => {
    const { scope } = fixtures
    const submit = () =>
        makeAdapter().submit(scope, fixtures.signedTransactions)

    // Matched by shape, not class: a chain package may load the error from
    // signing's build while this suite loads it from source.
    const submissionFailure = (
        classification: SubmissionErrorClassification,
    ) => ({ classification, txIds: [...fixtures.txIds] })

    describe(`BroadcasterChainAdapter contract: ${makeAdapter().chainId}`, () => {
        it("broadcasts to its own chain's nodes", () => {
            expect(makeAdapter().chainId).toBe(scope.chainId)
        })

        it('resolves with the ids once the node accepts the group', async () => {
            fixtures.arrangeAccepted()

            await expect(submit()).resolves.toEqual(fixtures.txIds)
        })

        it('treats a group the node already holds as accepted', async () => {
            fixtures.arrangeAlreadyKnown()

            await expect(submit()).resolves.toEqual(fixtures.txIds)
        })

        it("reports the node's refusal as rejected, with the ids", async () => {
            fixtures.arrangeRejected()

            await expect(submit()).rejects.toMatchObject(
                submissionFailure('rejected-by-node'),
            )
        })

        it('reports a submit with no answer as an unknown outcome, with the ids', async () => {
            fixtures.arrangeUnreachable()

            await expect(submit()).rejects.toMatchObject(
                submissionFailure('unknown-outcome'),
            )
        })

        it('resolves the wait once the chain confirms the group', async () => {
            fixtures.arrangeConfirmed()

            await expect(
                makeAdapter().waitForConfirmation(scope, fixtures.txIds),
            ).resolves.toBeUndefined()
        })

        it('rejects the wait when the chain never confirms the group', async () => {
            fixtures.arrangeNeverConfirmed()

            await expect(
                makeAdapter().waitForConfirmation(scope, fixtures.txIds),
            ).rejects.toThrow()
        })

        it('resolves the wait at once when there is nothing to wait for', async () => {
            await expect(
                makeAdapter().waitForConfirmation(scope, []),
            ).resolves.toBeUndefined()
        })
    })
}
