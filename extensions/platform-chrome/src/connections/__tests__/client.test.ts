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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import {
    broadcastConnectionsEvent,
    onConnectionsControlMessage,
    onConnectionsEvent,
    sendConnectionApprovalRequest,
    sendConnectionsControlMessage,
} from '../client'
import {
    CONNECTIONS_CONTROL_SCOPE,
    CONNECTIONS_EVENT_SCOPE,
    CONNECTIONS_REQUEST_SCOPE,
    type ConnectionsEvent,
} from '../protocol'

const TRUSTED = { url: 'chrome-extension://test-extension-id/popup.html' }
const UNTRUSTED = { url: 'https://dapp.example' }

// Chrome reports an unanswered send as a closed port; these tests assert
// handler delivery, so the rejection is expected and not the subject.
// The fake's sender override is fixture-only and not on chrome's signature.
type FakeSendMessage = (
    message: unknown,
    senderOverride?: { url: string },
) => Promise<unknown>

const sendAs = (fake: ChromeFake): FakeSendMessage =>
    fake.chrome.runtime.sendMessage as unknown as FakeSendMessage

const dispatch = (
    fake: ChromeFake,
    message: unknown,
    senderOverride?: { url: string },
): Promise<unknown> =>
    sendAs(fake)(message, senderOverride).catch(() => undefined)

const PROPOSAL_EVENT: ConnectionsEvent = {
    kind: 'proposal',
    proposal: {
        kind: 'walletconnect-v1',
        proposalId: 'p1',
        pairingId: 'pair-1',
        peer: { name: 'dApp' },
        requested: { networks: ['mainnet'], methods: [] },
        expiresAt: 1,
    },
}

describe('sendConnectionsControlMessage', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('stamps the control scope and resolves with the handler result', async () => {
        const handler = vi.fn(() => ({
            ok: true as const,
            result: { pairingId: 'pair-1' },
        }))
        onConnectionsControlMessage(handler)

        const result = await sendConnectionsControlMessage({
            kind: 'pair',
            uri: 'wc:topic@1?bridge=b&key=00',
        })

        expect(result).toEqual({ pairingId: 'pair-1' })
        expect(handler).toHaveBeenCalledWith({
            scope: CONNECTIONS_CONTROL_SCOPE,
            kind: 'pair',
            uri: 'wc:topic@1?bridge=b&key=00',
        })
    })

    it('resolves undefined for a void-result command', async () => {
        onConnectionsControlMessage(() => ({ ok: true }))

        await expect(
            sendConnectionsControlMessage({
                kind: 'disconnect',
                connectionId: 'c1',
            }),
        ).resolves.toBeUndefined()
    })

    it('throws the host error when the handler answers { ok: false }', async () => {
        onConnectionsControlMessage(() => ({
            ok: false,
            error: 'No connection c1',
        }))

        await expect(
            sendConnectionsControlMessage({
                kind: 'disconnect',
                connectionId: 'c1',
            }),
        ).rejects.toThrow('No connection c1')
    })

    it('waits for an asynchronous handler answer', async () => {
        onConnectionsControlMessage(async () => {
            await Promise.resolve()
            return { ok: true, result: { pairingId: 'late' } }
        })

        await expect(
            sendConnectionsControlMessage({ kind: 'pair', uri: 'wc:x' }),
        ).resolves.toEqual({ pairingId: 'late' })
    })

    it('reports a rejected asynchronous handler as { ok: false }', async () => {
        onConnectionsControlMessage(async () => {
            throw new Error('handler exploded')
        })

        await expect(
            sendConnectionsControlMessage({ kind: 'reconnect-all' }),
        ).rejects.toThrow('handler exploded')
    })

    // The offscreen listener registers late in an async boot and the document
    // is recreated after a db-worker death. A send landing in that window is
    // unanswered but the command never executed, so it must retry.
    it('retries an unanswered send until the host appears', async () => {
        vi.useFakeTimers()
        const handler = vi.fn(() => ({ ok: true as const }))
        setTimeout(() => onConnectionsControlMessage(handler), 1000)

        const send = sendConnectionsControlMessage({ kind: 'reconnect-all' })
        await vi.advanceTimersByTimeAsync(3000)

        await expect(send).resolves.toBeUndefined()
        expect(handler).toHaveBeenCalledWith({
            scope: CONNECTIONS_CONTROL_SCOPE,
            kind: 'reconnect-all',
        })
    })

    it('gives up with the not-handled error once the ack budget is exhausted', async () => {
        vi.useFakeTimers()

        const send = sendConnectionsControlMessage({
            kind: 'disconnect',
            connectionId: 'c1',
        })
        const assertion = expect(send).rejects.toThrow(
            "Connections control message 'disconnect' was not handled",
        )
        await vi.advanceTimersByTimeAsync(10_000)

        await assertion
    })
})

describe('onConnectionsControlMessage', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('never reaches the handler for an untrusted (content-script-shaped) sender', async () => {
        const handler = vi.fn(() => ({ ok: true as const }))
        onConnectionsControlMessage(handler)

        await dispatch(
            fake,
            { scope: CONNECTIONS_CONTROL_SCOPE, kind: 'reconnect-all' },
            UNTRUSTED,
        )

        expect(handler).not.toHaveBeenCalled()
    })

    it('never reaches the handler for a malformed control message', async () => {
        const handler = vi.fn(() => ({ ok: true as const }))
        onConnectionsControlMessage(handler)

        await dispatch(
            fake,
            { scope: CONNECTIONS_CONTROL_SCOPE, kind: 'pair' },
            TRUSTED,
        )

        expect(handler).not.toHaveBeenCalled()
    })

    it('leaves a message the handler declines (null) unanswered', async () => {
        onConnectionsControlMessage(() => null)

        await expect(
            sendAs(fake)(
                { scope: CONNECTIONS_CONTROL_SCOPE, kind: 'reconnect-all' },
                TRUSTED,
            ),
        ).rejects.toThrow('The message port closed')
    })

    it('returns true to chrome only while an asynchronous answer is pending', () => {
        onConnectionsControlMessage(() => null)
        onConnectionsControlMessage(async () => ({ ok: true }))
        const [declining, asynchronous] = [...fake.messageListeners]
        const sender = {
            id: 'test-extension-id',
            url: 'chrome-extension://test-extension-id/popup.html',
        }
        const message = {
            scope: CONNECTIONS_CONTROL_SCOPE,
            kind: 'reconnect-all',
        }

        expect(declining(message, sender, () => {})).toBe(false)
        expect(asynchronous(message, sender, () => {})).toBe(true)
    })

    it('stops forwarding to the handler once unsubscribed', () => {
        const unsubscribe = onConnectionsControlMessage(() => ({ ok: true }))
        expect(fake.messageListeners.size).toBe(1)

        unsubscribe()

        expect(fake.messageListeners.size).toBe(0)
    })
})

describe('sendConnectionApprovalRequest', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('resolves once the router acks', async () => {
        fake.chrome.runtime.onMessage.addListener((message, _sender, reply) => {
            if (
                (message as { scope?: string }).scope !==
                CONNECTIONS_REQUEST_SCOPE
            )
                return false
            reply({ ok: true })
            return false
        })

        await expect(
            sendConnectionApprovalRequest({
                kind: 'connection-error',
                reason: 'network-mismatch',
                activeNetwork: 'mainnet',
            }),
        ).resolves.toBeUndefined()
    })

    it('throws when the router answers with anything but an ack', async () => {
        fake.chrome.runtime.onMessage.addListener(
            (_message, _sender, reply) => {
                reply({ ok: false })
                return false
            },
        )

        await expect(
            sendConnectionApprovalRequest({
                kind: 'connection-error',
                reason: 'network-mismatch',
                activeNetwork: 'mainnet',
            }),
        ).rejects.toThrow(
            "Connection approval request 'connection-error' was not acknowledged",
        )
    })
})

describe('broadcastConnectionsEvent / onConnectionsEvent', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('delivers the event to a subscriber', async () => {
        const handler = vi.fn()
        onConnectionsEvent(handler)

        await broadcastConnectionsEvent(PROPOSAL_EVENT)

        expect(handler).toHaveBeenCalledWith(PROPOSAL_EVENT)
    })

    it('resolves even when nobody is listening', async () => {
        await expect(
            broadcastConnectionsEvent(PROPOSAL_EVENT),
        ).resolves.toBeUndefined()
    })

    // A content script shares chrome.runtime.onMessage with every extension
    // page; without this gate one could fabricate a proposal or an error toast
    // for a pairing the wallet never made.
    it('never reaches the handler for an untrusted (content-script-shaped) sender', async () => {
        const handler = vi.fn()
        onConnectionsEvent(handler)

        await dispatch(
            fake,
            { scope: CONNECTIONS_EVENT_SCOPE, event: PROPOSAL_EVENT },
            UNTRUSTED,
        )

        expect(handler).not.toHaveBeenCalled()
    })

    it('ignores a message that is not event-shaped even from a trusted sender', async () => {
        const handler = vi.fn()
        onConnectionsEvent(handler)

        await dispatch(
            fake,
            { scope: CONNECTIONS_CONTROL_SCOPE, kind: 'reconnect-all' },
            TRUSTED,
        )
        await dispatch(
            fake,
            { scope: CONNECTIONS_EVENT_SCOPE, event: { kind: 'nope' } },
            TRUSTED,
        )

        expect(handler).not.toHaveBeenCalled()
    })

    it('stops forwarding to the handler once unsubscribed', () => {
        const unsubscribe = onConnectionsEvent(vi.fn())
        expect(fake.messageListeners.size).toBe(1)

        unsubscribe()

        expect(fake.messageListeners.size).toBe(0)
    })
})
