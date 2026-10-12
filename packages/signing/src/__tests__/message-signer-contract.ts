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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    ChainScope,
    MessageRequest,
    Signature,
    SigningRequest,
} from '@perawallet/wallet-core-chain-contract'
import type {
    MessagePlanContext,
    MessageSignerChainAdapter,
} from '../message-signer'

export interface MessageSignerContractFixtures {
    /** On the adapter's chain. */
    scope: ChainScope
    /** The account every request below names, signed with its own key. */
    account: WalletAccount
    /** Every wallet account. */
    accounts: WalletAccount[]
    /** One valid request per supported method, each naming `account`. */
    requests: MessageRequest[]
    /** A supported method with a payload the chain must refuse. */
    malformedRequest: MessageRequest
    /** A method the chain does not sign. */
    unsupportedMethod: string
    /** A valid address on the chain that isn't `account`. */
    otherSigner: string
    /** A valid signature over `request.payload`, as the key store would return it. */
    sign(request: SigningRequest): Uint8Array
}

/** Every chain package runs this against its own message signer adapter. */
export const messageSignerContractTests = (
    makeAdapter: () => MessageSignerChainAdapter,
    fixtures: MessageSignerContractFixtures,
): void => {
    const { account, accounts, requests, otherSigner } = fixtures
    const context: MessagePlanContext = { account, accounts }
    const plan = (request: MessageRequest) =>
        makeAdapter().plan(request, context)
    const signaturesFor = (request: MessageRequest): Signature[] =>
        plan(request).map(item => ({
            requestIndex: item.requestIndex,
            signer: item.signer,
            scheme: item.scheme,
            bytes: fixtures.sign(item),
        }))

    describe(`MessageSignerChainAdapter contract: ${makeAdapter().chainId}`, () => {
        it("signs for its own chain's scope", () => {
            expect(makeAdapter().chainId).toBe(fixtures.scope.chainId)
        })

        it('supports every method it has a request for, and not an unknown one', () => {
            for (const request of requests) {
                expect(makeAdapter().supports(request.method)).toBe(true)
            }
            expect(makeAdapter().supports(fixtures.unsupportedMethod)).toBe(
                false,
            )
        })

        it('describes every request with a title and a known kind', () => {
            for (const request of requests) {
                const summary = makeAdapter().describe(request)

                expect(summary.title.key).not.toBe('')
                expect(['text', 'typed-data', 'raw']).toContain(summary.kind)
            }
        })

        it('describes a malformed request without throwing', () => {
            expect(() =>
                makeAdapter().describe(fixtures.malformedRequest),
            ).not.toThrow()
        })

        it("plans the account's own signature, in order", () => {
            for (const request of requests) {
                const planned = plan(request)

                expect(planned.length).toBeGreaterThan(0)
                planned.forEach((item, index) => {
                    expect(item.requestIndex).toBe(index)
                    expect(item.signer).toBe(account.address)
                    expect(item.payload.length).toBeGreaterThan(0)
                })
            }
        })

        it('plans the same bytes every time', () => {
            for (const request of requests) {
                expect(plan(request)).toEqual(plan(request))
            }
        })

        it('refuses to plan for a signer other than the account', () => {
            for (const request of requests) {
                expect(() =>
                    plan({ ...request, signer: otherSigner }),
                ).toThrow()
            }
        })

        it('refuses to plan a method it does not sign', () => {
            for (const request of requests) {
                expect(() =>
                    plan({ ...request, method: fixtures.unsupportedMethod }),
                ).toThrow()
            }
        })

        it('refuses to plan a malformed payload', () => {
            expect(() => plan(fixtures.malformedRequest)).toThrow()
        })

        it('assembles the key store signatures into a signed message', () => {
            for (const request of requests) {
                const signed = makeAdapter().assemble(
                    request,
                    signaturesFor(request),
                )

                expect(signed.scope).toEqual(request.scope)
                expect(signed.signature.signer).toBe(account.address)
                expect(signed.signature.bytes.length).toBeGreaterThan(0)
            }
        })

        it('refuses to assemble without its signatures', () => {
            for (const request of requests) {
                expect(() => makeAdapter().assemble(request, [])).toThrow()
            }
        })

        it("refuses to assemble another signer's signature", () => {
            for (const request of requests) {
                const foreign = signaturesFor(request).map(signature => ({
                    ...signature,
                    signer: otherSigner,
                }))

                expect(() => makeAdapter().assemble(request, foreign)).toThrow()
            }
        })
    })
}
