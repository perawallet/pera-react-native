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
import type { WalletConnectConnection } from '@perawallet/wallet-core-walletconnect'
import type { DappPermission } from '@perawallet/wallet-extension-platform-chrome'

/**
 * Platform-independent pieces of `useConnectionsSettingsScreen`, shared by
 * the native hook and its web twin so the two never drift on the shape of
 * a `UnifiedConnection` row or how one is built from either source.
 */

/**
 * Extensible by design — a `'liquidauth'` member is expected once Liquid
 * Auth lands as a third adapter (design doc). A plain string-literal union
 * is deliberately as far as this goes for now.
 */
export type ConnectionKind = 'walletconnect' | 'dapp'

/** Screen-only presentation type. Neither underlying store is touched or
 * reshaped — this just unions their read models for one flat list.
 *
 * `connectedAt` is `Date | string` rather than plain `Date`: it is sourced
 * from `WalletConnectConnection.createdAt`, which is persisted via
 * `createJSONStorage` with no reviver, so every rehydrated WC record
 * carries an ISO *string* at runtime despite its `Date` type — `?.` does
 * not guard a string, so a naive `.getTime()` throws the moment the WC
 * store rehydrates. Use {@link toComparableTime} wherever this needs
 * comparing. */
export type UnifiedConnection = {
    id: string
    kind: ConnectionKind
    title: string
    subtitle: string
    iconUrl?: string
    connectedAt?: Date | string
    onRevoke: () => void
}

/**
 * Coerces a possibly-rehydrated-as-string timestamp into epoch
 * milliseconds for sorting, defaulting to `0` when absent or unparseable —
 * mirrors the previous `?.getTime() ?? 0` fallback's intent, but actually
 * guards a `string` (see `UnifiedConnection.connectedAt`'s doc comment for
 * why one shows up here at runtime).
 */
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
    handleRevoke: (connection: UnifiedConnection) => void
    keyExtractor: (item: UnifiedConnection) => string
    /** Drives the QR-paste flow for pairing a new WalletConnect session —
     * the only connection kind here that's user-initiated (dapp connections
     * come from the injected provider's enable() flow instead). */
    scannerState: ModalState
}

export const toUnifiedWalletConnectConnection = (
    connection: WalletConnectConnection,
    disconnect: (clientId: string) => Promise<void>,
    /**
     * `disconnect` sends a control message to the offscreen host on web
     * (see `useWalletConnectSessionsControl.web.ts`) — a rejected send
     * (e.g. no offscreen document to receive it) must not fail silently:
     * without this, the row simply stays on screen with no signal to the
     * user and an unhandled promise rejection. Native's `disconnect` can
     * fail too (a revival timeout inside `useWalletConnect.disconnect`),
     * so this is wired on both platforms, not just web.
     */
    onError: (error: unknown) => void,
): UnifiedConnection => {
    const peerMeta = connection.session?.peerMeta
    const clientId = connection.clientId ?? ''

    return {
        id: `walletconnect-${clientId}`,
        kind: 'walletconnect',
        title: peerMeta?.name ?? 'Unknown',
        subtitle: peerMeta?.url ?? connection.bridge ?? '',
        iconUrl: peerMeta?.icons?.[0],
        connectedAt: connection.createdAt,
        onRevoke: () => {
            disconnect(clientId).catch(onError)
        },
    }
}

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
