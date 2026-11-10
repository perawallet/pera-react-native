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
import { useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ConnectionSettingsRow } from '@perawallet/wallet-core-connections'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useCapability } from '@hooks/useCapability'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useConnectionSettingsList } from '@modules/settings/hooks/useConnectionSettingsList'
import type { SettingsStackParamsList } from '@modules/settings/routes'
import { connectionKindCopy } from '@modules/settings/utils/connectionKindCopy'
import {
    toUnifiedConnection,
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
        // `handleRevoke` is fire-and-forget with its own toast, so it is wrapped in
        // the confirmation sheet rather than handed to the row: a straight swap
        // would make revoke a single unguarded tap.
        const {
            connections: connectionRows,
            isHydrated,
            handleRevoke: revokeConnection,
        } = useConnectionSettingsList()
        const { request: requestBottomSheet } = useBottomSheet()
        const scannerState = useModalState()
        const canConnect = useCapability({ anyChain: 'dappConnect' })
        const navigation =
            useNavigation<NativeStackNavigationProp<SettingsStackParamsList>>()

        const openConnection = useCallback(
            (row: ConnectionSettingsRow) => {
                navigation.navigate('WalletConnectSettings', {
                    screen: 'WalletConnectSettingsDetails',
                    params: { connection: row },
                })
            },
            [navigation],
        )

        const connections = useMemo(
            () =>
                connectionRows
                    .map(row =>
                        toUnifiedConnection(
                            row,
                            revokeConnection,
                            chainDisplayNameOf,
                            openConnection,
                        ),
                    )
                    .sort((a, b) => b.connectedAt - a.connectedAt),
            [connectionRows, revokeConnection, openConnection],
        )

        const confirmRevoke = useCallback(
            async (connection: UnifiedConnection) => {
                const copy = connectionKindCopy(connection.kind)
                const confirmed = await requestBottomSheet<boolean>({
                    contents: (
                        <ConfirmActionContent
                            icon='trash'
                            iconVariant='error'
                            title={t(copy.deleteTitleKey)}
                            message={t(copy.deleteBodyKey, {
                                origin: connection.subtitle,
                            })}
                            confirmLabel={t(copy.confirmKey)}
                            cancelLabel={t(copy.cancelKey)}
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
            isHydrated,
            handleRevoke,
            keyExtractor,
            scannerState,
            canConnect,
        }
    }
