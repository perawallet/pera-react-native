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

// In-memory replacement for `@perawallet/walletconnect`, whose real relay
// socket jsdom can't service. Implements only the surface `useWalletConnect`
// calls into.
//
// Every instance is pushed into `walletConnectClientStub.instances` so a test
// can grab it, fire `session_request` the way the relay would, and assert on
// approveSession / rejectSession.
//
// Aliased in via vitest.config.ts, so every consumer gets this class.

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
    connected = false
    // Mirrors the subset of WC v1's `session` object that production
    // code reads — chainId is checked by `validateRequest` in the sign
    // handler, accounts by signer-resolution, peerMeta surfaces dApp
    // identity. Stays empty until approveSession populates it.
    session: {
        permissions?: string[]
        chainId?: number
        accounts?: string[]
        peerMeta?: unknown
    } = {}
    // The real WC v1 client opens its SocketTransport in the constructor;
    // `ensureConnectorReady` fast-paths on `_transport.connected`, so the
    // stub models an immediately-open socket. Tests that need a dead
    // socket can flip this to false.
    _transport = { connected: true }
    handlers = new Map<string, Handler>()

    approveSessionCalls: { chainId: number; accounts: string[] }[] = []
    rejectSessionCalls = 0
    killSessionCalls: { message?: string }[] = []
    rejectRequestCalls: { id?: number; error?: Error }[] = []
    approveRequestCalls: { id?: number; result?: unknown }[] = []

    constructor() {
        this.clientId = `stub-client-${walletConnectClientStub.nextClientId++}`
        walletConnectClientStub.instances.push(this)
    }

    on(event: string, cb: Handler): void {
        this.handlers.set(event, cb)
    }
    off(event: string): void {
        this.handlers.delete(event)
    }

    /**
     * Test helper — invoke a registered handler to simulate the relay
     * pushing an event up. Production callers never see this method
     * (the real WC class doesn't expose it); tests use it to drive
     * `session_request`, `algo_signTxn`, etc.
     */
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
        // Match production semantics: a successfully approved session
        // flips the connector to `connected = true`. `useWalletConnect.disconnect`
        // gates `killSession` on this flag, so tests that pair → disconnect
        // need it to be true after approval.
        this.connected = true
        // Populate the same session fields production WC fills in after
        // a successful relay handshake. Sign-flow tests (`wc-sign.test.tsx`)
        // depend on `session.chainId` being set so `validateRequest` in
        // the sign handler doesn't reject with InvalidNetworkError.
        this.session = {
            ...this.session,
            chainId: args.chainId,
            accounts: args.accounts,
        }
    }
    rejectSession(): void {
        this.rejectSessionCalls += 1
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
