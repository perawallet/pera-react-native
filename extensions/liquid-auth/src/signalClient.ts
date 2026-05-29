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

import { logger } from '@perawallet/wallet-core-shared'
import type {
    IceServerConfig,
    LiquidAuthDataChannel,
    SignalClientLike,
} from './types'
import { DEFAULT_HEARTBEAT_INTERVAL_MS } from './constants'

/**
 * Diagnostic view onto the vendored emitter/socket surfaces (eventemitter3 +
 * socket.io). Not part of the structural `SignalClientLike` contract — present
 * only on the real client — so we access them via optional chaining and
 * tolerate test mocks that omit them.
 */
type DiagnosticUnderlying = {
    on?: (event: string, listener: (...args: unknown[]) => void) => void
    socket?: {
        id?: string
        on?: (event: string, listener: (...args: unknown[]) => void) => void
    }
}

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
        logger.info('[liquid-auth] signal: connect() called', { requestId })
        this.attachDiagnostics()
        this.underlying.authenticated = true
        const channel = await this.underlying.peer(requestId, 'answer', {
            iceServers: this.options.iceServers,
        })
        logger.info(
            '[liquid-auth] signal: peer() resolved — data channel open',
            { requestId },
        )
        this.channel = channel
        channel.onmessage = event => {
            logger.info('[liquid-auth] data channel message', {
                length: event.data?.length,
            })
            this.messageHandler?.(event.data)
        }
        channel.onclose = () => this.handleClose()
        channel.onerror = () => this.handleClose()
        this.startHeartbeat()
    }

    /**
     * Subscribes diagnostic listeners to the vendored emitter + raw socket so we
     * can trace signaling without modifying the vendored file. Optional chaining
     * guards both the real client (where these surfaces exist) and test mocks
     * (where they don't), so missing methods simply no-op.
     */
    private attachDiagnostics(): void {
        const u = this.underlying as unknown as DiagnosticUnderlying
        u.on?.('connect', (...args) =>
            logger.info('[liquid-auth] signal event: connect', {
                socketId: u.socket?.id,
                args: args.length,
            }),
        )
        u.on?.('disconnect', () =>
            logger.info('[liquid-auth] signal event: disconnect'),
        )
        u.on?.('link', () => logger.info('[liquid-auth] signal event: link'))
        u.on?.('link-message', (data: unknown) =>
            logger.info('[liquid-auth] signal event: link-message', { data }),
        )
        u.on?.('offer-description', (sdp: unknown) =>
            logger.info('[liquid-auth] signal event: offer-description', {
                length: typeof sdp === 'string' ? sdp.length : undefined,
            }),
        )
        u.on?.('answer-description', (sdp: unknown) =>
            logger.info('[liquid-auth] signal event: answer-description', {
                length: typeof sdp === 'string' ? sdp.length : undefined,
            }),
        )
        u.on?.('offer-candidate', () =>
            logger.info('[liquid-auth] signal event: offer-candidate', {
                received: true,
            }),
        )
        u.on?.('answer-candidate', () =>
            logger.info('[liquid-auth] signal event: answer-candidate', {
                received: true,
            }),
        )
        u.on?.('data-channel', () =>
            logger.info('[liquid-auth] signal event: data-channel', {
                message: 'data channel received',
            }),
        )
        u.on?.('signal', () =>
            logger.info('[liquid-auth] signal event: signal'),
        )
        u.socket?.on?.('connect', () =>
            logger.info('[liquid-auth] socket connected', {
                id: u.socket?.id,
            }),
        )
        u.socket?.on?.('connect_error', (err: unknown) =>
            logger.info('[liquid-auth] socket connect_error', {
                message: (err as Error)?.message,
            }),
        )
    }

    send(data: string): void {
        this.channel?.send(data)
    }

    close(): void {
        logger.info('[liquid-auth] signal: close()')
        this.teardownChannel()
        this.underlying.close()
    }

    private startHeartbeat(): void {
        const interval =
            this.options.heartbeatMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
        // Periodic no-op keepalive so the data channel survives long idle
        // periods (the dApp sends nothing until the user acts).
        this.heartbeat = setInterval(() => this.channel?.send(''), interval)
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
