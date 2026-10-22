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
import type { TransactionPlanner } from '../contracts/transaction-planner'
import type {
    Signature,
    SigningRequest,
    UnsignedTransaction,
} from '../models/domain'
import type { ChainId } from '../models/identity'

export interface TransactionPlannerContractFixtures {
    /** A transaction the chain plans and assembles. */
    transaction: UnsignedTransaction
    /** A transaction that differs from `transaction` in what it does. */
    otherTransaction: UnsignedTransaction
    /** `transaction` with a payload the chain can't read. */
    malformedTransaction: UnsignedTransaction
    /** Signs one planned request as the signer's key would. */
    sign: (request: SigningRequest) => Promise<Uint8Array>
    /** An address that signs nothing in `transaction`. */
    stranger: string
}

/** Every chain package runs this against its own planner. */
export const transactionPlannerContractTests = (
    makePlanner: () => TransactionPlanner,
    fixtures: TransactionPlannerContractFixtures,
): void => {
    const { transaction } = fixtures

    // Whether the planner answers now or later, a refusal is a rejection.
    const assemble = async (
        planner: TransactionPlanner,
        signatures: Signature[],
    ) => planner.assemble(transaction, signatures)

    const signAll = (requests: SigningRequest[]): Promise<Signature[]> =>
        Promise.all(
            requests.map(async request => ({
                requestIndex: request.requestIndex,
                signer: request.signer,
                scheme: request.scheme,
                bytes: await fixtures.sign(request),
            })),
        )

    describe(`transaction planner contract: ${makePlanner().chainId}`, () => {
        it('plans each signature once, numbered from 0', () => {
            const requests = makePlanner().plan(transaction)

            expect(requests.map(r => r.requestIndex)).toEqual(
                requests.map((_, i) => i),
            )
            expect(requests.length).toBeGreaterThan(0)
            expect(requests.filter(r => r.payload.length === 0)).toEqual([])
        })

        it('gives every request the bytes a device signs, as its own copy', () => {
            const requests = makePlanner().plan(transaction)

            for (const request of requests) {
                expect(request.devicePayload?.length).toBeGreaterThan(0)
                expect(request.devicePayload?.buffer).not.toBe(
                    request.payload.buffer,
                )
            }
        })

        it('plans different bytes for a different transaction', () => {
            const planner = makePlanner()
            const payloads = (tx: UnsignedTransaction) =>
                planner.plan(tx).map(r => r.payload)

            expect(payloads(fixtures.otherTransaction)).not.toEqual(
                payloads(transaction),
            )
        })

        it('plans the same requests for the same transaction', () => {
            const planner = makePlanner()

            expect(planner.plan(transaction)).toEqual(planner.plan(transaction))
        })

        it("refuses another chain's transaction", () => {
            const planner = makePlanner()
            const otherChain: ChainId =
                planner.chainId === 'algorand' ? 'ethereum' : 'algorand'

            expect(() =>
                planner.plan({
                    ...transaction,
                    scope: { ...transaction.scope, chainId: otherChain },
                }),
            ).toThrow()
        })

        it("refuses a payload it can't read", () => {
            expect(() =>
                makePlanner().plan(fixtures.malformedTransaction),
            ).toThrow()
        })

        it('assembles the planned signatures into a transaction of the same scope', async () => {
            const planner = makePlanner()
            const signatures = await signAll(planner.plan(transaction))

            const signed = await assemble(planner, signatures)

            expect(signed.scope).toEqual(transaction.scope)
            expect(signed.id).not.toBe('')
            expect(signed.bytes.length).toBeGreaterThan(0)
        })

        it('refuses to assemble without signatures', async () => {
            await expect(assemble(makePlanner(), [])).rejects.toThrow()
        })

        it('refuses a signature in another scheme than planned', async () => {
            const planner = makePlanner()
            const [first, ...rest] = await signAll(planner.plan(transaction))
            const otherScheme =
                first.scheme === 'secp256k1' ? 'ed25519' : 'secp256k1'

            await expect(
                assemble(planner, [{ ...first, scheme: otherScheme }, ...rest]),
            ).rejects.toThrow()
        })

        it('refuses a signature from anyone but its planned signer', async () => {
            const planner = makePlanner()
            const [first, ...rest] = await signAll(planner.plan(transaction))

            await expect(
                assemble(planner, [
                    { ...first, signer: fixtures.stranger },
                    ...rest,
                ]),
            ).rejects.toThrow()
        })
    })
}
