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

import { useCallback, useMemo } from 'react'
import { Networks, type Network } from '@perawallet/wallet-core-shared'
import {
    isChainIdAcceptable,
    type WalletConnectConnection,
} from '@perawallet/wallet-core-walletconnect'
import type { ConnectionId } from '@perawallet/wallet-extension-connections'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useWalletConnectSessionsControl } from '@modules/walletconnect/hooks/useWalletConnectSessionsControl'
import { toComparableTime } from '@modules/settings/screens/ConnectionsSettingsScreen/connectionsSettingsHelpers'
import {
    sortConnectionSettingsRows,
    type ConnectionSettingsRow,
    type UseConnectionSettingsListResult,
} from './connectionSettingsReadModel'

export type {
    ConnectionSettingsRow,
    UseConnectionSettingsListResult,
} from './connectionSettingsReadModel'

// What the v1 handler's `matchesNetwork` answers for a registry record.
const networksForChainId = (chainId: number | undefined): Network[] =>
    Object.values(Networks).filter(network =>
        isChainIdAcceptable(chainId, network),
    )

/**
 * Legacy `WalletConnectConnection` in the same read model the registry's
 * records produce.
 *
 * `createdAt`/`lastActiveAt` are typed `Date` but rehydrate as ISO strings
 * (`createJSONStorage` with no reviver), which is what `toComparableTime`
 * exists for — do not simplify it to `.getTime()`.
 */
const toRow = (
    connection: WalletConnectConnection,
    unknownPeerLabel: string,
): ConnectionSettingsRow => {
    const peerMeta = connection.session?.peerMeta
    const createdAt = toComparableTime(connection.createdAt)
    return {
        id: connection.clientId ?? '',
        kind: 'walletconnect-v1',
        title: peerMeta?.name ?? unknownPeerLabel,
        subtitle: peerMeta?.url ?? connection.bridge ?? '',
        iconUrl: peerMeta?.icons?.[0],
        accounts: connection.session?.accounts ?? [],
        isConnected: connection.session?.connected ?? false,
        createdAt,
        lastActiveAt: toComparableTime(connection.lastActiveAt) || createdAt,
        peer: {
            name: peerMeta?.name ?? unknownPeerLabel,
            ...(peerMeta?.url ? { url: peerMeta.url } : {}),
            ...(peerMeta?.description
                ? { description: peerMeta.description }
                : {}),
            ...(peerMeta?.icons ? { icons: peerMeta.icons } : {}),
        },
        permissions: connection.session?.permissions ?? [],
        networks: networksForChainId(connection.session?.chainId),
        protocolVersion: connection.version,
    }
}

/**
 * Web twin. The browser extension mounts no `ConnectionsProvider` — offscreen
 * owns its WalletConnect connectors and its sessions still live in the legacy
 * store — so this keeps reading them from `useWalletConnectSessionsControl`
 * and only re-labels them into the shared row shape. The extension moves onto
 * the registry under its own plan.
 */
export const useConnectionSettingsList =
    (): UseConnectionSettingsListResult => {
        const {
            connections: legacyConnections,
            disconnect,
            deleteAllSessions,
        } = useWalletConnectSessionsControl()
        const { showError } = useErrorToast()
        const { t } = useLanguage()

        const connections = useMemo(
            () =>
                sortConnectionSettingsRows(
                    legacyConnections.map(connection =>
                        toRow(
                            connection,
                            t('walletconnect.settings.unknown_peer'),
                        ),
                    ),
                ),
            [legacyConnections, t],
        )

        const handleRevoke = useCallback(
            (id: ConnectionId) => {
                void disconnect(id).catch((error: unknown) => {
                    showError(
                        error,
                        t('walletconnect.settings.disconnect_failed_title'),
                    )
                })
            },
            [disconnect, showError, t],
        )

        const keyExtractor = useCallback(
            (item: ConnectionSettingsRow) => item.id,
            [],
        )

        return {
            connections,
            // The legacy store rehydrates synchronously on the extension.
            isHydrated: true,
            handleRevoke,
            revoke: disconnect,
            revokeAll: deleteAllSessions,
            keyExtractor,
        }
    }
