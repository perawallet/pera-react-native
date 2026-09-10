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

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import {
    CONNECTIONS_CONTROL_SCOPE,
    CONNECTIONS_REQUEST_SCOPE,
    type ConnectionApprovalRequest,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    installConnectionsApprovalRouter,
    installConnectionsHeartbeat,
    CONNECTIONS_HEARTBEAT_ALARM,
} from '../connections'

const OFFSCREEN_SENDER = {
    id: 'ext-id',
    url: 'chrome-extension://ext-id/offscreen.html',
}

const makeChromeMock = () => {
    const listeners: ((
        message: unknown,
        sender: unknown,
        sendResponse: (r: unknown) => void,
    ) => boolean | void)[] = []
    return {
        listeners,
        runtime: {
            id: 'ext-id',
            getURL: (path: string) => `chrome-extension://ext-id/${path}`,
            onMessage: {
                addListener: vi.fn(listener => listeners.push(listener)),
            },
            sendMessage: vi.fn().mockResolvedValue({ ok: true }),
        },
        deliver: (request: ConnectionApprovalRequest) =>
            listeners[0]?.(
                { scope: CONNECTIONS_REQUEST_SCOPE, request },
                OFFSCREEN_SENDER,
                () => {},
            ),
        // The listener's keep-alive return plus a promise for the reply, so a
        // test can assert WHEN the ack lands, not just that it eventually does.
        deliverAwaitingAck: (request: ConnectionApprovalRequest) => {
            let settle: (response: unknown) => void = () => {}
            const ack = new Promise<unknown>(resolve => {
                settle = resolve
            })
            const keepAlive = listeners[0]?.(
                { scope: CONNECTIONS_REQUEST_SCOPE, request },
                OFFSCREEN_SENDER,
                settle,
            )
            return { keepAlive, ack }
        },
    }
}

const PEER = {
    name: 'Dapp',
    url: 'https://dapp.example/app',
    icons: ['https://dapp.example/icon.png'],
}

const proposalRequest = (
    overrides: Partial<
        Extract<ConnectionApprovalRequest, { kind: 'connection-proposal' }>
    > = {},
): ConnectionApprovalRequest => ({
    kind: 'connection-proposal',
    proposalId: 'proposal-1',
    pairingId: 'pairing-1',
    connectionKind: 'walletconnect-v1',
    peer: PEER,
    requested: { networks: ['mainnet'], methods: ['algo_signTxn'] },
    expiresAt: 1000,
    ...overrides,
})

const signRequest = (): ConnectionApprovalRequest => ({
    kind: 'connection-request',
    connectionId: 'conn-1',
    correlationId: '9',
    operation: { type: 'sign-transactions', group: [{ txn: 'dHhu' }] },
    authorizedAccounts: ['AAAA'],
    peer: PEER,
})

const errorRequest = (): ConnectionApprovalRequest => ({
    kind: 'connection-error',
    reason: 'network-mismatch',
    pairingId: 'pairing-1',
    activeNetwork: 'mainnet',
})

describe('installConnectionsApprovalRouter', () => {
    let chromeMock: ReturnType<typeof makeChromeMock>
    let approvals: {
        openConnectionProposal: ReturnType<typeof vi.fn>
        openConnectionRequest: ReturnType<typeof vi.fn>
        openConnectionError: ReturnType<typeof vi.fn>
    }
    let ensureOffscreenDocumentLike: Mock<() => Promise<void>>

    beforeEach(() => {
        chromeMock = makeChromeMock()
        approvals = {
            openConnectionProposal: vi.fn().mockResolvedValue({
                approvedAddresses: ['AAAA'],
            }),
            openConnectionRequest: vi.fn().mockResolvedValue({
                result: { type: 'sign-transactions', signed: ['c3R4bg=='] },
            }),
            openConnectionError: vi.fn().mockResolvedValue(undefined),
        }
        ensureOffscreenDocumentLike = vi.fn(async () => {})
        installConnectionsApprovalRouter({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            approvals: approvals as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            chromeLike: chromeMock as any,
            ensureOffscreenDocumentLike,
        })
    })

    describe('connection-proposal', () => {
        it('opens the proposal surface keyed by proposal id with the peer-derived display origin', async () => {
            chromeMock.deliver(
                proposalRequest({
                    requesterOrigin: 'https://requester.example',
                }),
            )

            await vi.waitFor(() => {
                expect(approvals.openConnectionProposal).toHaveBeenCalledWith({
                    requestId: 'connection-proposal-proposal-1',
                    origin: 'https://dapp.example',
                    faviconUrl: 'https://dapp.example/icon.png',
                    proposalId: 'proposal-1',
                    connectionKind: 'walletconnect-v1',
                    peer: PEER,
                    requested: {
                        networks: ['mainnet'],
                        methods: ['algo_signTxn'],
                    },
                    expiresAt: 1000,
                    requesterOrigin: 'https://requester.example',
                })
            })
        })

        // Never defaulted from the peer url, which is the dApp's own forgeable claim.
        it('leaves requesterOrigin undefined when the request carries none', async () => {
            chromeMock.deliver(proposalRequest())

            await vi.waitFor(() => {
                expect(approvals.openConnectionProposal).toHaveBeenCalled()
            })
            const ctx = approvals.openConnectionProposal.mock.calls[0]?.[0] as {
                requesterOrigin?: string
            }
            expect(ctx.requesterOrigin).toBeUndefined()
        })

        it('posts approve-proposal with the approved addresses when the user approves', async () => {
            chromeMock.deliver(proposalRequest())

            await vi.waitFor(() => {
                expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                    scope: CONNECTIONS_CONTROL_SCOPE,
                    kind: 'approve-proposal',
                    proposalId: 'proposal-1',
                    accounts: ['AAAA'],
                })
            })
        })

        it('posts reject-proposal when the user declines', async () => {
            approvals.openConnectionProposal.mockResolvedValue(null)

            chromeMock.deliver(proposalRequest())

            await vi.waitFor(() => {
                expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                    scope: CONNECTIONS_CONTROL_SCOPE,
                    kind: 'reject-proposal',
                    proposalId: 'proposal-1',
                })
            })
        })

        // The decision window closed on the bridge ack, so a dropped host
        // reply reads to the user as a connection that succeeded.
        it('opens a delivery-failure notice when the host refuses the approval', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {})
            chromeMock.runtime.sendMessage.mockResolvedValue({
                ok: false,
                error: 'This connection request has expired',
            })

            chromeMock.deliver(proposalRequest())

            await vi.waitFor(() => {
                expect(approvals.openConnectionError).toHaveBeenCalledWith(
                    expect.objectContaining({
                        reason: 'delivery-failed',
                        origin: 'https://dapp.example',
                        peer: PEER,
                    }),
                )
            })
            errorSpy.mockRestore()
        })

        it('opens no notice when the host accepts the approval', async () => {
            chromeMock.deliver(proposalRequest())

            await vi.waitFor(() => {
                expect(chromeMock.runtime.sendMessage).toHaveBeenCalled()
            })
            await vi.waitFor(() => {
                expect(approvals.openConnectionError).not.toHaveBeenCalled()
            })
        })

        // Nothing else answers the peer when the window never opens.
        it('posts reject-proposal when the approval window fails to open', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {})
            approvals.openConnectionProposal.mockRejectedValueOnce(
                new Error('windows.create failed'),
            )

            expect(() => chromeMock.deliver(proposalRequest())).not.toThrow()

            await vi.waitFor(() => {
                expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        kind: 'reject-proposal',
                        proposalId: 'proposal-1',
                        reason: expect.any(String),
                    }),
                )
            })
            errorSpy.mockRestore()
        })
    })

    describe('connection-request', () => {
        it('opens the request surface keyed by connection and correlation id', async () => {
            chromeMock.deliver(signRequest())

            await vi.waitFor(() => {
                expect(approvals.openConnectionRequest).toHaveBeenCalledWith({
                    requestId: 'connection-request-conn-1-9',
                    origin: 'https://dapp.example',
                    faviconUrl: 'https://dapp.example/icon.png',
                    connectionId: 'conn-1',
                    correlationId: '9',
                    operation: {
                        type: 'sign-transactions',
                        group: [{ txn: 'dHhu' }],
                    },
                    authorizedAccounts: ['AAAA'],
                    peer: PEER,
                })
            })
        })

        it('posts the signed result back as a respond message', async () => {
            chromeMock.deliver(signRequest())

            await vi.waitFor(() => {
                expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
                    scope: CONNECTIONS_CONTROL_SCOPE,
                    kind: 'respond',
                    connectionId: 'conn-1',
                    correlationId: '9',
                    outcome: {
                        ok: true,
                        result: {
                            type: 'sign-transactions',
                            signed: ['c3R4bg=='],
                        },
                    },
                })
            })
        })

        it('posts a decline when the user rejects', async () => {
            approvals.openConnectionRequest.mockResolvedValue(null)

            chromeMock.deliver(signRequest())

            await vi.waitFor(() => {
                expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        kind: 'respond',
                        correlationId: '9',
                        outcome: { ok: false, message: 'Request declined' },
                    }),
                )
            })
        })

        it('opens a delivery-failure notice when the signed result cannot be delivered', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {})
            chromeMock.runtime.sendMessage.mockResolvedValue({
                ok: false,
                error: 'dead socket',
            })

            chromeMock.deliver(signRequest())

            await vi.waitFor(() => {
                expect(approvals.openConnectionError).toHaveBeenCalledWith(
                    expect.objectContaining({ reason: 'delivery-failed' }),
                )
            })
            errorSpy.mockRestore()
        })

        it('posts a decline when the approval window fails to open', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {})
            approvals.openConnectionRequest.mockRejectedValueOnce(
                new Error('windows.create failed'),
            )

            expect(() => chromeMock.deliver(signRequest())).not.toThrow()

            await vi.waitFor(() => {
                expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        kind: 'respond',
                        correlationId: '9',
                        outcome: expect.objectContaining({ ok: false }),
                    }),
                )
            })
            errorSpy.mockRestore()
        })
    })

    describe('connection-error', () => {
        it('opens the notification-only surface and sends NOTHING back to offscreen', async () => {
            chromeMock.deliver(errorRequest())

            await vi.waitFor(() => {
                expect(approvals.openConnectionError).toHaveBeenCalledWith({
                    requestId: 'connection-error-pairing-1',
                    origin: '',
                    faviconUrl: undefined,
                    reason: 'network-mismatch',
                    peer: undefined,
                    activeNetwork: 'mainnet',
                })
            })
            expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled()
            expect(approvals.openConnectionProposal).not.toHaveBeenCalled()
            expect(approvals.openConnectionRequest).not.toHaveBeenCalled()
        })

        it('generates a request id when the error has no pairing', async () => {
            chromeMock.deliver({
                kind: 'connection-error',
                reason: 'network-mismatch',
                activeNetwork: 'mainnet',
            })

            await vi.waitFor(() => {
                expect(approvals.openConnectionError).toHaveBeenCalledWith(
                    expect.objectContaining({
                        requestId:
                            expect.stringMatching(/^connection-error-.+/),
                    }),
                )
            })
        })
    })

    it('ignores a request from an untrusted sender', () => {
        chromeMock.listeners[0]?.(
            { scope: CONNECTIONS_REQUEST_SCOPE, request: signRequest() },
            { id: 'ext-id', url: 'https://dapp.example' },
            () => {},
        )

        expect(approvals.openConnectionRequest).not.toHaveBeenCalled()
    })

    it('ignores a message on another scope', () => {
        const result = chromeMock.listeners[0]?.(
            { scope: 'pera-db-control', kind: 'ensure-offscreen' },
            OFFSCREEN_SENDER,
            () => {},
        )

        expect(result).toBe(false)
        expect(approvals.openConnectionRequest).not.toHaveBeenCalled()
    })

    // The offscreen host awaits every send; an unanswered one reads as "no
    // surface will ever answer" and makes it refuse the peer itself.
    describe('acknowledgement contract', () => {
        it('acks a proposal on acceptance, without waiting for the decision', async () => {
            approvals.openConnectionProposal.mockReturnValue(
                new Promise(() => {}),
            )

            const { ack } = chromeMock.deliverAwaitingAck(proposalRequest())

            await expect(ack).resolves.toEqual({ ok: true })
        })

        it('acks a request on acceptance, without waiting for the decision', async () => {
            approvals.openConnectionRequest.mockReturnValue(
                new Promise(() => {}),
            )

            const { ack } = chromeMock.deliverAwaitingAck(signRequest())

            await expect(ack).resolves.toEqual({ ok: true })
        })

        // The error ack means dismissal: the host uses it to hold one notice open at a time.
        it('defers the error ack until the surface closes', async () => {
            let dismiss: () => void = () => {}
            approvals.openConnectionError.mockReturnValue(
                new Promise<void>(resolve => {
                    dismiss = resolve
                }),
            )

            const { keepAlive, ack } =
                chromeMock.deliverAwaitingAck(errorRequest())

            expect(keepAlive).toBe(true)
            let settled = false
            void ack.then(() => {
                settled = true
            })
            await Promise.resolve()
            expect(settled).toBe(false)

            dismiss()
            await expect(ack).resolves.toEqual({ ok: true })
        })

        it('acks the error even when the surface fails to open', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {})
            approvals.openConnectionError.mockRejectedValue(
                new Error('no window'),
            )

            const { ack } = chromeMock.deliverAwaitingAck(errorRequest())

            await expect(ack).resolves.toEqual({ ok: true })
            errorSpy.mockRestore()
        })
    })
})

// `alarms.create` REPLACES a same-named alarm and restarts its period, and
// the install runs on every service-worker wake, so an existing alarm must be left alone.
describe('installConnectionsHeartbeat', () => {
    const makeAlarmsChrome = (existing: unknown) => {
        const create = vi.fn(async () => {})
        const get = vi.fn(async () => existing)
        const clear = vi.fn(async () => true)
        return {
            create,
            get,
            clear,
            chromeLike: {
                alarms: { create, get, clear },
            } as unknown as typeof chrome,
        }
    }

    it('clears the WalletConnect-named alarm an upgraded install still carries', async () => {
        const { chromeLike, clear } = makeAlarmsChrome(undefined)

        installConnectionsHeartbeat({ chromeLike })
        await vi.waitFor(() => expect(clear).toHaveBeenCalledTimes(1))

        expect(clear).toHaveBeenCalledWith('pera-wc-heartbeat')
    })

    it('creates the alarm when none exists yet', async () => {
        const { chromeLike, create } = makeAlarmsChrome(undefined)

        installConnectionsHeartbeat({ chromeLike })
        await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1))

        expect(create).toHaveBeenCalledWith(
            CONNECTIONS_HEARTBEAT_ALARM,
            expect.objectContaining({ periodInMinutes: 1 }),
        )
    })

    it('leaves an existing alarm alone so its next firing is not postponed', async () => {
        const { chromeLike, get, create } = makeAlarmsChrome({
            name: CONNECTIONS_HEARTBEAT_ALARM,
        })

        installConnectionsHeartbeat({ chromeLike })
        await vi.waitFor(() => expect(get).toHaveBeenCalled())

        expect(create).not.toHaveBeenCalled()
    })
})
