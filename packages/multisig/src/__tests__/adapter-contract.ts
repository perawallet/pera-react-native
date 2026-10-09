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
import type { MultisigChainAdapter, MultisigParameters } from '../chain-adapter'
import type { MultisigSignRequest } from '../models'

export interface MultisigContractFixtures {
    /** At least three participants and a threshold of two. */
    parameters: MultisigParameters
    /** An unsigned transaction sent by the address `parameters` derives. */
    rawTransactionBase64: string
    /** Rejected by the chain's address format. */
    malformedAddress: string
}

const signRequestFor = (
    address: string,
    parameters: MultisigParameters,
    rawTransactions: string[],
): MultisigSignRequest => ({
    id: 'sr-contract',
    status: 'pending',
    type: 'async',
    createdAt: new Date(0),
    expectedExpireDatetime: new Date(0),
    failReasonDisplay: null,
    proposerAddress: null,
    multisigAccount: {
        customId: 'm-contract',
        createdAt: new Date(0),
        address,
        version: parameters.version,
        threshold: parameters.threshold,
        participantAddresses: parameters.addresses,
    },
    transactionLists: [
        {
            id: 'tl-contract',
            rawTransactions,
            firstValidBlock: 0,
            lastValidBlock: 0,
            expectedExpireDatetime: new Date(0),
            responses: [],
        },
    ],
})

/** Every chain package runs this against its own multisig adapter. */
export const multisigContractTests = (
    makeAdapter: () => MultisigChainAdapter,
    fixtures: MultisigContractFixtures,
): void => {
    const { parameters, rawTransactionBase64, malformedAddress } = fixtures

    describe(`MultisigChainAdapter contract: ${makeAdapter().chainId}`, () => {
        it('derives the same address for the same parameters', () => {
            const adapter = makeAdapter()

            expect(adapter.deriveAddress(parameters)).toBe(
                adapter.deriveAddress({
                    ...parameters,
                    addresses: [...parameters.addresses],
                }),
            )
        })

        it('commits the threshold and participant order to the address', () => {
            const adapter = makeAdapter()
            const address = adapter.deriveAddress(parameters)

            expect(
                adapter.deriveAddress({ ...parameters, threshold: 1 }),
            ).not.toBe(address)
            expect(
                adapter.deriveAddress({
                    ...parameters,
                    addresses: [...parameters.addresses].reverse(),
                }),
            ).not.toBe(address)
        })

        it('throws on a malformed participant address', () => {
            expect(() =>
                makeAdapter().deriveAddress({
                    ...parameters,
                    addresses: [malformedAddress, ...parameters.addresses],
                }),
            ).toThrow()
        })

        it('assembles nothing from an empty list', async () => {
            const result = await makeAdapter().assembleSignedTransactions({
                rawTransactionsBase64: [],
                participantAddresses: parameters.addresses,
                version: parameters.version,
                threshold: parameters.threshold,
                responses: [],
            })

            expect(result).toEqual({
                kind: 'success',
                signedTransactionsBytes: [],
            })
        })

        it('reports missing signatures as retryable, not as an error', async () => {
            const result = await makeAdapter().assembleSignedTransactions({
                rawTransactionsBase64: [rawTransactionBase64],
                participantAddresses: parameters.addresses,
                version: parameters.version,
                threshold: parameters.threshold,
                responses: [],
            })

            expect(result).toEqual({
                kind: 'insufficient-signatures',
                txIndex: 0,
                validCount: 0,
                threshold: parameters.threshold,
            })
        })

        it('accepts a request whose joint account sends every transaction', () => {
            const adapter = makeAdapter()
            const address = adapter.deriveAddress(parameters)

            expect(
                adapter.validateSignRequest(
                    signRequestFor(address, parameters, [rawTransactionBase64]),
                    new Set([address]),
                ),
            ).toEqual({ kind: 'valid' })
        })

        it('rejects a sender outside the authorized set', () => {
            const adapter = makeAdapter()
            const address = adapter.deriveAddress(parameters)

            expect(
                adapter.validateSignRequest(
                    signRequestFor(address, parameters, [rawTransactionBase64]),
                    new Set(),
                ),
            ).toEqual({ kind: 'unauthorized-sender', txIndex: 0 })
        })

        it("rejects a joint address its participants don't derive", () => {
            const [participant] = parameters.addresses

            expect(
                makeAdapter().validateSignRequest(
                    signRequestFor(participant, parameters, [
                        rawTransactionBase64,
                    ]),
                    new Set([participant]),
                ),
            ).toEqual({ kind: 'address-mismatch' })
        })
    })
}
