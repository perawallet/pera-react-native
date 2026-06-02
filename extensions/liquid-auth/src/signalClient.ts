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

import type {
    IceServerConfig,
    LiquidAuthDataChannel,
    SignalClientLike,
} from './types'
import { DEFAULT_HEARTBEAT_INTERVAL_MS } from './constants'

type MessageHandler = (data: string) => void
type CloseHandler = () => void

export type SignalClientOptions = {
    iceServers: IceServerConfig[]
    heartbeatMs?: number
}

/**
 * Wraps the vendored `SignalClient` (vendor/signalClient.ts): connects as the
 * answer peer, exposes a simple message/close API, and owns the heartbeat that
 * keeps the data channel alive.
 *
 * Liquid Auth dApps go idle after the FIDO handshake — the website already has
 * the wallet address from the server session and sends nothing over the data
 * channel until the user acts (e.g. taps "send funds"). So the channel must
 * survive arbitrarily long idle periods; the periodic heartbeat keeps it warm,
 * and real teardown is driven by the channel's own `onclose`/`onerror` (peer
 * gone / ICE failure) or an explicit `close()`. An inbound-traffic inactivity
 * timeout would otherwise tear down a perfectly healthy connection.
 */
export class LiquidAuthSignalClient {
    private channel: LiquidAuthDataChannel | null = null
    private messageHandler: MessageHandler | null = null
    private closeHandler: CloseHandler | null = null
    private heartbeat: ReturnType<typeof setInterval> | null = null
    /** Set by close() so a connect() in flight discards its late channel. */
    private closed = false

    constructor(
        private readonly underlying: SignalClientLike,
        private readonly options: SignalClientOptions,
    ) {}

    onMessage(handler: MessageHandler): void {
        this.messageHandler = handler
    }

    onClose(handler: CloseHandler): void {
        this.closeHandler = handler
    }

    async connect(requestId: string): Promise<void> {
        // Tear down any existing channel/timers without closing the underlying
        // client — it will be reused for the new connection.
        this.teardownChannel()
        this.closed = false
        this.underlying.authenticated = true
        const channel = await this.underlying.peer(requestId, 'answer', {
            iceServers: this.options.iceServers,
        })
        // The caller may have closed us while the handshake was in flight (e.g.
        // a connect-timeout race). Don't adopt the late channel — close it and
        // stay torn down, otherwise it (and its heartbeat) would leak.
        if (this.closed) {
            channel.close()
            return
        }
        this.channel = channel
        channel.onmessage = event => {
            this.messageHandler?.(event.data)
        }
        channel.onclose = () => this.handleClose()
        channel.onerror = () => this.handleClose()
        this.startHeartbeat()
    }

    send(data: string): void {
        this.channel?.send(data)
    }

    close(): void {
        this.closed = true
        this.teardownChannel()
        this.underlying.close()
    }

    private startHeartbeat(): void {
        const interval =
            this.options.heartbeatMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
        // Periodic no-op keepalive so the data channel survives long idle
        // periods (the dApp sends nothing until the user acts). Guarded: between
        // ICE failure and the onclose event the channel may not be 'open', and
        // RTCDataChannel.send throws InvalidStateError on a non-open channel.
        this.heartbeat = setInterval(() => {
            const channel = this.channel
            if (!channel || channel.readyState !== 'open') return
            try {
                channel.send('')
            } catch {
                // Channel raced into a non-open state; onclose/onerror handles
                // the real teardown.
            }
        }, interval)
    }

    private stopTimers(): void {
        if (this.heartbeat) clearInterval(this.heartbeat)
        this.heartbeat = null
    }

    /** Stops timers and closes the current channel without touching `underlying`. */
    private teardownChannel(): void {
        this.stopTimers()
        this.channel?.close()
        this.channel = null
    }

    private handleClose(): void {
        this.teardownChannel()
        this.closeHandler?.()
    }
}
