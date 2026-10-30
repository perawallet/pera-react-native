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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { DAPP_KIND, EIP1193_DAPP_KIND } from '@perawallet/wallet-core-dapp/wire'
import type { ConnectionKind as RegistryConnectionKind } from '@perawallet/wallet-extension-connections'
import type { ConnectionSettingsRow } from '@perawallet/wallet-core-connections'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { ModalState } from '@hooks/useModalState'

export type ConnectionKind = RegistryConnectionKind

/** A site's page-level access through an injected provider, not a paired WalletConnect session. */
export const isSiteConnectionKind = (kind: ConnectionKind): boolean =>
    kind === DAPP_KIND || kind === EIP1193_DAPP_KIND

/** Screen-only read model; `connectedAt` is epoch ms. */
export type UnifiedConnection = {
    id: string
    kind: ConnectionKind
    title: string
    subtitle: string
    iconUrl?: string
    connectedAt: number
    /**
     * The badge in place of the kind's own label: an EVM site names its chain,
     * so a site connected through both providers shows two tellable rows.
     */
    badgeLabel?: string
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
    /** False while `dappConnect` is off: existing connections stay listed and revocable, but no new one starts here. */
    canConnect: boolean
}

const badgeLabelOf = (
    row: ConnectionSettingsRow,
    chainNameOf: (chainId: ChainId) => Optional<string>,
): Optional<string> => {
    if (row.kind !== EIP1193_DAPP_KIND) return undefined
    const [scope] = row.networks
    return scope ? chainNameOf(scope.chainId) : undefined
}

/**
 * `onRevoke` is the list hook's fire-and-forget revoke with its own toast;
 * `chainNameOf` is undefined for a chain this build doesn't register.
 */
export const toUnifiedConnection = (
    row: ConnectionSettingsRow,
    revoke: (id: string) => void,
    chainNameOf: (chainId: ChainId) => Optional<string>,
): UnifiedConnection => {
    const badgeLabel = badgeLabelOf(row, chainNameOf)
    return {
        id: `connection-${row.id}`,
        kind: row.kind,
        title: row.title,
        subtitle: row.subtitle,
        iconUrl: row.iconUrl,
        connectedAt: row.lastActiveAt || row.createdAt,
        ...(badgeLabel ? { badgeLabel } : {}),
        onRevoke: () => revoke(row.id),
    }
}
