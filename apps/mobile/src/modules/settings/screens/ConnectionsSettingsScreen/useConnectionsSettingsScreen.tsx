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
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useDappConnectionsStore } from '@modules/settings/hooks/useDappConnectionsStore'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useWalletConnect,
    type WalletConnectConnection,
} from '@perawallet/wallet-core-walletconnect'
import type { DappPermission } from '@perawallet/wallet-extension-platform-chrome'

/**
 * Extensible by design — a `'liquidauth'` member is expected once Liquid
 * Auth lands as a third adapter (design doc). A plain string-literal union
 * is deliberately as far as this goes for now.
 */
export type ConnectionKind = 'walletconnect' | 'dapp'

/** Screen-only presentation type. Neither underlying store is touched or
 * reshaped — this just unions their read models for one flat list. */
export type UnifiedConnection = {
    id: string
    kind: ConnectionKind
    title: string
    subtitle: string
    iconUrl?: string
    connectedAt?: Date
    onRevoke: () => void
}

export type UseConnectionsSettingsScreenResult = {
    connections: UnifiedConnection[]
    isLoading: boolean
    handleRevoke: (connection: UnifiedConnection) => void
    keyExtractor: (item: UnifiedConnection) => string
}

const toUnifiedWalletConnectConnection = (
    connection: WalletConnectConnection,
    disconnect: (clientId: string, triggerDisconnect: boolean) => Promise<void>,
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
            void disconnect(clientId, true)
        },
    }
}

const toUnifiedDappPermission = (
    site: DappPermission,
    revoke: (origin: string) => Promise<void>,
): UnifiedConnection => ({
    id: `dapp-${site.origin}`,
    kind: 'dapp',
    title: site.name ?? site.origin,
    subtitle: site.origin,
    iconUrl: site.iconUrl,
    connectedAt: new Date(site.grantedAt),
    onRevoke: () => {
        void revoke(site.origin)
    },
})

export const useConnectionsSettingsScreen =
    (): UseConnectionsSettingsScreenResult => {
        const { t } = useLanguage()
        const { network } = useNetwork()
        const { connections: walletConnectConnections, disconnect } =
            useWalletConnect(network)
        const { sites, isLoading, revoke } = useDappConnectionsStore()
        const { request: requestBottomSheet } = useBottomSheet()

        const connections = useMemo(() => {
            const unified: UnifiedConnection[] = [
                ...walletConnectConnections.map(connection =>
                    toUnifiedWalletConnectConnection(connection, disconnect),
                ),
                ...sites.map(site => toUnifiedDappPermission(site, revoke)),
            ]
            return unified.sort(
                (a, b) =>
                    (b.connectedAt?.getTime() ?? 0) -
                    (a.connectedAt?.getTime() ?? 0),
            )
        }, [walletConnectConnections, disconnect, sites, revoke])

        const confirmRevoke = useCallback(
            async (connection: UnifiedConnection) => {
                const isWalletConnect = connection.kind === 'walletconnect'
                const confirmed = await requestBottomSheet<boolean>({
                    contents: (
                        <ConfirmActionContent
                            icon='trash'
                            iconVariant='error'
                            title={t(
                                isWalletConnect
                                    ? 'walletconnect.settings.delete_title'
                                    : 'settings.connected_sites.revoke_title',
                            )}
                            message={t(
                                isWalletConnect
                                    ? 'walletconnect.settings.delete_body'
                                    : 'settings.connected_sites.revoke_body',
                                { origin: connection.subtitle },
                            )}
                            confirmLabel={t(
                                isWalletConnect
                                    ? 'common.delete.label'
                                    : 'settings.connected_sites.revoke_confirm',
                            )}
                            cancelLabel={t(
                                isWalletConnect
                                    ? 'common.cancel.label'
                                    : 'settings.connected_sites.revoke_cancel',
                            )}
                            confirmVariant='destructive'
                            testID='connections_settings_revoke_confirm_bottom_sheet'
                            confirmTestID='connections_settings_revoke_confirm_button'
                            cancelTestID='connections_settings_revoke_cancel_button'
                        />
                    ),
                    options: { size: 'auto', enablePanDownToClose: true },
                })
                if (!confirmed) return
                connection.onRevoke()
            },
            [requestBottomSheet, t],
        )

        const handleRevoke = useCallback(
            (connection: UnifiedConnection) => {
                void confirmRevoke(connection)
            },
            [confirmRevoke],
        )

        const keyExtractor = useCallback(
            (item: UnifiedConnection) => item.id,
            [],
        )

        return { connections, isLoading, handleRevoke, keyExtractor }
    }
