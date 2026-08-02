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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    WC_CONTROL_SCOPE,
    WC_REQUEST_SCOPE,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    installWcApprovalRouter,
    installWcHeartbeat,
    WC_HEARTBEAT_ALARM,
} from '../walletconnect'

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
            sendMessage: vi.fn().mockResolvedValue(undefined),
        },
        deliver: (message: unknown) =>
            listeners[0]?.(
                message,
                {
                    id: 'ext-id',
                    url: 'chrome-extension://ext-id/offscreen.html',
                },
                () => {},
            ),
        // Mirrors what the offscreen host actually observes: the listener's
        // keepAlive return plus a promise for the reply, so a test can assert
        // *when* the ack lands, not just that it eventually does.
        deliverAwaitingAck: (message: unknown) => {
            let settle: (response: unknown) => void = () => {}
            const ack = new Promise<unknown>(resolve => {
                settle = resolve
            })
            const keepAlive = listeners[0]?.(
                message,
                {
                    id: 'ext-id',
                    url: 'chrome-extension://ext-id/offscreen.html',
                },
                settle,
            )
            return { keepAlive, ack }
        },
    }
}

describe('installWcApprovalRouter', () => {
    let chromeMock: ReturnType<typeof makeChromeMock>
    let approvals: {
        openWcConnect: ReturnType<typeof vi.fn>
        openWcSign: ReturnType<typeof vi.fn>
        openWcError: ReturnType<typeof vi.fn>
    }

    beforeEach(() => {
        chromeMock = makeChromeMock()
        approvals = {
            openWcConnect: vi.fn().mockResolvedValue({
                approvedAddresses: ['AAAA'],
            }),
            openWcSign: vi.fn().mockResolvedValue({ result: ['c3R4bg=='] }),
            openWcError: vi.fn().mockResolvedValue(undefined),
        }
        installWcApprovalRouter({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            approvals: approvals as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            chromeLike: chromeMock as any,
        })
    })

    it('opens a wc-sign approval and posts the signed result back to offscreen', async () => {
        chromeMock.deliver({
            scope: WC_REQUEST_SCOPE,
            request: {
                kind: 'wc-sign',
                clientId: 'client-1',
                wcRequestId: 9,
                method: 'algo_signTxn',
                payload: { id: 9, params: [[{ txn: 'dHhu' }]] },
                origin: 'https://dapp.example',
            },
        })

        await vi.waitFor(() => {
            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'deliver',
                    clientId: 'client-1',
                    wcRequestId: 9,
                    outcome: { ok: true, result: ['c3R4bg=='] },
                }),
            )
        })
    })

    it('opens the notification-only error surface and sends NOTHING back to offscreen', async () => {
        chromeMock.deliver({
            scope: WC_REQUEST_SCOPE,
            request: {
                kind: 'wc-error',
                clientId: 'client-1',
                reason: 'network-mismatch',
                origin: 'https://dapp.example',
                requestedChainId: 416_002,
                activeNetwork: 'mainnet',
            },
        })

        await vi.waitFor(() => {
            expect(approvals.openWcError).toHaveBeenCalledWith({
                requestId: 'wc-wc-error-client-1',
                origin: 'https://dapp.example',
                clientId: 'client-1',
                reason: 'network-mismatch',
                requestedChainId: 416_002,
                activeNetwork: 'mainnet',
            })
        })

        // The handshake was already answered by the host before this message
        // was ever sent, so routing a decision back would either double-answer
        // the peer or, worse, deliver against a request id that doesn't exist.
        expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled()
        expect(approvals.openWcConnect).not.toHaveBeenCalled()
        expect(approvals.openWcSign).not.toHaveBeenCalled()
    })

    it('posts a rejection when the user declines', async () => {
        approvals.openWcSign.mockResolvedValue(null)

        chromeMock.deliver({
            scope: WC_REQUEST_SCOPE,
            request: {
                kind: 'wc-sign',
                clientId: 'client-1',
                wcRequestId: 11,
                method: 'algo_signTxn',
                payload: { id: 11, params: [[{ txn: 'dHhu' }]] },
                origin: 'https://dapp.example',
            },
        })

        await vi.waitFor(() => {
            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: 'deliver',
                    wcRequestId: 11,
                    outcome: expect.objectContaining({ ok: false }),
                }),
            )
        })
    })

    it('ignores a request from an untrusted sender', () => {
        chromeMock.listeners[0]?.(
            {
                scope: WC_REQUEST_SCOPE,
                request: {
                    kind: 'wc-sign',
                    clientId: 'client-1',
                    wcRequestId: 12,
                    method: 'algo_signTxn',
                    payload: {},
                    origin: 'https://dapp.example',
                },
            },
            { id: 'ext-id', url: 'https://dapp.example' },
            () => {},
        )

        expect(approvals.openWcSign).not.toHaveBeenCalled()
    })

    it('posts approve-session with the approved addresses and chain id when the user approves a connect', async () => {
        chromeMock.deliver({
            scope: WC_REQUEST_SCOPE,
            request: {
                kind: 'wc-connect',
                clientId: 'client-2',
                chainId: 416_001,
                origin: 'https://dapp.example',
            },
        })

        await vi.waitFor(() => {
            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'approve-session',
                    clientId: 'client-2',
                    approvedAddresses: ['AAAA'],
                    chainId: 416_001,
                }),
            )
        })
    })

    // Without a .catch, a rejected openWcConnect (e.g. windows.create
    // refused for lack of a user gesture) would be an unhandled rejection
    // AND leave the offscreen host waiting forever on this clientId's
    // pendingConnectApprovals entry — nothing else ever answers it.
    it('rejects the session when opening the wc-connect approval window fails', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        approvals.openWcConnect.mockRejectedValueOnce(
            new Error('windows.create failed'),
        )

        expect(() =>
            chromeMock.deliver({
                scope: WC_REQUEST_SCOPE,
                request: {
                    kind: 'wc-connect',
                    clientId: 'client-4',
                    chainId: 416_001,
                    origin: 'https://dapp.example',
                },
            }),
        ).not.toThrow()

        await vi.waitFor(() => {
            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'reject-session',
                    clientId: 'client-4',
                }),
            )
        })
        errorSpy.mockRestore()
    })

    // Same reasoning as the wc-connect case above, for wc-sign: without a
    // .catch, the dApp's signing request would never be answered at all.
    it('posts a decline when opening the wc-sign approval window fails', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        approvals.openWcSign.mockRejectedValueOnce(
            new Error('windows.create failed'),
        )

        expect(() =>
            chromeMock.deliver({
                scope: WC_REQUEST_SCOPE,
                request: {
                    kind: 'wc-sign',
                    clientId: 'client-1',
                    wcRequestId: 13,
                    method: 'algo_signTxn',
                    payload: { id: 13, params: [[{ txn: 'dHhu' }]] },
                    origin: 'https://dapp.example',
                },
            }),
        ).not.toThrow()

        await vi.waitFor(() => {
            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: 'deliver',
                    wcRequestId: 13,
                    outcome: expect.objectContaining({ ok: false }),
                }),
            )
        })
        errorSpy.mockRestore()
    })

    it('forwards the verified requesterOrigin from the approval-request message to openWcConnect', async () => {
        chromeMock.deliver({
            scope: WC_REQUEST_SCOPE,
            request: {
                kind: 'wc-connect',
                clientId: 'client-5',
                chainId: 416_001,
                origin: 'https://dapp.example',
                requesterOrigin: 'https://requester.example',
            },
        })

        await vi.waitFor(() => {
            expect(approvals.openWcConnect).toHaveBeenCalledWith(
                expect.objectContaining({
                    clientId: 'client-5',
                    requesterOrigin: 'https://requester.example',
                }),
            )
        })
    })

    // An absent `requesterOrigin` must stay a clean `undefined` on the
    // forwarded call — never coerced to an empty string or defaulted from
    // `request.origin` (the dApp's own forgeable claim).
    it('leaves requesterOrigin undefined on openWcConnect when the approval-request message carries none', async () => {
        chromeMock.deliver({
            scope: WC_REQUEST_SCOPE,
            request: {
                kind: 'wc-connect',
                clientId: 'client-6',
                chainId: 416_001,
                origin: 'https://dapp.example',
            },
        })

        await vi.waitFor(() => {
            expect(approvals.openWcConnect).toHaveBeenCalledWith(
                expect.objectContaining({ clientId: 'client-6' }),
            )
        })

        const ctx = approvals.openWcConnect.mock.calls.find(
            ([c]) => (c as { clientId: string }).clientId === 'client-6',
        )?.[0] as { requesterOrigin?: string } | undefined
        expect(ctx?.requesterOrigin).toBeUndefined()
    })

    it('posts reject-session when the user declines a connect', async () => {
        approvals.openWcConnect.mockResolvedValue(null)

        chromeMock.deliver({
            scope: WC_REQUEST_SCOPE,
            request: {
                kind: 'wc-connect',
                clientId: 'client-3',
                chainId: 416_001,
                origin: 'https://dapp.example',
            },
        })

        await vi.waitFor(() => {
            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'reject-session',
                    clientId: 'client-3',
                }),
            )
        })
    })

    // The offscreen host `await`s every one of these sends. A listener that
    // never answers makes Chrome close the port, which fires the host's
    // "never reached a window" recovery path on requests that in fact
    // succeeded — dropping the session's permissions and defeating the
    // duplicate-request guard. So every branch must ack.
    describe('acknowledgement contract', () => {
        it('acks wc-connect on acceptance, without waiting for the decision', async () => {
            // Never settles: the decision must not gate the ack.
            approvals.openWcConnect.mockReturnValue(new Promise(() => {}))

            const { ack } = chromeMock.deliverAwaitingAck({
                scope: WC_REQUEST_SCOPE,
                request: {
                    kind: 'wc-connect',
                    clientId: 'client-ack',
                    chainId: 416_001,
                    origin: 'https://dapp.example',
                },
            })

            await expect(ack).resolves.toEqual({ ok: true })
        })

        it('acks wc-sign on acceptance, without waiting for the decision', async () => {
            approvals.openWcSign.mockReturnValue(new Promise(() => {}))

            const { ack } = chromeMock.deliverAwaitingAck({
                scope: WC_REQUEST_SCOPE,
                request: {
                    kind: 'wc-sign',
                    clientId: 'client-ack',
                    wcRequestId: 7,
                    method: 'algo_signTxn',
                    payload: [],
                    origin: 'https://dapp.example',
                },
            })

            await expect(ack).resolves.toEqual({ ok: true })
        })

        // wc-error is the one that acks *dismissal* instead: it carries no
        // decision, and the host awaits it purely to know the surface closed
        // so it can allow the next one. Acking early here is what let a
        // hostile page force an endless run of approval windows.
        it('defers the wc-error ack until the surface closes', async () => {
            let dismiss: () => void = () => {}
            approvals.openWcError.mockReturnValue(
                new Promise<void>(resolve => {
                    dismiss = resolve
                }),
            )

            const { keepAlive, ack } = chromeMock.deliverAwaitingAck({
                scope: WC_REQUEST_SCOPE,
                request: {
                    kind: 'wc-error',
                    clientId: 'client-err',
                    reason: 'network-mismatch',
                    origin: 'https://dapp.example',
                    activeNetwork: 'mainnet',
                },
            })

            // Must keep the port open, or Chrome closes it before dismissal.
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

        // A surface that failed to open is as closed as a dismissed one —
        // leaving the guard latched would block every later notice.
        it('acks wc-error even when the surface fails to open', async () => {
            approvals.openWcError.mockRejectedValue(new Error('no window'))

            const { ack } = chromeMock.deliverAwaitingAck({
                scope: WC_REQUEST_SCOPE,
                request: {
                    kind: 'wc-error',
                    clientId: 'client-err',
                    reason: 'network-mismatch',
                    origin: 'https://dapp.example',
                    activeNetwork: 'mainnet',
                },
            })

            await expect(ack).resolves.toEqual({ ok: true })
        })
    })
})

// `alarms.create` REPLACES a same-named alarm, resetting its period to a full
// interval from now — and installWcHeartbeat runs at module scope on every
// service-worker wake. Without the existence check, any page that wakes the
// worker more often than the period postpones the reconnect sweep forever, so
// a WalletConnect socket that died stayed dead.
describe('installWcHeartbeat', () => {
    const makeAlarmsChrome = (existing: unknown) => {
        const create = vi.fn(async () => {})
        const get = vi.fn(async () => existing)
        return {
            create,
            get,
            chromeLike: { alarms: { create, get } } as unknown as typeof chrome,
        }
    }

    it('creates the alarm when none exists yet', async () => {
        const { chromeLike, create } = makeAlarmsChrome(undefined)

        installWcHeartbeat({ chromeLike })
        await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1))

        expect(create).toHaveBeenCalledWith(
            WC_HEARTBEAT_ALARM,
            expect.objectContaining({ periodInMinutes: 1 }),
        )
    })

    it('leaves an existing alarm alone so its next firing is not postponed', async () => {
        const { chromeLike, get, create } = makeAlarmsChrome({
            name: WC_HEARTBEAT_ALARM,
        })

        installWcHeartbeat({ chromeLike })
        await vi.waitFor(() => expect(get).toHaveBeenCalled())

        expect(create).not.toHaveBeenCalled()
    })
})
