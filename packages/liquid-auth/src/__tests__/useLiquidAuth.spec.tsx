/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const sentMessages: string[] = []
let inboundHandler: ((data: string) => void) | null = null

const autoApprove = vi.fn(async () => true)

const signalClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn((cb: (d: string) => void) => {
        inboundHandler = cb
    }),
    onClose: vi.fn(),
    send: vi.fn((data: string) => sentMessages.push(data)),
    close: vi.fn(),
}
const service = {
    createSignalClient: vi.fn(() => signalClient),
    runCeremony: vi.fn().mockResolvedValue({ credentialId: 'cred-1' }),
    getSessionCookie: vi.fn().mockResolvedValue('connect.sid=abc'),
}

vi.mock('../hooks/getLiquidAuthService', () => ({
    getLiquidAuthService: () => service,
}))
vi.mock('@perawallet/wallet-core-signing', () => ({
    useArc0001Resolver: () => vi.fn(),
    useEnqueueArc0001SignRequest:
        () =>
        (
            _resolved: unknown,
            transport: { respondWithResult: (r: unknown) => void },
        ) =>
            transport.respondWithResult(['WCSIGNED']),
}))
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: Object.assign(
        () => [{ address: 'ADDR1', keyPairId: 'key-1', type: 'hd-wallet' }],
        {
            getState: () => ({
                accounts: [
                    { address: 'ADDR1', keyPairId: 'key-1', type: 'hd-wallet' },
                ],
            }),
        },
    ),
}))

import { useLiquidAuth, type UseLiquidAuthConfig } from '../hooks/useLiquidAuth'
import { useLiquidAuthRegistryStore } from '../store/registryStore'
import { useLiquidAuthStore } from '../store/store'
import {
    encodeFrame,
    decodeFrame,
} from '@perawallet/wallet-extension-liquid-auth'

const makeConfig = (
    overrides: Partial<UseLiquidAuthConfig> = {},
): UseLiquidAuthConfig => ({
    providerId: 'pera',
    name: 'Pera',
    networks: [{ genesisHash: 'gh', genesisId: 'mainnet-v1.0' }],
    enqueueArc60: vi.fn(),
    submitSignedTxns: vi.fn(),
    ...overrides,
})

/** Minimal negotiate offer — fires `onIdentity` immediately so the identity
 *  wait resolves without the 5-second fallback timer. */
const minimalOffer = JSON.stringify({
    id: 'auto',
    reference: 'liquidauth:negotiate:offer',
    params: {
        handshakeVersion: 1,
        protocols: [{ id: 'arc0027', versions: ['1.0'] }],
    },
})

describe('useLiquidAuth', () => {
    beforeEach(() => {
        sentMessages.length = 0
        inboundHandler = null
        vi.clearAllMocks()
        autoApprove.mockClear()
        vi.useRealTimers()
        useLiquidAuthStore.getState().resetState()
    })

    it('connect runs the ceremony, opens the channel, and answers discover', async () => {
        const { result } = renderHook(() => useLiquidAuth(makeConfig()))
        await act(async () => {
            const p = result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'ADDR1',
                requestConfirmation: autoApprove,
            })
            // Flush microtasks so onMessage is registered and transport resolves,
            // then fire the offer to unblock the identity wait immediately.
            await Promise.resolve()
            await Promise.resolve()
            inboundHandler?.(minimalOffer)
            await p
        })
        expect(service.runCeremony).toHaveBeenCalledWith(
            expect.objectContaining({
                origin: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'ADDR1',
                keyId: 'key-1',
            }),
        )
        // The session cookie captured after the ceremony is threaded into the
        // signaling client so the server joins it to the dApp's session room.
        expect(service.getSessionCookie).toHaveBeenCalledWith(
            'https://debug.liquidauth.com',
        )
        expect(service.createSignalClient).toHaveBeenCalledWith(
            'https://debug.liquidauth.com',
            'connect.sid=abc',
        )
        expect(signalClient.connect).toHaveBeenCalledWith('req-1')
        // Transport up => the connection is established: the session is persisted.
        const { sessions } = useLiquidAuthStore.getState()
        expect(sessions).toHaveLength(1)
        expect(sessions[0]).toMatchObject({
            sessionId: 'req-1',
            host: 'https://debug.liquidauth.com',
            accounts: ['ADDR1'],
            credentialId: 'cred-1',
        })

        await act(async () => {
            inboundHandler?.(
                encodeFrame({
                    id: 'd1',
                    reference: 'arc0027:discover:request',
                }),
            )
            await Promise.resolve()
        })
        const response = decodeFrame(sentMessages.at(-1) as string) as Record<
            string,
            unknown
        >
        expect(response).toMatchObject({
            reference: 'arc0027:discover:response',
            requestId: 'd1',
        })
    })

    it('times out a stalled transport, closes the client, and rejects', async () => {
        vi.useFakeTimers()
        // client.connect never resolves — simulate a stalled WebRTC handshake.
        signalClient.connect.mockReturnValueOnce(new Promise<void>(() => {}))

        const { result } = renderHook(() => useLiquidAuth(makeConfig()))

        let connectPromise: Promise<void> = Promise.resolve()
        await act(async () => {
            connectPromise = result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-stall',
                address: 'ADDR1',
                requestConfirmation: autoApprove,
            })
        })

        const assertion = expect(connectPromise).rejects.toThrow(
            'The dApp did not respond. Please try again.',
        )

        await act(async () => {
            await vi.advanceTimersByTimeAsync(30_000)
        })
        await assertion

        expect(signalClient.close).toHaveBeenCalledTimes(1)
        expect(
            useLiquidAuthRegistryStore.getState().clients['req-stall'],
        ).toBeUndefined()

        vi.useRealTimers()
    })

    it('closes the signal client and does not register it when connect rejects', async () => {
        signalClient.connect.mockRejectedValueOnce(new Error('signaling down'))

        const { result } = renderHook(() => useLiquidAuth(makeConfig()))

        await act(async () => {
            await expect(
                result.current.connect({
                    host: 'https://debug.liquidauth.com',
                    requestId: 'req-fail',
                    address: 'ADDR1',
                    requestConfirmation: autoApprove,
                }),
            ).rejects.toThrow('signaling down')
        })

        expect(signalClient.close).toHaveBeenCalledTimes(1)
        expect(
            useLiquidAuthRegistryStore.getState().clients['req-fail'],
        ).toBeUndefined()
    })

    it('answers enable with the FIDO-bound account without a second approval', async () => {
        const { result } = renderHook(() => useLiquidAuth(makeConfig()))

        await act(async () => {
            const p = result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'ADDR1',
                requestConfirmation: autoApprove,
            })
            await Promise.resolve()
            await Promise.resolve()
            inboundHandler?.(minimalOffer)
            await p
        })

        await act(async () => {
            inboundHandler?.(
                encodeFrame({
                    id: 'e1',
                    reference: 'arc0027:enable:request',
                }),
            )
            await Promise.resolve()
            await Promise.resolve()
        })

        const response = decodeFrame(sentMessages.at(-1) as string) as {
            reference: string
            requestId: string
            result: { accounts: { address: string }[] }
        }
        expect(response).toMatchObject({
            reference: 'arc0027:enable:response',
            requestId: 'e1',
        })
        expect(response.result.accounts).toContainEqual({ address: 'ADDR1' })
    })

    it('reuses a persisted passkey on reconnect: asserts the stored credentialId and keeps one session', async () => {
        const { result } = renderHook(() => useLiquidAuth(makeConfig()))

        // First connect: no prior credential => attestation (no credentialId in).
        await act(async () => {
            const p = result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'ADDR1',
                requestConfirmation: autoApprove,
            })
            await Promise.resolve()
            await Promise.resolve()
            inboundHandler?.(minimalOffer)
            await p
        })
        expect(service.runCeremony).toHaveBeenLastCalledWith(
            expect.objectContaining({ credentialId: undefined }),
        )

        // Reconnect (new requestId): the persisted credentialId is reused, and
        // the session list stays at one entry (keyed by host+account).
        await act(async () => {
            const p = result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-2',
                address: 'ADDR1',
                requestConfirmation: autoApprove,
            })
            await Promise.resolve()
            await Promise.resolve()
            inboundHandler?.(minimalOffer)
            await p
        })
        expect(service.runCeremony).toHaveBeenLastCalledWith(
            expect.objectContaining({ credentialId: 'cred-1' }),
        )
        expect(useLiquidAuthStore.getState().sessions).toHaveLength(1)
    })

    it('negotiates arc0027 from an offer and replies with a select', async () => {
        const { result } = renderHook(() => useLiquidAuth(makeConfig()))
        await act(async () => {
            const p = result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'ADDR1',
                requestConfirmation: autoApprove,
            })
            await Promise.resolve()
            await Promise.resolve()
            inboundHandler?.(
                JSON.stringify({
                    id: 'o1',
                    reference: 'liquidauth:negotiate:offer',
                    params: {
                        handshakeVersion: 1,
                        protocols: [{ id: 'arc0027', versions: ['1.0'] }],
                        peer: {
                            name: 'Tinyman',
                            origin: 'https://app.tinyman.org',
                        },
                    },
                }),
            )
            await p
        })

        const select = JSON.parse(sentMessages.at(-1) as string)
        expect(select).toMatchObject({
            reference: 'liquidauth:negotiate:select',
            requestId: 'o1',
            result: { protocol: { id: 'arc0027', version: '1.0' } },
        })
        // Identity is now persisted in peerMeta after confirmation.
        expect(useLiquidAuthStore.getState().sessions[0]?.peerMeta).toEqual({
            name: 'Tinyman',
            origin: 'https://app.tinyman.org',
        })
    })

    it('disconnect removes the session but keeps the durable credential (reconnect still reuses)', async () => {
        const { result } = renderHook(() => useLiquidAuth(makeConfig()))

        await act(async () => {
            const p = result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'ADDR1',
                requestConfirmation: autoApprove,
            })
            await Promise.resolve()
            await Promise.resolve()
            inboundHandler?.(minimalOffer)
            await p
        })
        expect(useLiquidAuthStore.getState().sessions).toHaveLength(1)
        expect(useLiquidAuthStore.getState().credentials).toHaveLength(1)

        act(() => result.current.disconnect('req-1'))
        // Session gone (leaves Connected Apps); credential record survives.
        expect(useLiquidAuthStore.getState().sessions).toHaveLength(0)
        expect(useLiquidAuthStore.getState().credentials).toHaveLength(1)

        await act(async () => {
            const p = result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-2',
                address: 'ADDR1',
                requestConfirmation: autoApprove,
            })
            await Promise.resolve()
            await Promise.resolve()
            inboundHandler?.(minimalOffer)
            await p
        })
        // Reuses the passkey despite the prior disconnect.
        expect(service.runCeremony).toHaveBeenLastCalledWith(
            expect.objectContaining({ credentialId: 'cred-1' }),
        )
    })

    it('persists the negotiated identity as peerMeta after the user confirms', async () => {
        const requestConfirmation = vi.fn(async () => true)
        const { result } = renderHook(() => useLiquidAuth(makeConfig()))
        await act(async () => {
            const p = result.current.connect({
                host: 'https://relay.example',
                requestId: 'req-id',
                address: 'ADDR1',
                requestConfirmation,
            })
            await Promise.resolve()
            await Promise.resolve()
            inboundHandler?.(
                JSON.stringify({
                    id: 'o1',
                    reference: 'liquidauth:negotiate:offer',
                    params: {
                        handshakeVersion: 1,
                        protocols: [{ id: 'arc0027', versions: ['1.0'] }],
                        peer: {
                            name: 'Tinyman',
                            origin: 'https://app.tinyman.org',
                        },
                    },
                }),
            )
            await p
        })
        expect(requestConfirmation).toHaveBeenCalledWith({
            name: 'Tinyman',
            origin: 'https://app.tinyman.org',
            verified: false,
        })
        const { sessions } = useLiquidAuthStore.getState()
        expect(sessions).toHaveLength(1)
        expect(sessions[0].peerMeta).toEqual({
            name: 'Tinyman',
            origin: 'https://app.tinyman.org',
        })
    })

    it('falls back to host-only identity when no negotiation offer arrives', async () => {
        vi.useFakeTimers()
        const requestConfirmation = vi.fn(async () => true)
        const { result } = renderHook(() => useLiquidAuth(makeConfig()))
        let connectPromise: Promise<void>
        await act(async () => {
            connectPromise = result.current.connect({
                host: 'https://relay.example',
                requestId: 'req-id',
                address: 'ADDR1',
                requestConfirmation,
            })
            await Promise.resolve()
            await vi.advanceTimersByTimeAsync(5000)
            await connectPromise
        })
        expect(requestConfirmation).toHaveBeenCalledWith({
            name: 'https://relay.example',
            origin: 'https://relay.example',
            verified: false,
        })
        vi.useRealTimers()
    })

    it('buffers operational requests until confirm, then dispatches them', async () => {
        const enqueueSpy = vi.fn()
        let approveResolve: (v: boolean) => void
        const requestConfirmation = vi.fn(
            () =>
                new Promise<boolean>(res => {
                    approveResolve = res
                }),
        )
        const { result } = renderHook(() =>
            useLiquidAuth(makeConfig({ enqueueArc60: enqueueSpy })),
        )
        const signReq = encodeFrame({
            id: 's1',
            reference: 'arc0027:sign_message:request',
            params: { message: 'hi', signer: 'ADDR1' },
        })
        // Start the connection. requestConfirmation blocks forever until we call
        // approveResolve, so p will not settle until we do. We drive the whole
        // sequence inside a single act to avoid unmount/re-render issues.
        const p = result.current.connect({
            host: 'https://relay.example',
            requestId: 'req-id',
            address: 'ADDR1',
            requestConfirmation,
        })
        // Flush: let client.connect tick and onMessage register.
        for (let i = 0; i < 5; i++) await Promise.resolve()
        // Fire the negotiation offer so the identity promise resolves and
        // requestConfirmation is called (setting approveResolve).
        inboundHandler?.(
            JSON.stringify({
                id: 'o1',
                reference: 'liquidauth:negotiate:offer',
                params: {
                    handshakeVersion: 1,
                    protocols: [{ id: 'arc0027', versions: ['1.0'] }],
                },
            }),
        )
        // Flush so Promise.race settles and requestConfirmation is invoked.
        for (let i = 0; i < 10; i++) await Promise.resolve()
        // Simulate an operational request arriving while still pre-confirm.
        inboundHandler?.(signReq)
        await Promise.resolve()
        // The handler must NOT have been called yet — the request is buffered.
        expect(enqueueSpy).not.toHaveBeenCalled()
        // Approve and wait for the connect flow to finish (buffered requests flushed).
        approveResolve!(true)
        await p
        // After confirm, the flushed sign_message handler must have been called.

        expect(enqueueSpy).toHaveBeenCalledTimes(1)
    })

    it('negotiates walletconnect and dispatches algo_signTxn after confirm', async () => {
        let approveResolve: (v: boolean) => void
        const requestConfirmation = vi.fn(
            () =>
                new Promise<boolean>(res => {
                    approveResolve = res
                }),
        )
        const { result } = renderHook(() => useLiquidAuth(makeConfig()))
        let p: Promise<void>
        await act(async () => {
            p = result.current.connect({
                host: 'https://relay.example',
                requestId: 'req-id',
                address: 'ADDR1',
                requestConfirmation,
            })
            // Flush microtasks so onMessage is registered and transport resolves.
            await Promise.resolve()
            await Promise.resolve()
            inboundHandler?.(
                JSON.stringify({
                    id: 'o1',
                    reference: 'liquidauth:negotiate:offer',
                    params: {
                        handshakeVersion: 1,
                        protocols: [{ id: 'walletconnect', versions: ['2.0'] }],
                    },
                }),
            )
            await Promise.resolve()
            inboundHandler?.(
                JSON.stringify({
                    id: 5,
                    jsonrpc: '2.0',
                    method: 'algo_signTxn',
                    params: [[{ txn: 'b64' }]],
                }),
            )
            await Promise.resolve()
        })
        // negotiator selected walletconnect
        const select = JSON.parse(sentMessages[0])
        expect(select).toMatchObject({
            reference: 'liquidauth:negotiate:select',
            result: { protocol: { id: 'walletconnect', version: '2.0' } },
        })
        // pre-confirm: no WC response for id 5 yet (buffered)
        const hasId5 = () =>
            sentMessages.some(m => {
                try {
                    return JSON.parse(m).id === 5
                } catch {
                    return false
                }
            })
        expect(hasId5()).toBe(false)
        await act(async () => {
            approveResolve!(true)
            await p
        })
        // after confirm: a WC JSON-RPC response for id 5 was sent
        const wcResponse = sentMessages
            .map(m => {
                try {
                    return JSON.parse(m)
                } catch {
                    return null
                }
            })
            .find(m => m?.id === 5)
        expect(wcResponse).toMatchObject({ jsonrpc: '2.0' })
    })

    it('closes the channel and persists nothing when the user rejects', async () => {
        const requestConfirmation = vi.fn(async () => false)
        const { result } = renderHook(() => useLiquidAuth(makeConfig()))
        await act(async () => {
            const p = result.current.connect({
                host: 'https://relay.example',
                requestId: 'req-id',
                address: 'ADDR1',
                requestConfirmation,
            })
            await Promise.resolve()
            await Promise.resolve()
            inboundHandler?.(
                JSON.stringify({
                    id: 'o1',
                    reference: 'liquidauth:negotiate:offer',
                    params: {
                        handshakeVersion: 1,
                        protocols: [{ id: 'arc0027', versions: ['1.0'] }],
                    },
                }),
            )
            await expect(p).rejects.toMatchObject({
                name: 'LiquidAuthRejectedError',
            })
        })
        expect(signalClient.close).toHaveBeenCalled()
        expect(useLiquidAuthStore.getState().sessions).toHaveLength(0)
    })
})
