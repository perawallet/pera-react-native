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
import type { ConnectionKind as RegistryConnectionKind } from '@perawallet/wallet-extension-connections'
import type { ConnectionSettingsRow } from '@perawallet/wallet-core-connections'

export type ConnectionKind = RegistryConnectionKind

/** Screen-only read model; `connectedAt` is epoch ms. */
export type UnifiedConnection = {
    id: string
    kind: ConnectionKind
    title: string
    subtitle: string
    iconUrl?: string
    connectedAt: number
    onRevoke: () => void
}

export type UseConnectionsSettingsScreenResult = {
    connections: UnifiedConnection[]
    /** False while the registry mirror is still filling; hold the empty state until then. */
    isHydrated: boolean
    handleRevoke: (connection: UnifiedConnection) => void
    keyExtractor: (item: UnifiedConnection) => string
    /** Opens the QR-paste flow; WalletConnect is the only user-initiated kind here (a dapp connection is proposed by the page). */
    scannerState: ModalState
}

/** `onRevoke` is the list hook's fire-and-forget revoke with its own toast. */
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
