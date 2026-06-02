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

import { afterEach, describe, it, expect, vi } from 'vitest'
import { LiquidAuthSignalClient } from '../signalClient'
import type { LiquidAuthDataChannel, SignalClientLike } from '../types'

const makeChannel = (): LiquidAuthDataChannel => ({
    send: vi.fn(),
    close: vi.fn(),
    readyState: 'open',
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
})

const makeUnderlying = (channel: LiquidAuthDataChannel): SignalClientLike => ({
    authenticated: false,
    peer: vi.fn().mockResolvedValue(channel),
    close: vi.fn(),
})

describe('LiquidAuthSignalClient', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('connects as the answer peer and routes inbound messages to the handler', async () => {
        const channel = makeChannel()
        const underlying = makeUnderlying(channel)
        const client = new LiquidAuthSignalClient(underlying, {
            iceServers: [{ urls: 'stun:example:1' }],
        })

        const onMessage = vi.fn()
        client.onMessage(onMessage)
        await client.connect('req-1')

        expect(underlying.authenticated).toBe(true)
        expect(underlying.peer).toHaveBeenCalledWith('req-1', 'answer', {
            iceServers: [{ urls: 'stun:example:1' }],
        })

        channel.onmessage?.({ data: 'hello' })
        expect(onMessage).toHaveBeenCalledWith('hello')
    })

    it('send() forwards to the open channel', async () => {
        const channel = makeChannel()
        const client = new LiquidAuthSignalClient(makeUnderlying(channel), {
            iceServers: [],
        })
        await client.connect('req-2')
        client.send('ping')
        expect(channel.send).toHaveBeenCalledWith('ping')
    })

    it('close() tears down channel and underlying client', async () => {
        const channel = makeChannel()
        const underlying = makeUnderlying(channel)
        const client = new LiquidAuthSignalClient(underlying, {
            iceServers: [],
        })
        await client.connect('req-3')
        client.close()
        expect(channel.close).toHaveBeenCalled()
        expect(underlying.close).toHaveBeenCalled()
    })

    it('connect() is idempotent: calling it twice closes the first channel before activating the second', async () => {
        const channelA = makeChannel()
        const channelB = makeChannel()
        const underlying: SignalClientLike = {
            authenticated: false,
            peer: vi
                .fn()
                .mockResolvedValueOnce(channelA)
                .mockResolvedValueOnce(channelB),
            close: vi.fn(),
        }
        const client = new LiquidAuthSignalClient(underlying, {
            iceServers: [],
            heartbeatMs: 60_000,
        })

        await client.connect('req-a')
        // channelA is now active; channelB has not been touched yet
        expect(channelA.close).not.toHaveBeenCalled()

        await client.connect('req-b')
        // channelA must have been torn down before channelB became active
        expect(channelA.close).toHaveBeenCalled()
        // underlying.close must NOT have been called — only the channel was torn down
        expect(underlying.close).not.toHaveBeenCalled()
        // channelB is now the active channel
        client.send('ping')
        expect(channelB.send).toHaveBeenCalledWith('ping')
    })

    it('keeps an idle channel alive: never auto-closes on inactivity, and heartbeats the channel', async () => {
        vi.useFakeTimers()
        const channel = makeChannel()
        const underlying = makeUnderlying(channel)
        const client = new LiquidAuthSignalClient(underlying, {
            iceServers: [],
            heartbeatMs: 1_000,
        })

        await client.connect('req-idle')
        // No inbound traffic for a long time — an idle-but-alive channel must
        // survive (the dApp is waiting on the user, not the wallet).
        vi.advanceTimersByTime(5 * 60_000)

        expect(channel.close).not.toHaveBeenCalled()
        expect(underlying.close).not.toHaveBeenCalled()
        // Heartbeat keepalive fired on the channel.
        expect(channel.send).toHaveBeenCalledWith('')
    })

    it('does not heartbeat a non-open channel (avoids InvalidStateError)', async () => {
        vi.useFakeTimers()
        const channel = makeChannel()
        const underlying = makeUnderlying(channel)
        const client = new LiquidAuthSignalClient(underlying, {
            iceServers: [],
            heartbeatMs: 1_000,
        })
        await client.connect('req-hb')

        // The channel races into a non-open state (ICE failure) before its
        // onclose fires — the heartbeat must skip the send rather than throw.
        channel.readyState = 'closing'
        expect(() => vi.advanceTimersByTime(2_000)).not.toThrow()
        expect(channel.send).not.toHaveBeenCalled()
    })

    it('discards a channel that resolves after close() (connect-timeout race)', async () => {
        // connect() is in flight; the caller closes (e.g. connect timeout)
        // before peer() resolves. The late channel must be closed, not adopted
        // (which would leak it and its heartbeat).
        const channel = makeChannel()
        let resolvePeer: (c: LiquidAuthDataChannel) => void = () => {}
        const underlying: SignalClientLike = {
            authenticated: false,
            peer: vi.fn().mockReturnValue(
                new Promise<LiquidAuthDataChannel>(res => {
                    resolvePeer = res
                }),
            ),
            close: vi.fn(),
        }
        const client = new LiquidAuthSignalClient(underlying, {
            iceServers: [],
        })

        const connecting = client.connect('req-race')
        client.close()
        resolvePeer(channel)
        await connecting

        expect(channel.close).toHaveBeenCalled()
        // The late channel is not adopted, so send() is a no-op on it.
        client.send('ping')
        expect(channel.send).not.toHaveBeenCalled()
    })

    it('tears down when the channel closes, notifying the close handler', async () => {
        const channel = makeChannel()
        const underlying = makeUnderlying(channel)
        const client = new LiquidAuthSignalClient(underlying, {
            iceServers: [],
        })
        const onClose = vi.fn()
        client.onClose(onClose)
        await client.connect('req-close')

        channel.onclose?.()

        expect(onClose).toHaveBeenCalled()
        // Channel close is peer-driven teardown — it must not close the
        // underlying signaling client (reused for reconnects).
        expect(underlying.close).not.toHaveBeenCalled()
    })
})
