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

import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'
import type {
    LiquidAuthNetwork,
    LiquidAuthSignalClient,
} from '@perawallet/wallet-extension-liquid-auth'

export type { LiquidAuthNetwork }

export type LiquidAuthPeerMeta = {
    name: string
    origin: string
    icon?: string
    url?: string
}

export type LiquidAuthSession = {
    sessionId: string
    requestId: string
    /** Signaling origin, e.g. https://debug.liquidauth.com */
    host: string
    peerMeta: LiquidAuthPeerMeta
    accounts: string[]
    genesisHash: string
    networks: LiquidAuthNetwork[]
    credentialId: string
    /** ms since epoch */
    createdAt: number
    /** ms since epoch */
    lastActiveAt: number
    /** ms time-to-live; session is swept once `lastActiveAt + ttl < now`. */
    ttl: number
}

/**
 * A scanned connection awaiting the user's pre-ceremony approval. Enqueued on
 * QR scan; the approval sheet reads it, the user picks an account, and approval
 * kicks off the FIDO ceremony. (Liquid Auth binds the address at the FIDO
 * layer, so consent must precede the ceremony — there is no ARC-0027 `enable`
 * handshake to gate on.)
 */
export type LiquidAuthConnectRequest = {
    host: string
    requestId: string
}

/**
 * A registered passkey for a host+account, persisted independently of sessions.
 * Outlives session deletion/expiry so reconnecting reuses the existing passkey
 * (asserts) instead of attesting a fresh one — otherwise the OS accumulates a
 * new passkey on every reconnect. The OS keychain + server credential are the
 * durable artifacts; this just records which credentialId to assert.
 */
export type LiquidAuthCredentialRecord = {
    host: string
    address: string
    credentialId: string
    /** ms since epoch */
    createdAt: number
}

export type LiquidAuthStore = BaseStoreState & {
    sessions: LiquidAuthSession[]
    credentials: LiquidAuthCredentialRecord[]
    connectRequest: Nullable<LiquidAuthConnectRequest>
    connectionError: Nullable<Error>
    setSessions: (sessions: LiquidAuthSession[]) => void
    /** Upserts the credential for its host+address (replaces any prior). */
    recordCredential: (record: LiquidAuthCredentialRecord) => void
    setConnectRequest: (request: Nullable<LiquidAuthConnectRequest>) => void
    setConnectionError: (error: Nullable<Error>) => void
    /** Removes sessions whose ttl has elapsed; returns nothing. */
    expireSessions: (now: number) => void
}

export type LiquidAuthRegistryStore = BaseStoreState & {
    clients: Record<string, LiquidAuthSignalClient>
    registerClient: (sessionId: string, client: LiquidAuthSignalClient) => void
    forgetClient: (sessionId: string) => void
}
