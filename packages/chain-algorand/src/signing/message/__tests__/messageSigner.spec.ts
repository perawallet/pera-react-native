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

import { beforeEach, describe, expect, it } from 'vitest'
import { sha256 } from '@noble/hashes/sha2.js'
import {
    bytesToHex,
    concatBytes,
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'
import {
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    MessageRequest,
    Signature,
} from '@perawallet/wallet-core-chain-contract'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    arbitraryDataMessageRequest,
    authDataMessageRequest,
    CannotSignError,
} from '@perawallet/wallet-core-signing'
import { ALGORAND_CHAIN_ID } from '../../../chain-id'
import { decodeArbitraryDataForDisplay } from '../../arbitraryDataDisplay'
import { Arc60BadJsonError, Arc60InvalidSignerError } from '../arc60-errors'
import {
    ALGORAND_MESSAGE_TITLE_KEYS,
    assembleAlgorandMessage,
    describeAlgorandMessage,
    planAlgorandMessage,
    supportsAlgorandMessageMethod,
} from '../messageSigner'
import {
    messageAccount,
    otherMessageAddress,
    siwaAuthPayload,
} from './messageFixtures'

const scope = getSelectedScope(ALGORAND_CHAIN_ID)
const { address } = messageAccount
const context = { account: messageAccount, accounts: [messageAccount] }

const b64 = (bytes: Uint8Array | string) =>
    encodeToBase64(
        typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes,
    )
const mxRequest = (data: string) =>
    arbitraryDataMessageRequest(scope, address, data)
const authRequest = (overrides: Record<string, unknown> = {}) =>
    authDataMessageRequest(scope, address, siwaAuthPayload(address, overrides))

describe('algorand message signer', () => {
    beforeEach(() => {
        useAccountChainStateStore.getState().resetState()
    })

    describe('supports', () => {
        it('lists exactly the two message kinds', () => {
            expect(supportsAlgorandMessageMethod('arbitrary-data')).toBe(true)
            expect(supportsAlgorandMessageMethod('auth-data')).toBe(true)
            expect(supportsAlgorandMessageMethod('algo_signData')).toBe(false)
        })
    })

    describe('describe', () => {
        it('shows UTF-8 text as text', () => {
            expect(describeAlgorandMessage(mxRequest(b64('hello')))).toEqual({
                kind: 'text',
                title: { key: 'signing.arbitrary_data_view.body' },
                preview: 'hello',
            })
        })

        it('shows binary data as the hex the review screen shows', () => {
            const data = b64(new Uint8Array([0, 1, 2, 255]))

            expect(describeAlgorandMessage(mxRequest(data))).toEqual({
                kind: 'raw',
                title: { key: 'signing.arbitrary_data_view.body' },
                preview: bytesToHex(decodeFromBase64(data)),
            })
            expect(decodeArbitraryDataForDisplay(data)).toEqual({
                kind: 'hex',
                hex: '000102ff',
            })
        })

        it('shows a SIWA request with its statement as the preview', () => {
            expect(describeAlgorandMessage(authRequest())).toEqual({
                kind: 'text',
                title: { key: 'signing.arc60_view.title' },
                preview: 'Sign in to arc60.io',
            })
        })

        it('leaves the preview out of a SIWA request with no statement', () => {
            const summary = describeAlgorandMessage(
                authRequest({ statement: undefined }),
            )

            expect(summary).toEqual({
                kind: 'text',
                title: { key: 'signing.arc60_view.title' },
            })
            expect('preview' in summary).toBe(false)
        })

        it('shows an invalid SIWA request as raw, without throwing', () => {
            const payload = siwaAuthPayload(address)
            const request = authDataMessageRequest(scope, address, {
                ...payload,
                authData: { ...payload.authData, data: b64('{"not":"siwa"}') },
            })

            expect(describeAlgorandMessage(request)).toEqual({
                kind: 'raw',
                title: { key: 'signing.arc60_view.siwa_invalid' },
            })
        })

        it('falls back to the raw summaries for a malformed payload', () => {
            const arbitrary: MessageRequest = {
                ...mxRequest('x'),
                payload: { data: 7 },
            }
            const auth: MessageRequest = {
                ...authRequest(),
                payload: 'nope',
            }

            expect(describeAlgorandMessage(arbitrary)).toEqual({
                kind: 'raw',
                title: { key: 'signing.arbitrary_data_view.body' },
            })
            expect(describeAlgorandMessage(auth)).toEqual({
                kind: 'raw',
                title: { key: 'signing.arc60_view.siwa_invalid' },
            })
        })

        it('throws for an unsupported method', () => {
            expect(() =>
                describeAlgorandMessage({ ...mxRequest('x'), method: 'other' }),
            ).toThrow()
        })

        it('only emits keys the chain module declares', () => {
            const emitted = [
                describeAlgorandMessage(mxRequest(b64('hello'))),
                describeAlgorandMessage(authRequest()),
                describeAlgorandMessage({ ...authRequest(), payload: null }),
            ].map(summary => summary.title.key)

            for (const key of emitted) {
                expect(ALGORAND_MESSAGE_TITLE_KEYS).toContain(key)
            }
        })
    })

    describe('plan', () => {
        it("plans MX data as 'MX' followed by the decoded bytes", () => {
            const [item] = planAlgorandMessage(mxRequest(b64('hello')), context)

            expect(item).toEqual({
                requestIndex: 0,
                signer: address,
                scheme: 'ed25519',
                payload: concatBytes(
                    new TextEncoder().encode('MX'),
                    new TextEncoder().encode('hello'),
                ),
            })
        })

        it('plans ARC-60 as sha256(data) followed by sha256(authenticatorData)', () => {
            const { authData } = siwaAuthPayload(address)

            const [item] = planAlgorandMessage(authRequest(), context)

            expect(item.payload).toEqual(
                concatBytes(
                    sha256(decodeFromBase64(authData.data)),
                    sha256(authData.authenticatorData),
                ),
            )
        })

        it('plans a quantum account under the falcon scheme over the same bytes', () => {
            const quantum = {
                ...messageAccount,
                custody: { kind: 'local', seed: 'quantum' },
            } as unknown as WalletAccount

            const [item] = planAlgorandMessage(mxRequest(b64('hello')), {
                account: quantum,
                accounts: [quantum],
            })

            expect(item.scheme).toBe('falcon-1024')
            expect(item.payload).toEqual(
                planAlgorandMessage(mxRequest(b64('hello')), context)[0]
                    .payload,
            )
        })

        it('refuses a request for another chain before anything else', () => {
            const request = {
                ...mxRequest(b64('hello')),
                scope: { ...scope, chainId: 'other' },
                signer: otherMessageAddress,
            } as MessageRequest

            expect(() => planAlgorandMessage(request, context)).toThrow(
                /Not an Algorand message request/,
            )
        })

        it('refuses a signer other than the account', () => {
            const request = {
                ...mxRequest(b64('hello')),
                signer: otherMessageAddress,
                method: 'other',
            }

            expect(() => planAlgorandMessage(request, context)).toThrow(
                CannotSignError,
            )
            expect(() => planAlgorandMessage(request, context)).toThrow(
                /names .* as its signer/,
            )
        })

        it('refuses an unsupported method', () => {
            expect(() =>
                planAlgorandMessage(
                    { ...mxRequest(b64('hello')), method: 'algo_signData' },
                    context,
                ),
            ).toThrow(/unsupported message method/)
        })

        it('refuses a malformed payload before validating it', () => {
            expect(() =>
                planAlgorandMessage(
                    { ...mxRequest('x'), payload: { data: 7 } },
                    context,
                ),
            ).toThrow(/malformed/)
            expect(() =>
                planAlgorandMessage({ ...authRequest(), payload: {} }, context),
            ).toThrow(/malformed/)
        })

        it('refuses an auth request whose authData names another signer', () => {
            const payload = siwaAuthPayload(address)
            const request = authDataMessageRequest(scope, address, {
                ...payload,
                authData: { ...payload.authData, signer: otherMessageAddress },
            })

            expect(() => planAlgorandMessage(request, context)).toThrow(
                Arc60InvalidSignerError,
            )
        })

        it('keeps ARC-60 validation errors as they were', () => {
            const payload = siwaAuthPayload(address)
            const request = authDataMessageRequest(scope, address, {
                ...payload,
                authData: { ...payload.authData, data: b64('{"not":"siwa"}') },
            })

            expect(() => planAlgorandMessage(request, context)).toThrow(
                Arc60BadJsonError,
            )
        })

        it('keeps the MX refusal for an account that cannot sign data', () => {
            const watch = {
                address,
                custody: { kind: 'watch' },
            } as unknown as WalletAccount

            expect(() =>
                planAlgorandMessage(mxRequest(b64('hello')), {
                    account: watch,
                    accounts: [watch],
                }),
            ).toThrow(`Cannot sign arbitrary data for ${address}`)
        })
    })

    describe('assemble', () => {
        const signature: Signature = {
            requestIndex: 0,
            signer: address,
            scheme: 'ed25519',
            bytes: new Uint8Array([1, 2, 3]),
        }

        it('passes the signature bytes through untouched', () => {
            const signed = assembleAlgorandMessage(mxRequest('x'), [signature])

            expect(signed.scope).toEqual(scope)
            expect(signed.signature.bytes).toBe(signature.bytes)
        })

        it.each([
            ['no signature', []],
            ['two signatures', [signature, signature]],
            ['a wrong request index', [{ ...signature, requestIndex: 1 }]],
            ['another signer', [{ ...signature, signer: otherMessageAddress }]],
            ['empty bytes', [{ ...signature, bytes: new Uint8Array() }]],
        ])('refuses %s', (_name, signatures) => {
            expect(() =>
                assembleAlgorandMessage(mxRequest('x'), signatures),
            ).toThrow(/exactly one signature/)
        })
    })
})
