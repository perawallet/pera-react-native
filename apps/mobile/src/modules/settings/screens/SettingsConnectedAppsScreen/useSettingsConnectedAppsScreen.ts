/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useMemo, useState } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useWalletConnect } from '@perawallet/wallet-core-walletconnect'
import {
    disconnectAllLiquidAuthSessions,
    useLiquidAuthStore,
} from '@perawallet/wallet-core-liquid-auth'
import { useLiquidAuthEnabled } from '@modules/connections/liquid-auth/hooks'
import { useModalState } from '@hooks/useModalState'
import {
    liquidAuthToSummary,
    walletConnectToSummary,
    type SessionSummary,
} from '../../connected-apps/sessionSummary'

type ModalState = ReturnType<typeof useModalState>

export type UseSettingsConnectedAppsScreenResult = {
    summaries: SessionSummary[]
    hasConnections: boolean
    scannerState: ModalState
    deleteState: ModalState
    isDeleting: boolean
    handleDeleteAll: () => void
}

export const useSettingsConnectedAppsScreen =
    (): UseSettingsConnectedAppsScreenResult => {
        const { t } = useLanguage()
        const { network } = useNetwork()
        const { connections, deleteAllSessions } = useWalletConnect(network)
        const isLiquidAuthEnabled = useLiquidAuthEnabled()
        const liquidSessions = useLiquidAuthStore(state => state.sessions)
        const scannerState = useModalState()
        const deleteState = useModalState()
        const [isDeleting, setIsDeleting] = useState(false)

        const summaries = useMemo<SessionSummary[]>(() => {
            const fallbackName = t('connected_apps.unknown_app')
            const walletConnectSummaries = connections.map(connection =>
                walletConnectToSummary(connection, fallbackName),
            )
            if (!isLiquidAuthEnabled) {
                return walletConnectSummaries
            }
            return [
                ...walletConnectSummaries,
                ...liquidSessions.map(session =>
                    liquidAuthToSummary(session, fallbackName),
                ),
            ]
        }, [connections, isLiquidAuthEnabled, liquidSessions, t])

        const handleDeleteAll = () => {
            setIsDeleting(true)
            // Clear BOTH protocols. Liquid Auth disconnect must also close the
            // live WebRTC clients (not just drop the session records), otherwise
            // dApps stay connected to a "disconnected" wallet.
            disconnectAllLiquidAuthSessions()
            deleteAllSessions()
                .then(() => {
                    deleteState.close()
                })
                .finally(() => {
                    setIsDeleting(false)
                })
        }

        return {
            summaries,
            hasConnections: summaries.length > 0,
            scannerState,
            deleteState,
            isDeleting,
            handleDeleteAll,
        }
    }
