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

import { useEffect, useRef, useCallback } from 'react'
import { RouteProp, useRoute } from '@react-navigation/native'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import type { LedgerConnectionStatus } from '@perawallet/wallet-core-ledger'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'

import { useLedgerConnection, useLedgerAccounts } from '../../hooks'

type LedgerFetchAccountsRouteProp = RouteProp<
    AddAccountStackParamList,
    'LedgerFetchAccounts'
>

type UseLedgerFetchAccountsScreenResult = {
    connectionStatus: LedgerConnectionStatus
    isDiscovering: boolean
    progress: { current: number; total: number | null }
    error: Error | null
    handleRetry: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useLedgerFetchAccountsScreen =
    (): UseLedgerFetchAccountsScreenResult => {
        const {
            params: { deviceId, deviceName },
        } = useRoute<LedgerFetchAccountsRouteProp>()
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const {
            connectionStatus,
            connect,
            disconnect,
            error: connectionError,
        } = useLedgerConnection()
        const {
            isDiscovering,
            progress,
            error: discoveryError,
            discover,
        } = useLedgerAccounts()

        const hasStartedRef = useRef(false)
        const mountedRef = useRef(true)

        const connectAndDiscover = useCallback(async () => {
            try {
                const transport = await connect(deviceId)

                // If unmounted during connect, clean up immediately
                if (!mountedRef.current) {
                    await transport.disconnect()
                    return
                }

                // Note: if unmount occurs during discover(), the transport stays
                // open until discovery completes. The mountedRef check below
                // prevents navigation but doesn't abort in-flight discovery.
                const accounts = await discover(transport)

                if (!mountedRef.current) return

                if (accounts.length === 0) {
                    throw new Error('No accounts found on this device')
                }

                navigation.replace('LedgerSelectAccounts', {
                    deviceId,
                    deviceName,
                    accounts,
                })
            } catch {
                // Errors are captured in the hook state
            }
        }, [connect, deviceId, deviceName, discover, navigation])

        useEffect(() => {
            mountedRef.current = true
            if (hasStartedRef.current) return
            hasStartedRef.current = true

            connectAndDiscover()

            return () => {
                mountedRef.current = false
                disconnect()
            }
        }, [connectAndDiscover, disconnect])

        const handleRetry = useCallback(() => {
            connectAndDiscover()
        }, [connectAndDiscover])

        const error = connectionError ?? discoveryError

        return {
            connectionStatus,
            isDiscovering,
            progress,
            error,
            handleRetry,
            t,
        }
    }
