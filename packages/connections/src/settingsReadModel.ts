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

/** Kind-agnostic: nothing here assumes which handler wrote the record. Timestamps are epoch ms. */
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
    /** Carried whole: the detail screen shows the description and picks its own icon. */
    peer: ConnectionPeer
    /**
     * Methods the session was approved for, as its handler reads them; empty
     * when the record predates the field.
     */
    permissions: string[]
    /** Every network the connection is usable on, as its handler resolves it. */
    networks: Network[]
    /** Protocol version behind the `WCV…` badge; absent for a kind with none. */
    protocolVersion?: number
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
    methods: string[],
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
    permissions: methods,
    networks,
    ...(protocolVersionFor(connection.kind) !== undefined
        ? { protocolVersion: protocolVersionFor(connection.kind) }
        : {}),
})

/** Most-recently-active first. Returns a new array; the input is never mutated. */
export const sortConnectionSettingsRows = (
    rows: ConnectionSettingsRow[],
): ConnectionSettingsRow[] =>
    [...rows].sort((a, b) => b.lastActiveAt - a.lastActiveAt)
