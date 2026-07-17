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

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { type RouteProp, useRoute } from '@react-navigation/native'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useIsMounted } from '@hooks/useIsMounted'
import { useLanguage } from '@hooks/useLanguage'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    type LedgerConnectionStatus,
    connectAndDiscoverAccounts,
    LedgerNoAccountsFoundError,
    LedgerProviderNotFoundError,
    classifyLedgerError,
} from '@perawallet/wallet-core-ledger'
import type { HardwareWalletTransport } from '@perawallet/wallet-core-hardware-wallet'
import {
    fetchAccountExists,
    type AppError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    getLedgerErrorPreset,
    type LedgerErrorPreset,
} from '@modules/ledger/utils'
import { LedgerConnectingContent } from '../../components/LedgerConnectingContent'

type LedgerFetchAccountsRouteProp = RouteProp<
    AddAccountStackParamList,
    'LedgerFetchAccounts'
>

type UseLedgerFetchAccountsScreenResult = {
    connectionStatus: LedgerConnectionStatus
    isDiscovering: boolean
    isLoading: boolean
    progress: { current: number; total: Nullable<number> }
    error: Nullable<AppError>
    errorPreset: Nullable<LedgerErrorPreset>
    handleRetry: () => void
    handleTroubleshoot: () => void
}

export const useLedgerFetchAccountsScreen =
    (): UseLedgerFetchAccountsScreenResult => {
        const {
            params: { deviceId, deviceName, transportType = 'ble' },
        } = useRoute<LedgerFetchAccountsRouteProp>()
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const isMounted = useIsMounted()
        const { network } = useNetwork()
        const { request: requestBottomSheet, dismiss } = useBottomSheet()

        const [connectionStatus, setConnectionStatus] =
            useState<LedgerConnectionStatus>('disconnected')
        const [isDiscovering, setIsDiscovering] = useState(false)
        const [progress, setProgress] = useState<{
            current: number
            total: Nullable<number>
        }>({ current: 0, total: null })
        const [error, setError] = useState<Nullable<AppError>>(null)

        const hasStartedRef = useRef(false)
        const transportRef = useRef<Nullable<HardwareWalletTransport>>(null)
        const openIdRef = useRef<string | null>(null)

        const run = useCallback(async () => {
            setError(null)
            setConnectionStatus('connecting')
            setIsDiscovering(false)
            setProgress({ current: 0, total: null })

            try {
                const provider =
                    getProvider().hardwareWalletRegistry.getProvider(
                        'ledger',
                        transportType,
                    )
                if (!provider) {
                    throw new LedgerProviderNotFoundError(
                        `No Ledger provider registered for transport "${transportType}"`,
                    )
                }

                setIsDiscovering(true)
                const result = await connectAndDiscoverAccounts({
                    provider,
                    deviceId,
                    onProgress: (index: number) => {
                        setProgress({ current: index + 1, total: null })
                    },
                    // On-chain probe drives the funded-account gap scan so a
                    // migrator's deep indices surface in the initial fetch.
                    // It throws when the API is unreachable, which discovery
                    // treats as "probe unavailable" and degrades to the
                    // shallow capped scan — offline import keeps working.
                    isAccountOnChain: address =>
                        fetchAccountExists(address, network),
                })

                transportRef.current = result.transport

                if (!isMounted()) {
                    await result.transport.disconnect()
                    return
                }

                setConnectionStatus('connected')
                setIsDiscovering(false)

                if (result.accounts.length === 0) {
                    throw new LedgerNoAccountsFoundError()
                }

                navigation.replace('LedgerSelectAccounts', {
                    deviceId,
                    deviceName,
                    transportType,
                    accounts: result.accounts,
                })
            } catch (err) {
                if (!isMounted()) return
                const resolvedError = classifyLedgerError(err)
                setError(resolvedError)
                setConnectionStatus('disconnected')
                setIsDiscovering(false)
            }
        }, [
            deviceId,
            deviceName,
            transportType,
            network,
            navigation,
            isMounted,
        ])

        useEffect(() => {
            if (hasStartedRef.current) return
            hasStartedRef.current = true

            void run()

            return () => {
                transportRef.current?.disconnect().catch(() => {})
            }
        }, [run])

        const handleRetry = useCallback(() => {
            void run()
        }, [run])

        const handleTroubleshoot = useCallback(() => {
            navigation.navigate('LedgerTroubleshooting')
        }, [navigation])

        const errorPreset = useMemo(
            () => (error ? getLedgerErrorPreset(error, t) : null),
            [error, t],
        )

        const isLoading =
            connectionStatus === 'connecting' ||
            connectionStatus === 'connected' ||
            isDiscovering

        useEffect(() => {
            if (!isLoading) {
                if (openIdRef.current) {
                    dismiss(openIdRef.current)
                    openIdRef.current = null
                }
                return
            }
            if (openIdRef.current) return

            const sheetId = 'ledger-connecting'
            openIdRef.current = sheetId

            let cancelled = false
            void (async () => {
                const result = await requestBottomSheet<'cancel'>({
                    id: sheetId,
                    contents: <LedgerConnectingContent />,
                    options: {
                        size: 'auto',
                        enablePanDownToClose: false,
                        enableCloseOnBackdropPress: false,
                    },
                })
                if (cancelled) return
                if (openIdRef.current === sheetId) {
                    openIdRef.current = null
                }
                if (result === 'cancel') {
                    navigation.goBack()
                }
            })()
            return () => {
                cancelled = true
            }
        }, [isLoading, requestBottomSheet, dismiss, navigation])

        // On success the screen unmounts via `navigation.replace` while
        // `connectionStatus` is still `connected` (so `isLoading` never flips
        // to false) — dismiss the connecting sheet on unmount so it doesn't
        // linger over the next screen.
        useEffect(() => {
            return () => {
                if (openIdRef.current) {
                    dismiss(openIdRef.current)
                    openIdRef.current = null
                }
            }
        }, [dismiss])

        return {
            connectionStatus,
            isDiscovering,
            isLoading,
            progress,
            error,
            errorPreset,
            handleRetry,
            handleTroubleshoot,
        }
    }
