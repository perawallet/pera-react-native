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

import { SignalClient } from './vendor/signalClient'
import { LiquidAuthSignalClient } from './signalClient'
import { runFidoCeremony, type CeremonyDeps } from './ceremony'
import { DEFAULT_ICE_SERVERS } from './constants'
import type {
    FidoCeremonyInput,
    FidoCeremonyResult,
    IceServerConfig,
    LiquidAuthService,
    SignalClientLike,
} from './types'

export type LiquidAuthServiceDeps = Omit<
    CeremonyDeps,
    'fetch' | 'signChallenge'
> & {
    /** Keystore-backed Ed25519 signer: provider.key.store.sign. */
    signChallenge: CeremonyDeps['signChallenge']
    fetch?: typeof fetch
    iceServers?: IceServerConfig[]
    /**
     * Reads the `connect.sid` session cookie from the native cookie jar for the
     * given origin. Native-coupled; injected so the service stays platform-free.
     */
    getSessionCookie?: (origin: string) => Promise<string | undefined>
}

/**
 * Stateless façade exposed as `provider.liquidAuth`. Builds transport clients
 * and runs the FIDO ceremony. Holds no session state — that lives in
 * `@perawallet/wallet-core-liquid-auth`'s stores.
 */
export class LiquidAuthServiceImpl implements LiquidAuthService {
    constructor(private readonly deps: LiquidAuthServiceDeps) {}

    createSignalClient(
        origin: string,
        cookie?: string,
    ): LiquidAuthSignalClient {
        const underlying = new SignalClient(origin, {
            extraHeaders: cookie ? { Cookie: cookie } : undefined,
            // socket.io only sends credentials (cookies) on the polling
            // handshake when withCredentials is set.
            withCredentials: true,
        }) as unknown as SignalClientLike
        const iceServers = this.deps.iceServers ?? DEFAULT_ICE_SERVERS
        return new LiquidAuthSignalClient(underlying, { iceServers })
    }

    getSessionCookie(origin: string): Promise<string | undefined> {
        return (
            this.deps.getSessionCookie?.(origin) ?? Promise.resolve(undefined)
        )
    }

    runCeremony(input: FidoCeremonyInput): Promise<FidoCeremonyResult> {
        return runFidoCeremony(input, {
            fetch: this.deps.fetch ?? globalThis.fetch,
            signChallenge: this.deps.signChallenge,
            getCredential: this.deps.getCredential,
            createCredential: this.deps.createCredential,
            hasCredentialForHost: this.deps.hasCredentialForHost,
        })
    }
}
