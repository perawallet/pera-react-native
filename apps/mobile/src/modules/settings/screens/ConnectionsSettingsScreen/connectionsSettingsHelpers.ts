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

import type { ModalState } from '@hooks/useModalState'
import type { DappPermission } from '@perawallet/wallet-extension-platform-chrome'
import type { ConnectionKind as RegistryConnectionKind } from '@perawallet/wallet-extension-connections'
import type { ConnectionSettingsRow } from '@perawallet/wallet-core-connections'

// Shared by the native and web hooks so they cannot drift on the `UnifiedConnection` shape.

/** A registry record's kind, or `'dapp'` for an ARC-0027 site permission, which is not a `Connection`. */
export type ConnectionKind = RegistryConnectionKind | 'dapp'

/**
 * Screen-only union of the two read models. `connectedAt` differs per source
 * (a `Date` for a site permission, epoch ms for a registry row) and a `Date`
 * persisted via `createJSONStorage` rehydrates as an ISO *string*, so a naive
 * `.getTime()` throws; compare via {@link toComparableTime}.
 */
export type UnifiedConnection = {
    id: string
    kind: ConnectionKind
    title: string
    subtitle: string
    iconUrl?: string
    connectedAt?: Date | string | number
    onRevoke: () => void
}

/** Guards the rehydrated-as-string case (see `UnifiedConnection.connectedAt`); `0` when absent or unparseable. */
export const toComparableTime = (
    value: Date | string | number | undefined,
): number => {
    if (value === undefined) return 0
    const time =
        value instanceof Date ? value.getTime() : new Date(value).getTime()
    return Number.isNaN(time) ? 0 : time
}

export type UseConnectionsSettingsScreenResult = {
    connections: UnifiedConnection[]
    isLoading: boolean
    /** False while the registry mirror is still filling; hold the empty state until then. */
    isHydrated: boolean
    handleRevoke: (connection: UnifiedConnection) => void
    keyExtractor: (item: UnifiedConnection) => string
    /** Opens the QR-paste flow; WalletConnect is the only user-initiated kind here (dapp connections come from enable()). */
    scannerState: ModalState
}

/** `connectedAt` is plain epoch ms here; `onRevoke` is the list hook's fire-and-forget revoke with its own toast. */
export const toUnifiedConnection = (
    row: ConnectionSettingsRow,
    revoke: (id: string) => void,
): UnifiedConnection => ({
    id: `connection-${row.id}`,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle,
    iconUrl: row.iconUrl,
    connectedAt: row.lastActiveAt || row.createdAt,
    onRevoke: () => revoke(row.id),
})

export const toUnifiedDappPermission = (
    site: DappPermission,
    revoke: (origin: string) => Promise<void>,
    onError: (error: unknown) => void,
): UnifiedConnection => ({
    id: `dapp-${site.origin}`,
    kind: 'dapp',
    title: site.name ?? site.origin,
    subtitle: site.origin,
    iconUrl: site.iconUrl,
    connectedAt: new Date(site.grantedAt),
    onRevoke: () => {
        void revoke(site.origin).catch(onError)
    },
})
