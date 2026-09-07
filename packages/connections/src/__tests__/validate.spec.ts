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
import { ARC60_MAX_REQUEST_BYTES } from '@perawallet/wallet-core-signing'
import { validateRawMessage } from '../validate'
import type { RawInboundMessage } from '../models'

const request = (
    type: 'sign-transactions' | 'sign-data',
    params: unknown,
): RawInboundMessage => ({
    kind: 'request',
    connectionId: 'c1',
    correlationId: '1',
    sourceType: 'walletconnect',
    authorizedAccounts: ['AAAA'],
    peer: { name: 'Test dApp' },
    rawOperation: { type, params },
    respond: vi.fn(async () => {}),
    reject: vi.fn(async () => {}),
})

// 32 bytes [0..31], base64-encoded — a realistic ARC-60 `authenticatorData`.
// Its first 32 decoded bytes must be `sha256(domain)` per ARC-60 / the
// `Arc60StdSigData` doc, so a valid payload can never be shorter than this.
const VALID_AUTH_DATA = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8='
const VALID_AUTH_DATA_BYTES = Uint8Array.from({ length: 32 }, (_, i) => i)

describe('validateRawMessage', () => {
    it('accepts a well-formed ARC-0001 group', () => {
        const result = validateRawMessage(
            request('sign-transactions', [{ txn: 'base64==' }]),
        )

        expect(result.ok).toBe(true)
        if (result.ok && result.message.kind === 'request') {
            expect(result.message.operation).toEqual({
                type: 'sign-transactions',
                group: [{ txn: 'base64==' }],
            })
        }
    })

    it('keeps stxn on a do-not-sign slot so the resolver can reject it', () => {
        // `{ signers: [], stxn }` is ARC-0001's pre-signed passthrough, which
        // the resolver answers with 4200. A schema that strips `stxn` turns
        // that refusal into an ordinary signing sheet.
        const result = validateRawMessage(
            request('sign-transactions', [
                { txn: 'base64==', signers: [], stxn: 'c3R4bg==' },
            ]),
        )

        expect(result.ok).toBe(true)
        if (result.ok && result.message.kind === 'request') {
            expect(result.message.operation.type).toBe('sign-transactions')
            if (result.message.operation.type === 'sign-transactions') {
                expect(result.message.operation.group[0].stxn).toBe('c3R4bg==')
            }
        }
    })

    it('keeps msig and groupMessage so the resolver can reject multisig', () => {
        const result = validateRawMessage(
            request('sign-transactions', [
                {
                    txn: 'base64==',
                    msig: {
                        version: 1,
                        threshold: 2,
                        addrs: ['A'.repeat(58), 'B'.repeat(58)],
                    },
                    groupMessage: 'a group',
                },
            ]),
        )

        expect(result.ok).toBe(true)
        if (result.ok && result.message.kind === 'request') {
            expect(result.message.operation.type).toBe('sign-transactions')
            if (result.message.operation.type === 'sign-transactions') {
                expect(result.message.operation.group[0].msig).toEqual({
                    version: 1,
                    threshold: 2,
                    addrs: ['A'.repeat(58), 'B'.repeat(58)],
                })
                expect(result.message.operation.group[0].groupMessage).toBe(
                    'a group',
                )
            }
        }
    })

    it('rejects an ARC-0001 slot carrying an unknown key', () => {
        // The resolver answers an unrecognised field with 4300; a non-strict
        // boundary schema would strip it first and that refusal could never
        // fire on this route.
        const result = validateRawMessage(
            request('sign-transactions', [{ txn: 'base64==', signeers: [] }]),
        )

        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.message).toMatch(/signeers/)
    })

    it('rejects an ARC-0001 group whose entries have no txn', () => {
        const result = validateRawMessage(
            request('sign-transactions', [{ message: 'hi' }]),
        )

        expect(result.ok).toBe(false)
    })

    it('reports the failing field path so the peer gets a real error', () => {
        const result = validateRawMessage(request('sign-transactions', [{}]))

        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.message).toMatch(/txn/)
    })

    it('discriminates ARC-60 from legacy arbitrary data without sniffing', () => {
        // Replaces the previous heuristic
        // (`params.authenticatorData != null || params.metadata?.scope != null`)
        // over an `any`, which could accept a payload matching neither shape.
        const arc60 = validateRawMessage(
            request('sign-data', {
                data: 'ZGF0YQ==',
                signer: 'A'.repeat(58),
                domain: 'perawallet.app',
                authenticatorData: VALID_AUTH_DATA,
                metadata: { scope: 1, encoding: 'base64' },
            }),
        )
        const legacy = validateRawMessage(
            request('sign-data', [
                { data: 'ZGF0YQ==', signer: 'A'.repeat(58), chainId: 416_001 },
            ]),
        )

        expect(arc60.ok).toBe(true)
        expect(legacy.ok).toBe(true)
    })

    it('builds the real Arc60SignableData wrapper, decoding authenticatorData', () => {
        const result = validateRawMessage(
            request('sign-data', {
                data: 'ZGF0YQ==',
                signer: 'A'.repeat(58),
                domain: 'perawallet.app',
                authenticatorData: VALID_AUTH_DATA,
                requestId: 'req-1',
                hdPath: "m/44'/283'/0'/0/0",
                metadata: { scope: 1, encoding: 'base64' },
            }),
        )

        expect(result.ok).toBe(true)
        if (result.ok && result.message.kind === 'request') {
            expect(result.message.operation).toEqual({
                type: 'sign-data',
                payload: {
                    type: 'arc60',
                    stdSigData: {
                        data: 'ZGF0YQ==',
                        signer: 'A'.repeat(58),
                        domain: 'perawallet.app',
                        authenticatorData: VALID_AUTH_DATA_BYTES,
                        requestId: 'req-1',
                        hdPath: "m/44'/283'/0'/0/0",
                    },
                    metadata: { scope: 1, encoding: 'base64' },
                },
            })
        }
    })

    it('rejects a sign-data payload matching neither shape', () => {
        const result = validateRawMessage(request('sign-data', { nonsense: 1 }))

        expect(result.ok).toBe(false)
    })

    it('reports the failing field path for a malformed ARC-60 payload', () => {
        // Discriminating on the raw shape before parsing hits
        // `arc60WireSchema` directly rather than a `z.union`, so the field
        // path survives.
        const result = validateRawMessage(
            request('sign-data', {
                data: 'ZGF0YQ==',
                signer: 'A'.repeat(58),
                domain: 'perawallet.app',
                metadata: { scope: 1, encoding: 'base64' },
                // authenticatorData omitted
            }),
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error.message).toMatch(/authenticatorData/)
        }
    })

    it('reports the failing field path for a malformed legacy payload', () => {
        const result = validateRawMessage(
            request('sign-data', [{ data: 'ZGF0YQ==' }]),
        )

        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.message).toMatch(/signer/)
    })

    it('accepts a legacy payload without chainId', () => {
        // `chainId` is a WalletConnect v1 wire concept, checked by the v1
        // handler before the message reaches this transport-neutral boundary.
        const result = validateRawMessage(
            request('sign-data', [
                { data: 'ZGF0YQ==', signer: 'A'.repeat(58) },
            ]),
        )

        expect(result.ok).toBe(true)
    })

    it('rejects an ARC-60 payload over the shared size cap', () => {
        const result = validateRawMessage(
            request('sign-data', {
                data: 'A'.repeat(ARC60_MAX_REQUEST_BYTES + 1),
                signer: 'A'.repeat(58),
                domain: 'perawallet.app',
                authenticatorData: VALID_AUTH_DATA,
                metadata: { scope: 1, encoding: 'base64' },
            }),
        )

        expect(result.ok).toBe(false)
    })

    it('rejects authenticatorData that is not valid base64', () => {
        // Long enough to clear the 32-byte floor, so this reaches the
        // alphabet check rather than the length one: `decodeFromBase64`
        // (base64-js) only rejects a length that isn't a multiple of 4, so
        // without the pattern this garbage would sail through.
        const result = validateRawMessage(
            request('sign-data', {
                data: 'ZGF0YQ==',
                signer: 'A'.repeat(58),
                domain: 'perawallet.app',
                authenticatorData: '!'.repeat(48),
                metadata: { scope: 1, encoding: 'base64' },
            }),
        )

        expect(result.ok).toBe(false)
    })

    it('passes notifications through untouched', () => {
        const result = validateRawMessage({
            kind: 'notification',
            connectionId: 'c1',
            event: { type: 'session-expiring', expiresAt: 5 },
        })

        expect(result.ok).toBe(true)
    })
})
