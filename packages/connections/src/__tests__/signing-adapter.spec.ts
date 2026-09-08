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
import { renderHook } from '@testing-library/react'
import { logger } from '@perawallet/wallet-core-shared'
import {
    Arc0001Error,
    Arc0001ErrorCode,
    resolveArc0001SignTxnRequest,
    type Arc0001ResolveResult,
    type Arc0001SignTxnsRequest,
} from '@perawallet/wallet-core-blockchain'
import type {
    Arc60SignableData,
    ExternalSignTxnTransport,
    PeraArbitraryDataMessage,
} from '@perawallet/wallet-core-signing'
import type { InboundMessage, RawInboundMessage } from '../models'
import type { ConnectionRegistry } from '../registry'
import { validateRawMessage } from '../validate'

const mockResolve = vi.fn(
    (
        _request: Arc0001SignTxnsRequest,
        _options?: { authorizedAddresses?: Set<string> },
    ): Arc0001ResolveResult => ({
        allDecoded: [],
        toSign: [],
        signerOverrides: new Map(),
    }),
)
// Typed to the real `EnqueueArc0001SignRequest` shape, so the transport object
// the adapter hands over is read back below with its true type rather than as
// an implicit `any`.
const mockEnqueue = vi.fn(
    async (
        _resolved: unknown,
        _transport: ExternalSignTxnTransport,
    ): Promise<void> => {},
)

const lastTransport = (): ExternalSignTxnTransport => {
    const call = mockEnqueue.mock.calls.at(-1)
    if (!call) throw new Error('enqueue was never called')
    return call[1]
}
const mockAddSignRequest = vi.fn()
const mockRemoveSignRequest = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useArc0001Resolver: () => mockResolve,
    useEnqueueArc0001SignRequest: () => mockEnqueue,
    useSigningRequest: () => ({
        addSignRequest: mockAddSignRequest,
        removeSignRequest: mockRemoveSignRequest,
    }),
    // Small on purpose so "too many requests" tests stay short — the real
    // value (1000, `@perawallet/wallet-core-signing`'s `constants.ts`) is
    // exercised by that package's own tests.
    MAX_DATA_SIGN_REQUESTS: 2,
    // `schema.ts` and `validate.ts` import these eagerly; only the
    // sign-transactions path is driven from this file, so neither is used.
    arc60WireSchema: { safeParse: vi.fn() },
    parseArc60WireRequest: vi.fn(),
}))

// A minimal double of `WalletAccount` — just the fields the two capability
// checks below and the adapter's own signer lookups read.
type MockAccount = {
    address: string
    rekeyAddress?: string
    canSignData?: boolean
    canArc60?: boolean
}

let mockAccounts: MockAccount[] = []

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mockAccounts,
    // Mirrors the real `canSignArbitraryData`: a flag on the account itself,
    // no rekey hop.
    canSignArbitraryData: (account: MockAccount) =>
        account.canSignData === true,
    // Mirrors the real `canSignArc60`: account-local, because an ARC-60
    // signature verifies against the signer's own key.
    canSignArc60: (account: MockAccount) => account.canArc60 === true,
}))

const { enqueueInboundRequest, useConnectionSigningAdapter } =
    await import('../signing-adapter')

// Two accounts distinct from every other fixture in this file (default
// `authorizedAccounts` below is `['AAAA']`), so a mutant that hardcodes a
// signer value cannot survive these tests.
const PRIMARY_SIGNER = 'SIGNERPRIMARYQWERTYUIOP123456'
const REKEYED_SIGNER = 'SIGNERREKEYEDASDFGHJKL7890123'

// A canonically encoded 1-microAlgo payment. The real ARC-0001 resolver
// msgpack-decodes every slot before it reaches the `msig` check, so the
// multisig test below needs a transaction algosdk actually accepts.
const PAYMENT_TXN_BASE64 =
    'iaNhbXQBo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIKurq6urq6urq6urq6urq6urq6urq6urq6urq6urq6uromx2zQfQo3JjdsQgAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKjc25kxCABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAaR0eXBlo3BheQ=='
const PAYMENT_TXN_SENDER =
    'AEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEA5RCDXMI'

// A peer identity distinct from every other fixture in this file, so a
// mutant that hardcodes or drops `sourceMetadata` cannot survive the tests
// that assert it below.
const PEER = {
    name: 'Distinctive Test Dapp',
    url: 'https://distinctive-test-dapp.example',
}

const signDataMessage = (
    payload: Arc60SignableData | PeraArbitraryDataMessage[],
    authorizedAccounts: string[] = ['AAAA'],
) => ({
    kind: 'request' as const,
    connectionId: 'c1',
    correlationId: '9',
    authorizedAccounts,
    peer: PEER,
    operation: { type: 'sign-data' as const, payload },
    respond: vi.fn(async () => {}),
    reject: vi.fn(async () => {}),
})

// A real `ConnectionRegistry`, not an `as never` double: `subscribeToMessages`
// is the live implementation under test, and the other nine members are
// `vi.fn()`s. If the interface gains a required method or
// `subscribeToMessages` changes shape, this fails to compile instead of
// silently passing through the bottom type.
const makeRegistry = () => {
    let emit: ((m: InboundMessage) => void) | undefined
    const registry: ConnectionRegistry = {
        register: vi.fn(),
        initialize: vi.fn(async () => {}),
        teardown: vi.fn(async () => {}),
        pair: vi.fn(async () => 'pairing-id'),
        disconnect: vi.fn(async () => {}),
        disconnectAll: vi.fn(async () => {}),
        abandonPairing: vi.fn(),
        describeUri: vi.fn(() => ({})),
        networksFor: vi.fn(() => []),
        subscribeToProposals: vi.fn(() => () => {}),
        subscribeToMessages: listener => {
            emit = listener
            return () => void (emit = undefined)
        },
        subscribeToErrors: vi.fn(() => () => {}),
    }
    return {
        registry,
        send: (m: InboundMessage) => emit?.(m),
        isSubscribed: () => emit !== undefined,
    }
}

describe('useConnectionSigningAdapter', () => {
    beforeEach(() => {
        mockAccounts = []
        mockAddSignRequest.mockClear()
        mockRemoveSignRequest.mockClear()
        mockResolve.mockClear()
        mockEnqueue.mockClear()
    })

    it('enqueues a sign-transactions request with the connection as transportId', () => {
        const { registry, send } = makeRegistry()
        renderHook(() => useConnectionSigningAdapter(registry))

        send({
            kind: 'request',
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject: vi.fn(),
        })

        expect(mockEnqueue).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                sourceType: 'walletconnect',
                transportId: 'c1',
                // The connection's peer identity, stamped as the
                // anti-spoofing dApp identity shown on the signing sheet.
                sourceMetadata: PEER,
            }),
        )
    })

    it('binds the request to the connection approved accounts', () => {
        // Without this, a session approved for account A could sign for
        // account B. `authorizedAddresses` is the guarantee; it must reach
        // the resolver on every request.
        const { registry, send } = makeRegistry()
        renderHook(() => useConnectionSigningAdapter(registry))

        send({
            kind: 'request',
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA', 'BBBB'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject: vi.fn(),
        })

        expect(mockResolve).toHaveBeenCalledWith(expect.anything(), {
            authorizedAddresses: new Set(['AAAA', 'BBBB']),
        })
    })

    it('routes the signed result back through respond, not a transport call', async () => {
        const { registry, send } = makeRegistry()
        const respond = vi.fn(async () => {})
        renderHook(() => useConnectionSigningAdapter(registry))

        send({
            kind: 'request',
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond,
            reject: vi.fn(),
        })
        const transport = lastTransport()
        await transport.respondWithResult(['signed==', null])

        expect(respond).toHaveBeenCalledWith({
            type: 'sign-transactions',
            signed: ['signed==', null],
        })
    })

    it('propagates a delivery failure so the pipeline can offer a retry', async () => {
        const { registry, send } = makeRegistry()
        const respond = vi.fn(async () => {
            throw new Error('socket dead')
        })
        renderHook(() => useConnectionSigningAdapter(registry))

        send({
            kind: 'request',
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond,
            reject: vi.fn(),
        })
        const transport = lastTransport()

        await expect(transport.respondWithResult([])).rejects.toThrow(
            'socket dead',
        )
    })

    it('swallows a failed rejection delivery instead of leaking it', async () => {
        // `respondWithReject` is typed as returning void, so there is nowhere
        // to propagate a delivery failure to. Un-caught, the rejection escapes
        // to the platform's global handler — a red box on React Native, and a
        // file-level failure here. A v1 handler's `reject` genuinely rejects
        // when the bridge socket cannot be revived, so this is live.
        const { registry, send } = makeRegistry()
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        const reject = vi.fn(async () => {
            throw new Error('socket dead')
        })
        renderHook(() => useConnectionSigningAdapter(registry))

        send({
            kind: 'request',
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject,
        })
        const transport = lastTransport()

        expect(() => transport.respondWithReject()).not.toThrow()
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(reject).toHaveBeenCalled()
        expect(warn).toHaveBeenCalledWith(
            '[connections] reject delivery failed',
            expect.objectContaining({ connectionId: 'c1' }),
        )
        warn.mockRestore()
    })

    it('contains a reject that throws before its first await', async () => {
        // `reject` is handler-supplied transport code and can fail either way;
        // `respondWithError` is the second call site with nowhere to propagate.
        const { registry, send } = makeRegistry()
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        const reject = vi.fn(() => {
            throw new Error('no connector')
        })
        renderHook(() => useConnectionSigningAdapter(registry))

        send({
            kind: 'request',
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject,
        })
        const transport = lastTransport()

        expect(() =>
            transport.respondWithError(new Error('signing failed')),
        ).not.toThrow()
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(warn).toHaveBeenCalledWith(
            '[connections] reject delivery failed',
            expect.objectContaining({ connectionId: 'c1' }),
        )
        warn.mockRestore()
    })

    it('rejects the peer when the resolver throws an ARC-0001 violation', () => {
        // `resolveArc0001SignTxnRequest` throws on every spec violation (bad
        // base64, msig, over-max count, disagreeing authAddr...). Nothing
        // downstream answers the peer for us: an escaped throw dies in the
        // registry's listener loop as a log line and the dApp waits out its
        // own timeout.
        const { registry, send } = makeRegistry()
        const violation = new Error('Invalid base64 in transaction 0')
        mockResolve.mockImplementationOnce(() => {
            throw violation
        })
        renderHook(() => useConnectionSigningAdapter(registry))

        const message = {
            kind: 'request' as const,
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: {
                type: 'sign-transactions' as const,
                group: [{ txn: 'not-base64' }],
            },
            respond: vi.fn(async () => {}),
            reject: vi.fn(async () => {}),
        }
        expect(() => send(message)).not.toThrow()

        expect(message.reject).toHaveBeenCalledWith(violation)
        expect(mockEnqueue).not.toHaveBeenCalled()
    })

    it('rejects a multisig slot to the peer with ARC-0001 4200', () => {
        // End to end over the real resolver: the boundary schema has to carry
        // `msig` through, or the resolver never sees it and a request for
        // multisig sub-signing renders as an ordinary signing sheet.
        const { registry, send } = makeRegistry()
        mockResolve.mockImplementationOnce((request, options) =>
            resolveArc0001SignTxnRequest(request, {
                signableAddresses: new Set([PAYMENT_TXN_SENDER]),
                authorizedAddresses: options?.authorizedAddresses,
            }),
        )
        renderHook(() => useConnectionSigningAdapter(registry))

        const reject = vi.fn(async (_error: Error) => {})
        const raw: RawInboundMessage = {
            kind: 'request',
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: [PAYMENT_TXN_SENDER],
            peer: PEER,
            rawOperation: {
                type: 'sign-transactions',
                params: [
                    {
                        txn: PAYMENT_TXN_BASE64,
                        msig: {
                            version: 1,
                            threshold: 2,
                            addrs: [PAYMENT_TXN_SENDER, PAYMENT_TXN_SENDER],
                        },
                    },
                ],
            },
            respond: vi.fn(async () => {}),
            reject,
        }
        const validated = validateRawMessage(raw)

        expect(validated.ok).toBe(true)
        if (!validated.ok) return
        send(validated.message)

        const relayed = reject.mock.calls[0][0]
        if (!(relayed instanceof Arc0001Error)) {
            throw new Error(`expected an Arc0001Error, got ${String(relayed)}`)
        }
        expect(relayed.code).toBe(Arc0001ErrorCode.Unsupported)
        expect(mockEnqueue).not.toHaveBeenCalled()
    })

    it('rejects an unauthorized signer to the peer, not just silently', () => {
        // The branch's headline security property: a session approved for
        // account A must not sign for account B. The resolver enforces it by
        // throwing `Unauthorized`, so "nothing is signed" is only half the
        // contract — the refusal has to reach the dApp and the user too.
        const { registry, send } = makeRegistry()
        const unauthorized = new Error('Signer BBBB is not authorized')
        mockResolve.mockImplementationOnce(() => {
            throw unauthorized
        })
        renderHook(() => useConnectionSigningAdapter(registry))

        const message = {
            kind: 'request' as const,
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: {
                type: 'sign-transactions' as const,
                group: [{ txn: 'b64', signers: ['BBBB'] }],
            },
            respond: vi.fn(async () => {}),
            reject: vi.fn(async () => {}),
        }
        send(message)

        expect(message.reject).toHaveBeenCalledWith(unauthorized)
        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('rejects the peer when enqueueing the sign request fails', async () => {
        // `enqueue` is async and can reject after its own error handling has
        // run out — re-encoding a fee-adjusted group, or `addSignRequest`
        // itself. Un-caught that is an unhandled rejection AND an unanswered
        // peer.
        const { registry, send } = makeRegistry()
        const failure = new Error('encode failed')
        mockEnqueue.mockRejectedValueOnce(failure)
        renderHook(() => useConnectionSigningAdapter(registry))

        const message = {
            kind: 'request' as const,
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: {
                type: 'sign-transactions' as const,
                group: [{ txn: 'b64' }],
            },
            respond: vi.fn(async () => {}),
            reject: vi.fn(async () => {}),
        }
        send(message)
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(message.reject).toHaveBeenCalledWith(failure)
    })

    describe('sign-data', () => {
        it('enqueues an ARC-60 sign request', () => {
            mockAccounts = [{ address: PRIMARY_SIGNER, canArc60: true }]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry))

            const stdSigData = {
                data: 'ZGF0YQ==',
                signer: PRIMARY_SIGNER,
                domain: 'example.com',
                authenticatorData: new Uint8Array([1, 2, 3]),
            }
            const metadata = { scope: 1, encoding: 'base64' }

            send(
                signDataMessage({ type: 'arc60', stdSigData, metadata }, [
                    PRIMARY_SIGNER,
                ]),
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'arc60',
                    stdSigData,
                    metadata,
                    // The connection's peer identity, stamped as the
                    // anti-spoofing dApp identity shown on the signing sheet.
                    sourceMetadata: PEER,
                }),
            )
        })

        it('enqueues a legacy arbitrary-data sign request', () => {
            mockAccounts = [{ address: PRIMARY_SIGNER, canSignData: true }]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry))

            const payload = [
                { data: 'ZGF0YQ==', signer: PRIMARY_SIGNER, chainId: 4160 },
            ]

            send(signDataMessage(payload, [PRIMARY_SIGNER]))

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'arbitrary-data',
                    data: payload,
                    // The connection's peer identity, stamped as the
                    // anti-spoofing dApp identity shown on the signing sheet.
                    sourceMetadata: PEER,
                }),
            )
        })

        it('rejects a signer outside the connection approved accounts', () => {
            // The security property: a session approved for PRIMARY_SIGNER
            // must not sign for REKEYED_SIGNER.
            mockAccounts = [{ address: REKEYED_SIGNER, canSignData: true }]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry))

            const message = signDataMessage(
                [
                    {
                        data: 'ZGF0YQ==',
                        signer: REKEYED_SIGNER,
                        chainId: 4160,
                    },
                ],
                [PRIMARY_SIGNER],
            )
            send(message)

            expect(message.reject).toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('rejects more items than MAX_DATA_SIGN_REQUESTS', () => {
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry))

            // Mocked MAX_DATA_SIGN_REQUESTS is 2, above.
            const message = signDataMessage(
                [
                    { data: 'ZGF0YQ==', signer: PRIMARY_SIGNER, chainId: 4160 },
                    { data: 'ZGF0YQ==', signer: PRIMARY_SIGNER, chainId: 4160 },
                    { data: 'ZGF0YQ==', signer: PRIMARY_SIGNER, chainId: 4160 },
                ],
                [PRIMARY_SIGNER],
            )
            send(message)

            expect(message.reject).toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('rejects a signer that cannot sign arbitrary data', () => {
            // A watch account: present and authorized, but keyless.
            mockAccounts = [{ address: PRIMARY_SIGNER, canSignData: false }]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry))

            const message = signDataMessage(
                [
                    {
                        data: 'ZGF0YQ==',
                        signer: PRIMARY_SIGNER,
                        chainId: 4160,
                    },
                ],
                [PRIMARY_SIGNER],
            )
            send(message)

            expect(message.reject).toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('rejects an ARC-60 signer that cannot sign ARC-60', () => {
            // A multisig account: present and authorized, but a threshold
            // signature can never be represented in a single ARC-60 response.
            mockAccounts = [{ address: PRIMARY_SIGNER, canArc60: false }]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry))

            const message = signDataMessage(
                {
                    type: 'arc60',
                    stdSigData: {
                        data: 'ZGF0YQ==',
                        signer: PRIMARY_SIGNER,
                        domain: 'example.com',
                        authenticatorData: new Uint8Array([1, 2, 3]),
                    },
                    metadata: { scope: 1, encoding: 'base64' },
                },
                [PRIMARY_SIGNER],
            )
            send(message)

            expect(message.reject).toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('authorizes a signer that is the session account rekeyed to it', () => {
            // The session approved REKEYED_SIGNER, the account the wallet
            // holds. It's rekeyed to PRIMARY_SIGNER, which the dApp names as
            // `signer` directly (use-wallet v5 resolves the auth address
            // itself before sending the request) — never in
            // `authorizedAccounts` directly. Without the rekey branch in the
            // membership check, this would be wrongly rejected as an
            // unauthorized signer.
            mockAccounts = [
                { address: REKEYED_SIGNER, rekeyAddress: PRIMARY_SIGNER },
                { address: PRIMARY_SIGNER, canArc60: true },
            ]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry))

            send(
                signDataMessage(
                    {
                        type: 'arc60',
                        stdSigData: {
                            data: 'ZGF0YQ==',
                            signer: PRIMARY_SIGNER,
                            domain: 'example.com',
                            authenticatorData: new Uint8Array([1, 2, 3]),
                        },
                        metadata: { scope: 1, encoding: 'base64' },
                    },
                    [REKEYED_SIGNER],
                ),
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'arc60' }),
            )
        })

        it('refuses a keyless rekeyed signer the dApp names directly', () => {
            // PRIMARY_SIGNER is authorized but holds no key of its own, and
            // its auth account cannot sign for it: an ARC-60 signature
            // verifies against the named signer's own key.
            mockAccounts = [
                {
                    address: PRIMARY_SIGNER,
                    canArc60: false,
                    rekeyAddress: REKEYED_SIGNER,
                },
                { address: REKEYED_SIGNER, canArc60: true },
            ]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry))

            const message = signDataMessage(
                {
                    type: 'arc60',
                    stdSigData: {
                        data: 'ZGF0YQ==',
                        signer: PRIMARY_SIGNER,
                        domain: 'example.com',
                        authenticatorData: new Uint8Array([1, 2, 3]),
                    },
                    metadata: { scope: 1, encoding: 'base64' },
                },
                [PRIMARY_SIGNER],
            )
            send(message)

            expect(message.reject).toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('responds with signatures in request order', async () => {
            mockAccounts = [
                { address: PRIMARY_SIGNER, canSignData: true },
                { address: REKEYED_SIGNER, canSignData: true },
            ]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry))

            const respond = vi.fn(async () => {})
            const message = {
                kind: 'request' as const,
                connectionId: 'c1',
                correlationId: '9',
                authorizedAccounts: [PRIMARY_SIGNER, REKEYED_SIGNER],
                peer: PEER,
                operation: {
                    type: 'sign-data' as const,
                    payload: [
                        {
                            data: 'ZGF0YQ==',
                            signer: PRIMARY_SIGNER,
                            chainId: 4160,
                        },
                        {
                            data: 'ZGF0YWJj',
                            signer: REKEYED_SIGNER,
                            chainId: 4160,
                        },
                    ],
                },
                respond,
                reject: vi.fn(async () => {}),
            }
            send(message)

            const signRequest = mockAddSignRequest.mock.calls.at(-1)?.[0]
            const sig1 = new Uint8Array([1, 1, 1])
            const sig2 = new Uint8Array([2, 2, 2])
            await signRequest.approve([
                { signer: PRIMARY_SIGNER, signature: sig1 },
                { signer: REKEYED_SIGNER, signature: sig2 },
            ])

            expect(respond).toHaveBeenCalledWith({
                type: 'sign-data',
                signatures: [sig1, sig2],
            })
        })

        it('propagates a delivery failure from respond', async () => {
            // Same retryable-failure property as sign-transactions:
            // `approve` must let a failed delivery reject back to the caller
            // rather than swallowing it.
            mockAccounts = [{ address: PRIMARY_SIGNER, canSignData: true }]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry))

            const respond = vi.fn(async () => {
                throw new Error('socket dead')
            })
            const message = {
                kind: 'request' as const,
                connectionId: 'c1',
                correlationId: '9',
                authorizedAccounts: [PRIMARY_SIGNER],
                peer: PEER,
                operation: {
                    type: 'sign-data' as const,
                    payload: [
                        {
                            data: 'ZGF0YQ==',
                            signer: PRIMARY_SIGNER,
                            chainId: 4160,
                        },
                    ],
                },
                respond,
                reject: vi.fn(async () => {}),
            }
            send(message)

            const signRequest = mockAddSignRequest.mock.calls.at(-1)?.[0]

            await expect(
                signRequest.approve([
                    { signer: PRIMARY_SIGNER, signature: new Uint8Array([9]) },
                ]),
            ).rejects.toThrow('socket dead')
        })
    })

    // The browser's approval window has no hook to mount: it reconstructs the
    // message and calls the function directly.
    it('enqueues through the pure function with explicit deps, no hook mounted', () => {
        const message = {
            kind: 'request' as const,
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: {
                type: 'sign-transactions' as const,
                group: [{ txn: 'b64' }],
            },
            respond: vi.fn(async () => {}),
            reject: vi.fn(async () => {}),
        }

        enqueueInboundRequest(message, {
            resolveArc0001: mockResolve,
            enqueueArc0001: mockEnqueue,
            addSignRequest: mockAddSignRequest,
            removeSignRequest: mockRemoveSignRequest,
            accounts: [],
        })

        expect(mockResolve).toHaveBeenCalledWith(expect.anything(), {
            authorizedAddresses: new Set(['AAAA']),
        })
        expect(mockEnqueue).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                transportId: 'c1',
                sourceMetadata: PEER,
            }),
        )
    })

    it('unsubscribes on unmount', () => {
        const { registry, isSubscribed } = makeRegistry()
        const { unmount } = renderHook(() =>
            useConnectionSigningAdapter(registry),
        )

        expect(isSubscribed()).toBe(true)
        unmount()
        expect(isSubscribed()).toBe(false)
    })
})
