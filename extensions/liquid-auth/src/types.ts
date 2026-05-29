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

import type { Extension } from '@algorandfoundation/wallet-provider'
import type { LiquidAuthSignalClient } from './signalClient'

/** Minimal data-channel surface the wallet consumes (subset of RTCDataChannel). */
export interface LiquidAuthDataChannel {
    send(data: string): void
    close(): void
    readyState: string
    onopen: (() => void) | null
    onclose: (() => void) | null
    onerror: ((event: unknown) => void) | null
    onmessage: ((event: { data: string }) => void) | null
}

export interface IceServerConfig {
    urls: string | string[]
    username?: string
    credential?: string
}

/**
 * Structural subset of the vendored `SignalClient` (vendor/signalClient.ts)
 * that LiquidAuthSignalClient consumes. Declared structurally so tests inject
 * a mock without the real WebRTC-backed client.
 */
export interface SignalClientLike {
    authenticated: boolean
    peer(
        requestId: string,
        type: 'offer' | 'answer',
        config: { iceServers: IceServerConfig[] },
    ): Promise<LiquidAuthDataChannel>
    close(): void
}

/** Factory the service uses to build a SignalClientLike for a given origin. */
export type SignalClientFactory = (
    origin: string,
    options: { extraHeaders?: Record<string, string> },
) => SignalClientLike

/** Signs arbitrary bytes with an Algorand account's Ed25519 key (keystore). */
export type ChallengeSigner = (
    keyId: string,
    challenge: Uint8Array,
) => Promise<Uint8Array>

export type FidoCeremonyInput = {
    origin: string
    requestId: string
    /** Algorand address being bound. */
    address: string
    /** Keystore key id whose Ed25519 key signs the FIDO challenge. */
    keyId: string
    deviceName: string
    /**
     * Credential id of a previously-registered passkey for this host+address.
     * When present, the ceremony asserts (reuses) it instead of attesting a new
     * one. The caller (package layer) supplies it from its persisted sessions;
     * omit on first connect to register a fresh credential.
     */
    credentialId?: string
}

export type FidoCeremonyResult = {
    credentialId: string
}

export interface LiquidAuthService {
    createSignalClient(origin: string, cookie?: string): LiquidAuthSignalClient
    runCeremony(input: FidoCeremonyInput): Promise<FidoCeremonyResult>
    /**
     * Reads the express-session cookie (`connect.sid`) the FIDO ceremony set in
     * the native cookie jar, formatted as a request header value
     * (`connect.sid=<value>`), or undefined if none is present. The signaling
     * socket must carry it so the server joins it to the dApp's session room.
     */
    getSessionCookie(origin: string): Promise<string | undefined>
}

/** Provider augmentation: the service is exposed at `provider.liquidAuth`. */
export type LiquidAuthExtension = {
    liquidAuth: LiquidAuthService
}

export type WithLiquidAuthExtension = Extension<LiquidAuthExtension>
