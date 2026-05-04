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

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { RouteProp, useRoute } from '@react-navigation/native'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useAccountsStore,
    useSetAccounts,
    useSelectedAccountAddress,
    AccountTypes,
} from '@perawallet/wallet-core-accounts'
import type { HardwareWalletTransport } from '@perawallet/wallet-core-hardware-wallet'
import type { LedgerAccount } from '@perawallet/wallet-core-ledger'
import { verifyLedgerAddress } from '@perawallet/wallet-core-ledger'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'
import { useExitAccountFlow } from '@modules/onboarding/hooks'
import {
    getLedgerErrorPreset,
    type LedgerErrorPreset,
} from '@modules/ledger/utils'

type LedgerVerifyRouteProp = RouteProp<AddAccountStackParamList, 'LedgerVerify'>

type VerificationState = 'connecting' | 'verifying' | 'complete' | 'error'

type UseLedgerVerifyScreenResult = {
    verificationState: VerificationState
    currentIndex: number
    totalAccounts: number
    currentAddress: Nullable<string>
    error: Nullable<Error>
    errorPreset: Nullable<LedgerErrorPreset>
    handleRetry: () => void
    handleTroubleshoot: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useLedgerVerifyScreen = (): UseLedgerVerifyScreenResult => {
    const {
        params: {
            deviceId,
            deviceName,
            transportType = 'ble',
            selectedAccounts,
        },
    } = useRoute<LedgerVerifyRouteProp>()
    const { t } = useLanguage()
    const { setAccounts } = useSetAccounts()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { exitAccountFlow } = useExitAccountFlow()
    const navigation = useAppNavigation()

    const [verificationState, setVerificationState] =
        useState<VerificationState>('connecting')
    const [currentIndex, setCurrentIndex] = useState(0)
    const [error, setError] = useState<Nullable<Error>>(null)

    const hasStartedRef = useRef(false)

    const currentAddress =
        currentIndex < selectedAccounts.length
            ? selectedAccounts[currentIndex].address
            : null

    const verifyAndSave = useCallback(async () => {
        let transport: Nullable<HardwareWalletTransport> = null
        try {
            setVerificationState('connecting')
            setError(null)

            const provider = getProvider().hardwareWalletRegistry.getProvider(
                'ledger',
                transportType,
            )
            if (!provider) {
                throw new Error(
                    `No Ledger provider for transport "${transportType}"`,
                )
            }

            transport = await provider.connect(deviceId)
            setVerificationState('verifying')

            for (let i = 0; i < selectedAccounts.length; i++) {
                setCurrentIndex(i)
                await verifyLedgerAddress(
                    transport,
                    selectedAccounts[i].accountIndex,
                )
            }

            setVerificationState('complete')

            const hwAccounts = selectedAccounts.map((acc: LedgerAccount) => ({
                type: AccountTypes.hardware,
                address: acc.address,
                hardwareDetails: {
                    manufacturer: 'ledger' as const,
                    deviceId,
                    deviceName,
                    accountIndex: acc.accountIndex,
                    transportType,
                },
            }))

            const currentAccounts = useAccountsStore.getState().accounts
            setAccounts([...currentAccounts, ...hwAccounts])
            setSelectedAccountAddress(hwAccounts[0].address)
            exitAccountFlow()
        } catch (err) {
            const verifyError =
                err instanceof Error ? err : new Error(String(err))
            setError(verifyError)
            setVerificationState('error')
        } finally {
            if (transport) {
                await transport.disconnect().catch(() => {})
            }
        }
    }, [
        deviceId,
        deviceName,
        transportType,
        selectedAccounts,
        setAccounts,
        setSelectedAccountAddress,
        exitAccountFlow,
    ])

    useEffect(() => {
        if (hasStartedRef.current) return
        hasStartedRef.current = true

        verifyAndSave()
    }, [verifyAndSave])

    const handleRetry = useCallback(() => {
        setCurrentIndex(0)
        verifyAndSave()
    }, [verifyAndSave])

    const handleTroubleshoot = useCallback(() => {
        navigation.navigate('LedgerTroubleshooting')
    }, [navigation])

    const errorPreset = useMemo(
        () =>
            verificationState === 'error' && error !== null
                ? getLedgerErrorPreset(error, t)
                : null,
        [error, verificationState, t],
    )

    return {
        verificationState,
        currentIndex,
        totalAccounts: selectedAccounts.length,
        currentAddress,
        error,
        errorPreset,
        handleRetry,
        handleTroubleshoot,
        t,
    }
}
