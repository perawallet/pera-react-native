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

import { useEffect, useRef, useCallback, useState } from 'react'
import { RouteProp, useRoute } from '@react-navigation/native'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { LedgerConnectionStatus } from '@perawallet/wallet-core-ledger'
import { connectAndDiscoverAccounts } from '@perawallet/wallet-core-ledger'
import type { HardwareWalletTransport } from '@perawallet/wallet-core-hardware-wallet'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'

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

        const [connectionStatus, setConnectionStatus] =
            useState<LedgerConnectionStatus>('disconnected')
        const [isDiscovering, setIsDiscovering] = useState(false)
        const [progress, setProgress] = useState<{
            current: number
            total: number | null
        }>({ current: 0, total: null })
        const [error, setError] = useState<Error | null>(null)

        const hasStartedRef = useRef(false)
        const mountedRef = useRef(true)
        const transportRef = useRef<HardwareWalletTransport | null>(null)

        const run = useCallback(async () => {
            setError(null)
            setConnectionStatus('connecting')
            setIsDiscovering(false)
            setProgress({ current: 0, total: null })

            try {
                const provider =
                    getProvider().hardwareWalletRegistry.getProvider('ledger')!

                setIsDiscovering(true)
                const result = await connectAndDiscoverAccounts({
                    provider,
                    deviceId,
                    onProgress: (index: number) => {
                        setProgress({ current: index + 1, total: null })
                    },
                })

                transportRef.current = result.transport

                if (!mountedRef.current) {
                    await result.transport.disconnect()
                    return
                }

                setConnectionStatus('connected')
                setIsDiscovering(false)

                if (result.accounts.length === 0) {
                    throw new Error('No accounts found on this device')
                }

                navigation.replace('LedgerSelectAccounts', {
                    deviceId,
                    deviceName,
                    accounts: result.accounts,
                })
            } catch (err) {
                if (!mountedRef.current) return
                const resolvedError =
                    err instanceof Error ? err : new Error(String(err))
                setError(resolvedError)
                setConnectionStatus('disconnected')
                setIsDiscovering(false)
            }
        }, [deviceId, deviceName, navigation])

        useEffect(() => {
            mountedRef.current = true
            if (hasStartedRef.current) return
            hasStartedRef.current = true

            run()

            return () => {
                mountedRef.current = false
                transportRef.current?.disconnect().catch(() => {})
            }
        }, [run])

        const handleRetry = useCallback(() => {
            run()
        }, [run])

        return {
            connectionStatus,
            isDiscovering,
            progress,
            error,
            handleRetry,
            t,
        }
    }
