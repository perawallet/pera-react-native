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

// In-memory replacement for `@walletconnect/client` (WC v1).
//
// The real package opens a relay socket which jsdom can't service. The
// integration tests need only the surface that
// `packages/walletconnect/src/hooks/useWalletConnect.ts` calls into:
//
//   - `new WalletConnect(opts)` constructor
//   - `connector.on(event, cb)` / `off(event)` / `clientId` /
//     `connected` / `session`
//   - `connector.approveSession(...)` / `rejectSession()` /
//     `killSession(...)` / `rejectRequest(...)`
//
// Every `new WalletConnect()` instance is pushed into the exported
// `walletConnectClientStub.instances` registry so a test can grab it
// after the fact, fire `session_request` (or any other captured
// handler) the way the real relay would, and assert on
// `approveSession` / `rejectSession` calls.
//
// Aliased into the test build via `apps/mobile/vitest.config.ts`, so
// every consumer that imports `@walletconnect/client` ends up with
// this class instead of the production transport.

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
    last(): StubConnectorInstance | undefined {
        return this.instances[this.instances.length - 1]
    },
}

class StubWalletConnect {
    clientId: string
    connected = false
    session: { permissions?: string[] } = {}
    handlers = new Map<string, Handler>()

    approveSessionCalls: { chainId: number; accounts: string[] }[] = []
    rejectSessionCalls = 0
    killSessionCalls: { message?: string }[] = []
    rejectRequestCalls: { id?: number; error?: Error }[] = []

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
    }
    rejectSession(): void {
        this.rejectSessionCalls += 1
    }
    async killSession(args?: { message?: string }): Promise<void> {
        this.killSessionCalls.push(args ?? {})
    }
    rejectRequest(args: { id?: number; error?: Error }): void {
        this.rejectRequestCalls.push(args)
    }
}

// Mirror @walletconnect/client's default-export shape.
export default StubWalletConnect
