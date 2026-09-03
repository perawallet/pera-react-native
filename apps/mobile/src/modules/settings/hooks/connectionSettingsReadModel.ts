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

import type { Network } from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionId,
    ConnectionKind,
    ConnectionPeer,
} from '@perawallet/wallet-extension-connections'

/**
 * Settings-screen read model for one `Connection` record — the
 * abstraction-native counterpart to `connectionsSettingsHelpers.ts`'s
 * `UnifiedConnection`, sourced from `useConnectionsStore` instead of
 * `useWalletConnect`. Kind-agnostic by design: v1 WalletConnect is the only
 * registered handler today, but nothing here assumes that.
 *
 * `createdAt`/`lastActiveAt` are plain epoch-ms `number`s, straight off
 * `Connection`. Unlike `WalletConnectConnection.createdAt` — persisted via
 * `createJSONStorage` with no reviver, so a rehydrated record carries an
 * ISO *string* at runtime despite its `Date` type — `Connection`'s
 * timestamps are always `number`. There is no Date/string rehydration
 * hazard here to guard against, so this deliberately does not carry over
 * `connectionsSettingsHelpers.ts`'s `toComparableTime`.
 */
export type ConnectionSettingsRow = {
    id: ConnectionId
    kind: ConnectionKind
    /** User-visible label; `Connection.name` already defaults to `peer.name`. */
    title: string
    subtitle: string
    iconUrl?: string
    accounts: string[]
    isConnected: boolean
    createdAt: number
    lastActiveAt: number
    /**
     * The peer as approved. Carried whole (not flattened to `title`/
     * `iconUrl`) because the detail screen shows the description and picks
     * its own icon out of the full list — the list row's single `iconUrl` is
     * not the same choice.
     */
    peer: ConnectionPeer
    /** Methods the session was approved for; empty when the record predates the field. */
    permissions: string[]
    /** Every network the connection is usable on, as its handler resolves it. */
    networks: Network[]
    /** Protocol version behind the `WCV…` badge; absent for a kind with none. */
    protocolVersion?: number
}

const readStringArray = (
    source: Record<string, unknown>,
    key: string,
): string[] => {
    const value = source[key]
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string')
}

// `Connection.metadata` is kind-specific, so the one field surfaced here is
// read defensively; a record another handler wrote simply reports none.
const readPermissions = (connection: Connection): string[] => {
    const metadata = connection.metadata
    if (typeof metadata !== 'object' || metadata === null) return []
    return readStringArray(metadata, 'permissions')
}

/** The `WCV1` / `WCV2` badge the settings screens have always shown. */
const protocolVersionFor = (kind: ConnectionKind): number | undefined => {
    if (kind === 'walletconnect-v1') return 1
    if (kind === 'walletconnect-v2') return 2
    return undefined
}

export const toConnectionSettingsRow = (
    connection: Connection,
    networks: Network[],
): ConnectionSettingsRow => ({
    id: connection.id,
    kind: connection.kind,
    title: connection.name,
    subtitle: connection.peer.url ?? '',
    iconUrl: connection.peer.icons?.[0],
    accounts: connection.accounts,
    isConnected: connection.status === 'active',
    createdAt: connection.createdAt,
    lastActiveAt: connection.lastActiveAt,
    peer: connection.peer,
    permissions: readPermissions(connection),
    networks,
    ...(protocolVersionFor(connection.kind) !== undefined
        ? { protocolVersion: protocolVersionFor(connection.kind) }
        : {}),
})

/**
 * What every settings screen consumes, whichever source produced it.
 * Declared here rather than beside the native hook so the web twin can name
 * it without importing its own specifier.
 */
export type UseConnectionSettingsListResult = {
    connections: ConnectionSettingsRow[]
    /** False while the mirror is still filling; an empty list then means "not loaded", not "none". */
    isHydrated: boolean
    /** Fire-and-forget: failures surface as a toast, never to the caller. */
    handleRevoke: (id: ConnectionId) => void
    /**
     * The same disconnect, awaited, for callers that must act on the outcome
     * — the detail screen only navigates back once the peer is genuinely
     * gone, or the user returns to a list that still shows it.
     */
    revoke: (id: ConnectionId) => Promise<void>
    /**
     * Disconnects every connection, rejecting only if the sweep itself could
     * not be started — an individual unreachable peer never aborts the rest.
     * Awaited (unlike `handleRevoke`) because the "delete all" dialog keeps a
     * spinner up until it settles.
     */
    revokeAll: () => Promise<void>
    keyExtractor: (item: ConnectionSettingsRow) => string
}

/**
 * Most-recently-active first, mirroring the unified settings list's sort.
 * Returns a new array — the input is never mutated.
 */
export const sortConnectionSettingsRows = (
    rows: ConnectionSettingsRow[],
): ConnectionSettingsRow[] =>
    [...rows].sort((a, b) => b.lastActiveAt - a.lastActiveAt)
