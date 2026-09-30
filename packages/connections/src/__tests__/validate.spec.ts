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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { ARC60_MAX_REQUEST_BYTES } from '@perawallet/wallet-core-signing'
import {
    dappRequestChainAdapters,
    type DappRequestChainAdapter,
} from '../dappRequest'
import { validateRawMessage } from '../validate'
import type { RawInboundMessage } from '../models'

/**
 * A fixture chain adapter. `sign-transactions` validation itself is the
 * adapter's job now (chain-algorand's own tests cover its real ARC-0001
 * rules); this file only proves `validateRawMessage` delegates to whatever
 * is registered for the message's chain, and refuses a chain with nothing
 * registered.
 */
const fixtureAdapter: DappRequestChainAdapter = {
    chainId: 'algorand',
    relayableErrorNames: [],
    parseSigningParams: () => ({ ok: true, payload: [] }),
    resolveReportedNetwork: scope => scope.networkId,
    walletConnect: {
        namespace: 'algorand',
        caip2ChainIdFor: () => null,
        networkForCaip2ChainId: () => null,
        toWireResult: () => null,
    },
    validateTransactionPayload: payload => {
        if (!Array.isArray(payload) || payload.length === 0) {
            return {
                ok: false,
                message: 'Invalid algo_signTxn payload — empty',
            }
        }
        return { ok: true, group: payload }
    },
    useEnqueueTransactionSigning: () => async () => null,
}

const request = (
    type: 'sign-transactions' | 'sign-data',
    params: unknown,
    chainId: ChainId = 'algorand',
): RawInboundMessage => ({
    kind: 'request',
    chainId,
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
    beforeEach(() => {
        dappRequestChainAdapters.reset()
        dappRequestChainAdapters.register(fixtureAdapter)
    })

    it('refuses a message naming a chain with no registered adapter', () => {
        const result = validateRawMessage(
            request(
                'sign-transactions',
                [{ txn: 'base64==' }],
                'other' as ChainId,
            ),
        )

        expect(result.ok).toBe(false)
        if (!result.ok)
            expect(result.error).toMatchObject({
                code: 'unsupported-chain',
            })
    })

    it('accepts a payload the chain adapter validates', () => {
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

    it('rejects with the adapter own message on an invalid payload', () => {
        const result = validateRawMessage(request('sign-transactions', []))

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toMatchObject({
                code: 'invalid-payload',
                message: 'Invalid algo_signTxn payload — empty',
            })
        }
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
        // `chainId` (the wire field, on a legacy `sign-data` entry) is a
        // WalletConnect v1 concept, checked by the v1 handler before the
        // message reaches this transport-neutral boundary.
        const result = validateRawMessage(
            request('sign-data', [
                { data: 'ZGF0YQ==', signer: 'A'.repeat(58) },
            ]),
        )

        expect(result.ok).toBe(true)
    })

    it.each([
        ['non-string', { nested: true }],
        ['oversized', 'A'.repeat(128 * 1024)],
    ])('rejects %s legacy data before it is queued', (_, data) => {
        const result = validateRawMessage(
            request('sign-data', [{ data, signer: 'A'.repeat(58) }]),
        )

        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.message).toMatch(/data/)
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
