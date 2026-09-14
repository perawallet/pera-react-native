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

export type ConnectionId = string

export type ConnectionKind =
    | 'walletconnect-v1'
    | 'walletconnect-v2'
    | (string & {})

export interface ConnectionPeer {
    name: string
    url?: string
    description?: string
    icons?: string[]
}

export type ConnectionOriginSource = 'external-browser' | 'in-app' | 'qr'

/**
 * Post-action sheets key off this: `'external-browser'` gets the "Return to the
 * dApp" hand-off, `'in-app'` suppresses the sheets (the dApp is right behind
 * them), `'qr'` keeps the plain sheet. On the base record because origin is kind-agnostic.
 */
export interface ConnectionOrigin {
    source: ConnectionOriginSource
    /** iOS wrapper's `browser=` hint; absent on Android (raw wc: intent). */
    browserName?: string
}

/**
 * Never holds secret material: a kind that needs one (v1's session key) stores
 * it in the keystore and references it by `secretRef`.
 */
export interface Connection {
    id: ConnectionId
    kind: ConnectionKind
    /** User-visible label; defaults to `peer.name`. */
    name: string
    peer: ConnectionPeer
    /** Addresses this connection is authorised to act for. */
    accounts: string[]
    /** Keystore `secret-key` entry id, when the kind requires one. */
    secretRef?: string
    status: 'active' | 'inactive'
    createdAt: number
    lastActiveAt: number
    /** Kind-specific data. Narrowed by consumers via the `kind` discriminant. */
    metadata?: Record<string, unknown>
    /** Recorded once at approval time; absent for a connection that predates it. */
    origin?: ConnectionOrigin
}

/** Minimal synchronous KV surface the store persists through. */
export interface ConnectionPersistence {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
    /** Reclaim append-log residue after removing a sensitive value. */
    trim?(): void
}

export interface ConnectionStoreAPI {
    list(): Promise<Connection[]>
    get(id: ConnectionId): Promise<Connection | undefined>
    upsert(connection: Connection): Promise<void>
    remove(id: ConnectionId): Promise<void>
    clear(): Promise<void>
    /** Notified after every mutation. Returns an unsubscribe function. */
    subscribe(listener: (connections: Connection[]) => void): () => void
}

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item === 'string')

/** Persisted records can be stale or half-migrated, so every read validates. */
export const isConnection = (value: unknown): value is Connection => {
    if (value === null || typeof value !== 'object') return false
    const c = value as Record<string, unknown>
    return (
        typeof c.id === 'string' &&
        typeof c.kind === 'string' &&
        typeof c.name === 'string' &&
        typeof c.peer === 'object' &&
        c.peer !== null &&
        typeof (c.peer as Record<string, unknown>).name === 'string' &&
        isStringArray(c.accounts) &&
        (c.status === 'active' || c.status === 'inactive') &&
        typeof c.createdAt === 'number' &&
        typeof c.lastActiveAt === 'number'
    )
}
