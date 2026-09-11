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
import {
    sortConnectionSettingsRows,
    toConnectionSettingsRow,
    useConnectionRegistry,
    useConnectionsStore,
    type ConnectionSettingsRow,
} from '@perawallet/wallet-core-connections'
import type { ConnectionId } from '@perawallet/wallet-extension-connections'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'

export type UseConnectionSettingsListResult = {
    connections: ConnectionSettingsRow[]
    /** False while the mirror is still filling; an empty list then means "not loaded", not "none". */
    isHydrated: boolean
    /** Fire-and-forget: failures surface as a toast, never to the caller. */
    handleRevoke: (id: ConnectionId) => void
    /** Awaited variant: the detail screen only navigates back once the peer is genuinely gone. */
    revoke: (id: ConnectionId) => Promise<void>
    /**
     * Rejects only if the sweep itself could not start; an unreachable peer never
     * aborts the rest. Awaited because the "delete all" dialog spins until it settles.
     */
    revokeAll: () => Promise<void>
    keyExtractor: (item: ConnectionSettingsRow) => string
}

// `useConnectionRegistry` throws outside `ConnectionsProvider` by design, so
// this only renders below it.
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
                            registry.methodsFor(connection),
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
