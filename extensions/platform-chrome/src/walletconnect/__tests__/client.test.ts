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
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import {
    onPairOutcome,
    onWcControlMessage,
    sendPairOutcome,
    sendWcControlMessage,
} from '../client'

/**
 * Fire-and-forget dispatch for the cases where no listener is expected to
 * answer — a refused sender, an unrecognised shape, or the pair-outcome
 * broadcast. Chrome reports an unanswered send as a closed port, and these
 * tests are asserting handler delivery rather than the reply, so the
 * rejection is the expected condition and not the subject.
 */
const dispatch = (
    fake: ChromeFake,
    message: unknown,
    senderOverride?: { url: string },
): Promise<unknown> =>
    fake.chrome.runtime
        .sendMessage(message, senderOverride)
        .catch(() => undefined)

describe('sendWcControlMessage', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('stamps the control scope onto the message before sending it', async () => {
        const handler = vi.fn(() => true)
        onWcControlMessage(handler)

        await sendWcControlMessage({ kind: 'disconnect', clientId: 'abc' })

        expect(handler).toHaveBeenCalledWith({
            scope: 'pera-wc-control',
            kind: 'disconnect',
            clientId: 'abc',
        })
    })
})

describe('onWcControlMessage', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('never reaches the handler for an untrusted (content-script-shaped) sender', async () => {
        const handler = vi.fn(() => true)
        onWcControlMessage(handler)

        await dispatch(
            fake,
            { scope: 'pera-wc-control', kind: 'reconnect-all' },
            { url: 'https://dapp.example' },
        )

        expect(handler).not.toHaveBeenCalled()
    })

    it('forwards the message to the handler for a trusted extension-page sender', async () => {
        const handler = vi.fn(() => true)
        onWcControlMessage(handler)

        const message = { scope: 'pera-wc-control', kind: 'reconnect-all' }
        await fake.chrome.runtime.sendMessage(message, {
            url: 'chrome-extension://test-extension-id/popup.html',
        })

        expect(handler).toHaveBeenCalledWith(message)
    })

    it('always returns false to chrome so other onMessage listeners still see the traffic', () => {
        const handler = vi.fn(() => true)
        onWcControlMessage(handler)

        // The fake registers the raw listener; grab it to check its own
        // return value directly rather than through sendMessage's
        // keepAlive/consumed indirection.
        const [listener] = [...fake.messageListeners]
        const result = listener(
            { scope: 'pera-wc-control', kind: 'reconnect-all' },
            {
                id: 'test-extension-id',
                url: 'chrome-extension://test-extension-id/popup.html',
            },
            () => {},
        )
        expect(result).toBe(false)
    })

    it('stops forwarding to the handler once unsubscribed', () => {
        const handler = vi.fn(() => true)
        const unsubscribe = onWcControlMessage(handler)
        expect(fake.messageListeners.size).toBe(1)

        unsubscribe()

        expect(fake.messageListeners.size).toBe(0)
    })
})

describe('sendPairOutcome / onPairOutcome', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('stamps the pair-outcome scope onto the message before sending it', async () => {
        const handler = vi.fn()
        onPairOutcome(handler)

        await sendPairOutcome({
            correlationId: 'corr-1',
            outcome: { type: 'session' },
        })

        expect(handler).toHaveBeenCalledWith({
            scope: 'pera-wc-pair-outcome',
            correlationId: 'corr-1',
            outcome: { type: 'session' },
        })
    })

    it('reaches the handler for a trusted extension-page sender', async () => {
        const handler = vi.fn()
        onPairOutcome(handler)

        const message = {
            scope: 'pera-wc-pair-outcome',
            correlationId: 'corr-1',
            outcome: { type: 'error', reason: 'network-mismatch' },
        }
        await dispatch(fake, message, {
            url: 'chrome-extension://test-extension-id/popup.html',
        })

        expect(handler).toHaveBeenCalledWith(message)
    })

    // A content script shares chrome.runtime.onMessage with every extension
    // page. Without this gate, one could spoof a pair-outcome and fabricate
    // an error toast for a pairing attempt the wallet UI never made.
    it('never reaches the handler for an untrusted (content-script-shaped) sender', async () => {
        const handler = vi.fn()
        onPairOutcome(handler)

        await dispatch(
            fake,
            {
                scope: 'pera-wc-pair-outcome',
                correlationId: 'corr-1',
                outcome: { type: 'session' },
            },
            { url: 'https://dapp.example' },
        )

        expect(handler).not.toHaveBeenCalled()
    })

    it('ignores a message that is not pair-outcome-shaped even from a trusted sender', async () => {
        const handler = vi.fn()
        onPairOutcome(handler)

        await dispatch(
            fake,
            { scope: 'pera-wc-control', kind: 'reconnect-all' },
            { url: 'chrome-extension://test-extension-id/popup.html' },
        )

        expect(handler).not.toHaveBeenCalled()
    })

    it('stops forwarding to the handler once unsubscribed', () => {
        const handler = vi.fn()
        const unsubscribe = onPairOutcome(handler)
        expect(fake.messageListeners.size).toBe(1)

        unsubscribe()

        expect(fake.messageListeners.size).toBe(0)
    })
})
