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

// In-memory replacement for `@perawallet/walletconnect`, whose relay socket
// jsdom can't service; aliased in via vitest.config.ts. Every instance is pushed
// into `walletConnectClientStub.instances` so a test can fire `session_request`
// the way the relay would.

import type { Optional } from '@perawallet/wallet-core-shared'

type Handler = (...args: unknown[]) => void

export type StubConnectorInstance = StubWalletConnect

export const walletConnectClientStub = {
    instances: [] as StubConnectorInstance[],
    nextClientId: 1,
    /** Reset between tests. */
    reset(): void {
        this.instances.length = 0
        this.nextClientId = 1
    },
    /** Most recent constructed connector — usually what the test wants. */
    last(): Optional<StubConnectorInstance> {
        return this.instances[this.instances.length - 1]
    },
}

class StubWalletConnect {
    clientId: string
    // The v1 handler snapshots these onto the persisted `Connection` and
    // `isWalletConnectV1Connection` refuses a record missing any of them, so a
    // stub without them cannot answer a single follow-up request.
    bridge = 'https://relay.example.test'
    peerId: string
    handshakeTopic: string
    connected = false
    // The subset of WC v1's `session` production reads (chainId via
    // `validateRequest`, accounts via signer resolution, peerMeta for identity).
    session: {
        permissions?: string[]
        chainId?: number
        accounts?: string[]
        peerMeta?: unknown
        key?: string
    } = { key: 'stub-session-key' }
    // The real client opens its SocketTransport in the constructor and
    // `ensureConnectorReady` fast-paths on `_transport.connected`, so the stub
    // models an immediately-open socket. Flip to false for a dead-socket test.
    _transport = { connected: true }
    handlers = new Map<string, Handler>()

    approveSessionCalls: { chainId: number; accounts: string[] }[] = []
    rejectSessionCalls = 0
    transportCloseCalls = 0
    killSessionCalls: { message?: string }[] = []
    rejectRequestCalls: { id?: number; error?: Error }[] = []
    approveRequestCalls: { id?: number; result?: unknown }[] = []

    constructor() {
        const index = walletConnectClientStub.nextClientId++
        this.clientId = `stub-client-${index}`
        this.peerId = `stub-peer-${index}`
        this.handshakeTopic = `stub-topic-${index}`
        walletConnectClientStub.instances.push(this)
    }

    on(event: string, cb: Handler): void {
        this.handlers.set(event, cb)
    }
    off(event: string): void {
        this.handlers.delete(event)
    }

    /** Simulates the relay pushing an event up; the real WC class has no such method. */
    fire(event: string, ...args: unknown[]): void {
        const handler = this.handlers.get(event)
        if (!handler) {
            throw new Error(
                `walletConnectClientStub: no handler registered for event "${event}"`,
            )
        }
        handler(...args)
    }

    approveSession(args: { chainId: number; accounts: string[] }): void {
        this.approveSessionCalls.push(args)
        // As in production, an approved session flips `connected = true`, which
        // `killSession` is gated on.
        this.connected = true
        // Sign-flow tests depend on `session.chainId` so `validateRequest`
        // doesn't reject with InvalidNetworkError.
        this.session = {
            ...this.session,
            chainId: args.chainId,
            accounts: args.accounts,
        }
    }
    rejectSession(): void {
        this.rejectSessionCalls += 1
        // The real SDK fires 'disconnect' synchronously from here and leaves
        // the socket open — the shape that made a declined pairing leak a
        // live connector, so the stub has to reproduce it.
        this.handlers.get('disconnect')?.(null, {
            event: 'disconnect',
            params: [{ message: 'Session Rejected' }],
        })
    }
    transportClose(): void {
        this.transportCloseCalls += 1
        this._transport.connected = false
    }
    async killSession(args?: { message?: string }): Promise<void> {
        this.killSessionCalls.push(args ?? {})
        this.connected = false
    }
    rejectRequest(args: { id?: number; error?: Error }): void {
        this.rejectRequestCalls.push(args)
    }
    approveRequest(args: { id?: number; result?: unknown }): void {
        this.approveRequestCalls.push(args)
    }
}

// Mirror @perawallet/walletconnect's default-export shape.
export default StubWalletConnect
