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
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useDappConnectionsStore } from '@modules/settings/hooks/useDappConnectionsStore'
import { useWalletConnectSessionsControl } from '@modules/walletconnect/hooks/useWalletConnectSessionsControl'
import {
    toComparableTime,
    toUnifiedDappPermission,
    toUnifiedWalletConnectConnection,
    type UnifiedConnection,
    type UseConnectionsSettingsScreenResult,
} from './connectionsSettingsHelpers'

export type {
    ConnectionKind,
    UnifiedConnection,
    UseConnectionsSettingsScreenResult,
} from './connectionsSettingsHelpers'

export const useConnectionsSettingsScreen =
    (): UseConnectionsSettingsScreenResult => {
        const { t } = useLanguage()
        const { connections: walletConnectConnections, disconnect } =
            useWalletConnectSessionsControl()
        const { sites, isLoading, revoke } = useDappConnectionsStore()
        const { request: requestBottomSheet } = useBottomSheet()
        const scannerState = useModalState()
        const { showError } = useErrorToast()

        const handleRevokeError = useCallback(
            (error: unknown) => {
                showError(error, t('common.error.title'))
            },
            [showError, t],
        )

        const handleDisconnectError = useCallback(
            (error: unknown) => {
                showError(
                    error,
                    t('walletconnect.settings.disconnect_failed_title'),
                )
            },
            [showError, t],
        )

        const connections = useMemo(() => {
            const unified: UnifiedConnection[] = [
                ...walletConnectConnections.map(connection =>
                    toUnifiedWalletConnectConnection(
                        connection,
                        disconnect,
                        handleDisconnectError,
                        t('walletconnect.settings.unknown_peer'),
                    ),
                ),
                ...sites.map(site =>
                    toUnifiedDappPermission(site, revoke, handleRevokeError),
                ),
            ]
            return unified.sort(
                (a, b) =>
                    toComparableTime(b.connectedAt) -
                    toComparableTime(a.connectedAt),
            )
        }, [
            walletConnectConnections,
            disconnect,
            sites,
            revoke,
            handleRevokeError,
            handleDisconnectError,
            t,
        ])

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

        return {
            connections,
            isLoading,
            handleRevoke,
            keyExtractor,
            scannerState,
        }
    }
