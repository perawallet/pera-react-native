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
import { useConnectionsStore } from '@perawallet/wallet-core-connections'
import type { ConnectionId } from '@perawallet/wallet-extension-connections'
import { useConnectionRegistry } from '@modules/connections'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    toConnectionSettingsRow,
    sortConnectionSettingsRows,
    type ConnectionSettingsRow,
    type UseConnectionSettingsListResult,
} from './connectionSettingsReadModel'

export type {
    ConnectionSettingsRow,
    UseConnectionSettingsListResult,
} from './connectionSettingsReadModel'

/**
 * Settings read path over `Connection` records: mirrors `useConnectionsStore`
 * into the settings read model and revokes through `registry.disconnect`.
 *
 * The abstraction-native replacement for the WalletConnect half of
 * `useConnectionsSettingsScreen`'s `UnifiedConnection` union and for
 * `SettingsWalletConnectScreen`'s `useWalletConnectSessionsControl()` read.
 *
 * `useConnectionRegistry` throws outside `ConnectionsProvider` by design, so
 * this is only safe to render from a descendant of it — which every settings
 * screen is on native. The browser extension mounts no provider and keeps its
 * sessions in the legacy store, so it resolves `useConnectionSettingsList.web`
 * instead; the two agree on `ConnectionSettingsRow` and nothing above them
 * branches on platform.
 */
export const useConnectionSettingsList =
    (): UseConnectionSettingsListResult => {
        const storedConnections = useConnectionsStore(
            state => state.connections,
        )
        const isHydrated = useConnectionsStore(state => state.isHydrated)
        const registry = useConnectionRegistry()
        const { showError } = useErrorToast()
        const { t } = useLanguage()

        const connections = useMemo(
            () =>
                sortConnectionSettingsRows(
                    storedConnections.map(connection =>
                        toConnectionSettingsRow(
                            connection,
                            registry.networksFor(connection),
                        ),
                    ),
                ),
            [storedConnections, registry],
        )

        const revoke = useCallback(
            (id: ConnectionId) => registry.disconnect(id),
            [registry],
        )

        const handleRevoke = useCallback(
            (id: ConnectionId) => {
                void revoke(id).catch((error: unknown) => {
                    showError(
                        error,
                        t('walletconnect.settings.disconnect_failed_title'),
                    )
                })
            },
            [revoke, showError, t],
        )

        const revokeAll = useCallback(
            () => registry.disconnectAll(),
            [registry],
        )

        const keyExtractor = useCallback(
            (item: ConnectionSettingsRow) => item.id,
            [],
        )

        return {
            connections,
            isHydrated,
            handleRevoke,
            revoke,
            revokeAll,
            keyExtractor,
        }
    }
