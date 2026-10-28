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
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import { parseAuthDataWireRequest } from '@perawallet/wallet-core-signing'
import { ARC60_MAX_REQUEST_BYTES } from '../../../chain-algorand/src/signing/message/arc60-wire'
import {
    dappRequestChainAdapters,
    type DappRequestChainAdapter,
} from '../dappRequest'
import { DappRequestCodedError } from '../errors'
import { validateRawMessage } from '../validate'
import type { RawInboundMessage, WalletOperationType } from '../models'

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
    accountTypeOf: () => 'Fixture',
    parseSigningParams: () => ({ ok: true, payload: [] }),
    resolveReportedNetwork: scope => scope.networkId,
    emptySignaturesFor: () => ({}),
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
    type: WalletOperationType,
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
// `AuthData` doc, so a valid payload can never be shorter than this.
const VALID_AUTH_DATA = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8='
const VALID_AUTH_DATA_BYTES = Uint8Array.from({ length: 32 }, (_, i) => i)

describe('validateRawMessage', () => {
    beforeEach(() => {
        dappRequestChainAdapters.reset()
        dappRequestChainAdapters.register(fixtureAdapter)
    })

    it.each([
        'send-transaction',
        'sign-message',
        'sign-typed-data',
        'send-batch',
        'show-batch',
    ] as const)('refuses a %s request as unsupported', type => {
        const result = validateRawMessage(request(type, ['0x']))

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toMatchObject({
                code: 'unsupported-operation',
            })
        }
    })

    describe('switch-network', () => {
        const switchable: DappRequestChainAdapter = {
            ...fixtureAdapter,
            walletConnect: {
                ...fixtureAdapter.walletConnect,
                caip2ChainIdFor: networkId =>
                    networkId === 'mainnet'
                        ? 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
                        : null,
            },
        }

        beforeEach(() => {
            dappRequestChainAdapters.reset()
            dappRequestChainAdapters.register(switchable)
        })

        it('accepts a network the chain declares', () => {
            const result = validateRawMessage(
                request('switch-network', { networkId: 'mainnet' }),
            )

            expect(result).toMatchObject({
                ok: true,
                message: {
                    operation: { type: 'switch-network', networkId: 'mainnet' },
                },
            })
        })

        it.each([
            ['an unknown network id', { networkId: 'custom' }],
            ['a missing network id', {}],
            ['no params', undefined],
            ['a non-id value', { networkId: 7 }],
        ])('refuses %s as an invalid payload', (_name, params) => {
            const result = validateRawMessage(request('switch-network', params))

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toMatchObject({ code: 'invalid-payload' })
            }
        })
    })

    describe('send-batch', () => {
        const validate = vi.fn()

        beforeEach(() => {
            validate.mockReset()
            dappRequestChainAdapters.reset()
            dappRequestChainAdapters.register({
                ...fixtureAdapter,
                sendBatch: {
                    validate,
                    prepare: vi.fn(),
                    start: vi.fn(),
                    locate: vi.fn(),
                },
            })
        })

        it("carries the chain's validated batch, and hands the validator the session accounts", () => {
            validate.mockReturnValue({ ok: true, request: { calls: 2 } })

            const result = validateRawMessage(
                request('send-batch', { from: 'AAAA' }),
            )

            expect(validate).toHaveBeenCalledWith({ from: 'AAAA' }, ['AAAA'])
            expect(result).toMatchObject({
                ok: true,
                message: {
                    operation: { type: 'send-batch', request: { calls: 2 } },
                },
            })
        })

        it("refuses with the chain's own wire code when the chain picks one", () => {
            validate.mockReturnValue({
                ok: false,
                failure: 'coded',
                code: 5710,
                message: 'wrong chain',
            })

            const result = validateRawMessage(request('send-batch', {}))

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toBeInstanceOf(DappRequestCodedError)
                expect(result.error).toMatchObject({
                    wireCode: 5710,
                    message: 'wrong chain',
                })
            }
        })

        it('carries a batch id to show', () => {
            const result = validateRawMessage(
                request('show-batch', { batchId: 'batch-1' }),
            )

            expect(result).toMatchObject({
                ok: true,
                message: {
                    operation: { type: 'show-batch', batchId: 'batch-1' },
                },
            })
        })

        it.each([{}, { batchId: '' }, { batchId: 7 }, null])(
            'refuses a batch to show without an id: %o',
            params => {
                const result = validateRawMessage(request('show-batch', params))

                expect(result.ok).toBe(false)
                if (!result.ok) {
                    expect(result.error).toMatchObject({
                        code: 'invalid-payload',
                    })
                }
            },
        )
    })

    describe('send-transaction', () => {
        const validate = vi.fn()

        beforeEach(() => {
            validate.mockReset()
            dappRequestChainAdapters.reset()
            dappRequestChainAdapters.register({
                ...fixtureAdapter,
                sendTransaction: { validate, build: vi.fn() },
            })
        })

        it("carries the chain's validated request, and hands the validator the session accounts", () => {
            validate.mockReturnValue({ ok: true, request: { to: 'TO' } })

            const result = validateRawMessage(
                request('send-transaction', { from: 'AAAA' }),
            )

            expect(validate).toHaveBeenCalledWith({ from: 'AAAA' }, ['AAAA'])
            expect(result).toMatchObject({
                ok: true,
                message: {
                    operation: {
                        type: 'send-transaction',
                        request: { to: 'TO' },
                    },
                },
            })
        })

        it('refuses an unauthorized account with its own code and failure', () => {
            validate.mockReturnValue({
                ok: false,
                failure: 'unauthorized-account',
                message: 'not yours',
            })

            const result = validateRawMessage(request('send-transaction', {}))

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toMatchObject({
                    code: 'unauthorized-account',
                    failure: 'unauthorized-account',
                    message: 'not yours',
                })
            }
        })

        it('refuses invalid params as an invalid payload', () => {
            validate.mockReturnValue({
                ok: false,
                failure: 'invalid-params',
                message: 'bad value',
            })

            const result = validateRawMessage(request('send-transaction', {}))

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toMatchObject({
                    code: 'invalid-payload',
                    failure: 'invalid-params',
                    message: 'bad value',
                })
            }
        })
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

    it('discriminates auth data from legacy arbitrary data without sniffing', () => {
        // Replaces the previous heuristic
        // (`params.authenticatorData != null || params.metadata?.scope != null`)
        // over an `any`, which could accept a payload matching neither shape.
        const authData = validateRawMessage(
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

        expect(authData.ok).toBe(true)
        expect(legacy.ok).toBe(true)
    })

    it('builds the real AuthDataSignableData wrapper, decoding authenticatorData', () => {
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
                    type: 'auth-data',
                    authData: {
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

    it('rejects an auth-data payload as invalid when no message signer is registered for the chain', () => {
        vi.mocked(parseAuthDataWireRequest).mockImplementationOnce(() => {
            throw new ChainAdapterNotRegisteredError(
                'message signer',
                'algorand',
            )
        })

        const result = validateRawMessage(
            request('sign-data', {
                data: 'ZGF0YQ==',
                signer: 'A'.repeat(58),
                domain: 'perawallet.app',
                authenticatorData: VALID_AUTH_DATA,
                metadata: { scope: 1, encoding: 'base64' },
            }),
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toMatchObject({ code: 'invalid-payload' })
        }
    })

    it('rejects a sign-data payload matching neither shape', () => {
        const result = validateRawMessage(request('sign-data', { nonsense: 1 }))

        expect(result.ok).toBe(false)
    })

    it('reports the failing field path for a malformed auth-data payload', () => {
        // Discriminating on the raw shape before parsing hits
        // the wire schema directly rather than a `z.union`, so the field
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

    it('rejects an auth-data payload over the shared size cap', () => {
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

describe('validateRawMessage: message operations', () => {
    const SIGNER = '0xAbCd'
    const validateMessagePayload = vi.fn<
        NonNullable<DappRequestChainAdapter['validateMessagePayload']>
    >((type, params) => ({
        ok: true,
        request: { method: type, signer: SIGNER, payload: params },
    }))

    const messageRequest = (
        type: 'sign-message' | 'sign-typed-data',
        params: unknown,
    ): RawInboundMessage => ({
        ...(request(type, params) as Extract<
            RawInboundMessage,
            { kind: 'request' }
        >),
        authorizedAccounts: [SIGNER],
    })

    beforeEach(() => {
        validateMessagePayload.mockClear()
        dappRequestChainAdapters.reset()
        dappRequestChainAdapters.register({
            ...fixtureAdapter,
            validateMessagePayload,
        })
    })

    it.each(['sign-message', 'sign-typed-data'] as const)(
        "accepts a %s request the chain validated against the session's accounts",
        type => {
            const result = validateRawMessage(messageRequest(type, 'payload'))

            expect(validateMessagePayload).toHaveBeenCalledWith(
                type,
                'payload',
                [SIGNER],
            )
            expect(result.ok).toBe(true)
            if (result.ok && result.message.kind === 'request') {
                expect(result.message.operation).toEqual({
                    type,
                    request: {
                        method: type,
                        signer: SIGNER,
                        payload: 'payload',
                    },
                })
            }
        },
    )

    it.each([
        ['unauthorized-account', 'unauthorized-account'],
        ['invalid-params', 'invalid-payload'],
    ] as const)(
        "refuses the chain's %s as %s, keeping its message",
        (failure, code) => {
            validateMessagePayload.mockReturnValueOnce({
                ok: false,
                failure,
                message: 'why',
            })

            const result = validateRawMessage(
                messageRequest('sign-message', 'p'),
            )

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toMatchObject({ code, message: 'why' })
            }
        },
    )

    it('refuses as unsupported when the adapter serves no messages', () => {
        dappRequestChainAdapters.reset()
        dappRequestChainAdapters.register(fixtureAdapter)

        const result = validateRawMessage(messageRequest('sign-message', 'p'))

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toMatchObject({
                code: 'unsupported-operation',
            })
        }
    })
})
